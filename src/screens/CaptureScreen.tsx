import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Platform,
  Animated,
  PanResponder,
  GestureResponderEvent,
  LayoutChangeEvent,
  Linking,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, CameraType, FlashMode, useCameraPermissions } from 'expo-camera';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { useReports } from '../context/ReportsContext';
import { Text } from '../components/common/Text';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { ScreenWrapper } from '../components/common/ScreenWrapper';
import { saveOriginalPhoto, deletePhotoFile, normalizeFileUri } from '../services/storage/fileStorage';
import { locationService } from '../services/location/locationService';
import { generateId, getNowIso } from '../utils';
import { Photo } from '../models/Photo';
import { CloseIcon, FlashIcon, SwitchCameraIcon, CameraIcon } from '../components/icons/Icons';
import type { CaptureScreenProps } from '../navigation/types';

/** How long to wait for the camera to hand over a processed photo before giving up. */
const PHOTO_SAVE_TIMEOUT_MS = 20000;
/** If the native "ready" event never arrives, unlock the shutter anyway after this. */
const CAMERA_READY_FALLBACK_MS = 3500;
/** Pinch sensitivity: how much zoom (0–1) a doubling of finger distance adds. */
const PINCH_SENSITIVITY = 0.45;
/**
 * expo-camera maps zoom linearly onto the device's zoom ratio on Android
 * (ratio = zoom × maxRatio, floored at 1×), so the bottom of the range does nothing.
 * Skipping the first part of the range makes the slider/pinch respond immediately.
 */
const ANDROID_ZOOM_OFFSET = 0.1;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const toNativeZoom = (uiZoom: number) => {
  if (Platform.OS !== 'android' || uiZoom <= 0) return uiZoom;
  return ANDROID_ZOOM_OFFSET + uiZoom * (1 - ANDROID_ZOOM_OFFSET);
};

const touchDistance = (e: GestureResponderEvent) => {
  const [a, b] = e.nativeEvent.touches;
  if (!a || !b) return 0;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
};

const tapHaptic = () => {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

interface CapturedShot {
  uri: string;
  width?: number;
  height?: number;
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
}

const createDeferred = <T,>(timeoutMs: number): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    const timer = setTimeout(() => rej(new Error('Timed out waiting for photo')), timeoutMs);
    resolve = (v) => {
      clearTimeout(timer);
      res(v);
    };
    reject = (r) => {
      clearTimeout(timer);
      rej(r);
    };
  });
  return { promise, resolve, reject };
};

export const CaptureScreen: React.FC<CaptureScreenProps> = ({ route, navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { getReport, addPhotoToReport } = useReports();
  const { reportId } = route.params;
  const report = getReport(reportId);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<CameraType>('back');
  const [flash, setFlash] = useState<FlashMode>('off');
  const [isCameraReady, setIsCameraReady] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraKey, setCameraKey] = useState(0);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [lastThumbUri, setLastThumbUri] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<
    'granted' | 'denied' | 'unavailable' | 'undetermined'
  >('undetermined');

  // Zoom (0–1 in UI space) and slider visibility
  const [zoom, setZoom] = useState(0);
  const [isZoomSliderVisible, setIsZoomSliderVisible] = useState(false);
  const zoomRef = useRef(0);
  const sliderHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sliderWidthRef = useRef(1);

  const cameraRef = useRef<CameraView>(null);
  const isCapturingRef = useRef(false);
  const persistenceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isMountedRef = useRef(true);
  const flashAnim = useRef(new Animated.Value(0)).current;
  const shutterScale = useRef(new Animated.Value(1)).current;
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Next sequential number = highest existing number + 1 (not photo count, which
  // would reuse numbers after photos are deleted). Only advanced inside the serial queue.
  const nextPhotoNumberRef = useRef(
    (report?.photos ?? []).reduce((max, p) => Math.max(max, p.number || 0), 0) + 1
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (sliderHideTimer.current) clearTimeout(sliderHideTimer.current);
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    };
  }, []);

  // Start GPS while the camera is open; stop when leaving.
  useEffect(() => {
    let isMounted = true;
    locationService.startWatching();
    locationService.requestPermission().then((status) => {
      if (isMounted) setLocationStatus(status);
    });
    return () => {
      isMounted = false;
      locationService.stopWatching();
    };
  }, []);

  // Some devices never emit onCameraReady (and iOS only emits it once per session).
  useEffect(() => {
    if (isCameraReady || !cameraPermission?.granted) return;
    const t = setTimeout(() => setIsCameraReady(true), CAMERA_READY_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [isCameraReady, cameraPermission?.granted, cameraKey]);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 3000);
  }, []);

  const handleDone = useCallback(async () => {
    if (isFinalizing) return;
    setIsFinalizing(true);
    // Wait for in-flight photos to be written before leaving.
    await persistenceQueueRef.current;
    if (!isMountedRef.current) return;
    setIsFinalizing(false);

    // Return to the report without leaving the camera mounted in the back stack.
    const state = navigation.getState();
    const previous = state.routes[state.index - 1];
    if (
      previous?.name === 'ReportDetails' &&
      (previous.params as { reportId?: string } | undefined)?.reportId === reportId
    ) {
      navigation.goBack();
    } else {
      navigation.replace('ReportDetails', { reportId });
    }
  }, [isFinalizing, navigation, reportId]);

  // ---- Zoom -------------------------------------------------------------------

  const applyZoom = useCallback((next: number) => {
    const value = clamp01(next);
    // Skip tiny changes so we don't flood the native camera with prop updates.
    if (Math.abs(value - zoomRef.current) < 0.004 && value !== 0 && value !== 1) return;
    zoomRef.current = value;
    setZoom(value);
  }, []);

  const revealZoomSlider = useCallback((autoHide: boolean) => {
    setIsZoomSliderVisible(true);
    if (sliderHideTimer.current) clearTimeout(sliderHideTimer.current);
    if (autoHide) {
      sliderHideTimer.current = setTimeout(() => setIsZoomSliderVisible(false), 2500);
    }
  }, []);

  const resetZoom = useCallback(() => {
    tapHaptic();
    zoomRef.current = 0;
    setZoom(0);
    revealZoomSlider(true);
  }, [revealZoomSlider]);

  const pinchStart = useRef({ distance: 0, zoom: 0 });
  const pinchResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2,
        onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length >= 2,
        onPanResponderGrant: (e) => {
          pinchStart.current = { distance: touchDistance(e), zoom: zoomRef.current };
          revealZoomSlider(false);
        },
        onPanResponderMove: (e) => {
          const distance = touchDistance(e);
          if (!distance) return;
          if (!pinchStart.current.distance) {
            // Second finger landed after the gesture started.
            pinchStart.current = { distance, zoom: zoomRef.current };
            return;
          }
          const scale = distance / pinchStart.current.distance;
          applyZoom(pinchStart.current.zoom + Math.log2(scale) * PINCH_SENSITIVITY);
        },
        onPanResponderRelease: () => revealZoomSlider(true),
        onPanResponderTerminate: () => revealZoomSlider(true),
      }),
    [applyZoom, revealZoomSlider]
  );

  const sliderResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          revealZoomSlider(false);
          applyZoom(e.nativeEvent.locationX / sliderWidthRef.current);
        },
        onPanResponderMove: (e) => applyZoom(e.nativeEvent.locationX / sliderWidthRef.current),
        onPanResponderRelease: () => revealZoomSlider(true),
        onPanResponderTerminate: () => revealZoomSlider(true),
      }),
    [applyZoom, revealZoomSlider]
  );

  const handleSliderLayout = useCallback((e: LayoutChangeEvent) => {
    sliderWidthRef.current = Math.max(1, e.nativeEvent.layout.width);
  }, []);

  // ---- Controls ---------------------------------------------------------------

  const toggleFacing = useCallback(() => {
    tapHaptic();
    // Don't wait for onCameraReady here: iOS only fires it once per session.
    setIsSwitching(true);
    zoomRef.current = 0;
    setZoom(0);
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
    setTimeout(() => {
      if (isMountedRef.current) setIsSwitching(false);
    }, 450);
  }, []);

  const toggleFlash = useCallback(() => {
    tapHaptic();
    setFlash((current) => (current === 'off' ? 'on' : current === 'on' ? 'auto' : 'off'));
  }, []);

  // ---- Capture ----------------------------------------------------------------

  const playCaptureFeedback = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    flashAnim.setValue(0.75);
    Animated.timing(flashAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start();
    shutterScale.setValue(0.88);
    Animated.spring(shutterScale, {
      toValue: 1,
      friction: 4,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [flashAnim, shutterScale]);

  const persistShot = useCallback(
    async (
      shotPromise: Promise<CapturedShot>,
      meta: { photoId: string; capturedAt: string }
    ) => {
      let savedFileUri: string | null = null;
      try {
        const shot = await shotPromise;
        savedFileUri = await saveOriginalPhoto(shot.uri, reportId, meta.photoId);

        // Location snapshot taken now is at most a few seconds after the shutter.
        let { location, address } = locationService.getLatestLocationSnapshot();
        if (!location && locationService.getPermissionStatus() === 'granted') {
          const resolved = await locationService.ensureLocation(2000);
          location = resolved.location;
          address = resolved.address;
        }

        const newPhoto: Photo = {
          id: meta.photoId,
          number: nextPhotoNumberRef.current,
          originalUri: savedFileUri,
          capturedAt: meta.capturedAt,
          width: shot.width || null,
          height: shot.height || null,
          latitude: location?.latitude ?? null,
          longitude: location?.longitude ?? null,
          address: address ?? null,
          location: location ?? null,
        };

        await addPhotoToReport(reportId, newPhoto);
        nextPhotoNumberRef.current += 1;
        if (isMountedRef.current) setLastThumbUri(savedFileUri);
      } catch (err) {
        console.error('[CapturePipeline] Photo could not be saved:', err);
        if (savedFileUri) await deletePhotoFile(savedFileUri);
        if (isMountedRef.current) showNotice('A photo could not be saved. Please retake it.');
      } finally {
        if (isMountedRef.current) setPendingCount((prev) => Math.max(0, prev - 1));
      }
    },
    [reportId, addPhotoToReport, showNotice]
  );

  const handleCapture = useCallback(async () => {
    if (!isCameraReady || isSwitching || isCapturingRef.current || !cameraRef.current || !report) {
      return;
    }
    isCapturingRef.current = true;

    // Instant feedback, before the camera has even returned.
    playCaptureFeedback();
    setPendingCount((prev) => prev + 1);

    const meta = { photoId: generateId('photo'), capturedAt: getNowIso() };
    const shot = createDeferred<CapturedShot>(PHOTO_SAVE_TIMEOUT_MS);

    // Queue the save now so photos are numbered in shutter order, even if the
    // camera finishes processing them out of order.
    persistenceQueueRef.current = persistenceQueueRef.current.then(() =>
      persistShot(shot.promise, meta)
    );

    try {
      // With onPictureSaved, the promise resolves as soon as the sensor captures
      // (Android) and JPEG processing continues in the background, so the shutter
      // unlocks much sooner for the next shot.
      await cameraRef.current.takePictureAsync({
        quality: 0.85,
        shutterSound: false,
        onPictureSaved: (picture) => {
          if (picture?.uri) {
            shot.resolve({ uri: picture.uri, width: picture.width, height: picture.height });
          }
          else {
            shot.reject(new Error('Camera returned no photo'));
          }
        },
      });
    } catch (error) {
      console.error('[CaptureScreen] Shutter capture error:', error);
      shot.reject(error);
    } finally {
      isCapturingRef.current = false;
    }
  }, [isCameraReady, isSwitching, report, playCaptureFeedback, persistShot]);

  const photoCount = (report?.photos?.length ?? 0) + pendingCount;
  const latestSavedPhoto = report?.photos?.[report.photos.length - 1];
  const thumbUri =
    lastThumbUri ?? (latestSavedPhoto ? normalizeFileUri(latestSavedPhoto.originalUri) : null);

  // ---- Render: permission & error states --------------------------------------

  if (!cameraPermission) {
    return (
      <ScreenWrapper style={styles.darkBackground} backgroundColor="#000000" statusBarStyle="light">
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      </ScreenWrapper>
    );
  }

  if (!cameraPermission.granted || cameraError) {
    const isPermissionIssue = !cameraPermission.granted;
    const mustUseSettings = isPermissionIssue && !cameraPermission.canAskAgain;
    return (
      <ScreenWrapper>
        <View style={[styles.container, { paddingHorizontal: theme.spacing.lg }]}>
          <Card variant="glass" padding="xl" style={styles.permissionCard}>
            <View style={[styles.iconCircle, { backgroundColor: theme.colors.primaryMuted }]}>
              <CameraIcon
                size={32}
                color={isPermissionIssue ? theme.colors.primary : theme.colors.error}
                strokeWidth={1.8}
              />
            </View>
            <Text variant="title2" weight="700" align="center" style={styles.permissionTitle}>
              {isPermissionIssue ? 'Camera Access Required' : 'Camera Error'}
            </Text>
            <Text variant="body" color="secondary" align="center" style={styles.permissionDescription}>
              {isPermissionIssue
                ? mustUseSettings
                  ? 'Camera access is turned off for PhotoProof. Enable it in Settings to capture photos.'
                  : 'PhotoProof needs the camera to capture photo documentation.'
                : cameraError}
            </Text>
            <View style={styles.permissionActions}>
              <Button
                title={
                  isPermissionIssue
                    ? mustUseSettings
                      ? 'Open Settings'
                      : 'Allow Camera Access'
                    : 'Retry Camera'
                }
                variant="primary"
                size="lg"
                fullWidth
                onPress={() => {
                  if (!isPermissionIssue) {
                    setCameraError(null);
                    setIsCameraReady(false);
                    setCameraKey((k) => k + 1);
                  } else if (mustUseSettings) {
                    Linking.openSettings();
                  } else {
                    requestCameraPermission();
                  }
                }}
              />
              <Button
                title="Back to Report"
                variant="ghost"
                size="md"
                fullWidth
                style={{ marginTop: theme.spacing.sm }}
                onPress={handleDone}
              />
            </View>
          </Card>
        </View>
      </ScreenWrapper>
    );
  }

  // ---- Render: camera ---------------------------------------------------------

  const isShutterDisabled = !isCameraReady || isSwitching;
  const isZoomed = zoom > 0;
  const showSlider = isZoomSliderVisible || isZoomed;

  return (
    <View style={styles.blackContainer}>
      <StatusBar style="light" />

      <CameraView
        key={cameraKey}
        ref={cameraRef}
        facing={facing}
        flash={flash}
        zoom={toNativeZoom(zoom)}
        animateShutter={false}
        responsiveOrientationWhenOrientationLocked
        onCameraReady={() => setIsCameraReady(true)}
        onMountError={(e) => setCameraError(e.message || 'Camera failed to initialize')}
        style={StyleSheet.absoluteFill}
      />

      {/* Pinch-to-zoom surface (two fingers only, so taps reach the controls) */}
      <View style={StyleSheet.absoluteFill} {...pinchResponder.panHandlers} />

      {(!isCameraReady || isSwitching) && (
        <View style={styles.cameraInitOverlay} pointerEvents="none">
          {!isCameraReady && (
            <>
              <ActivityIndicator size="large" color="#FFFFFF" />
              <Text variant="footnote" color="#FFFFFF" weight="600" style={styles.cameraInitText}>
                Starting camera...
              </Text>
            </>
          )}
        </View>
      )}

      {/* Quick white flash on capture */}
      <Animated.View pointerEvents="none" style={[styles.flashOverlay, { opacity: flashAnim }]} />

      {/* Top controls */}
      <View style={[styles.topOverlay, { top: insets.top + 8 }]}>
        <View style={styles.topControlsRow}>
          <Pressable
            onPress={handleDone}
            disabled={isFinalizing}
            hitSlop={12}
            accessibilityLabel="Done capturing"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.circularGlassButton,
              { opacity: pressed || isFinalizing ? 0.6 : 1, transform: [{ scale: pressed ? 0.94 : 1 }] },
            ]}
          >
            {isFinalizing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <CloseIcon size={18} color="#FFFFFF" strokeWidth={2.4} />
            )}
          </Pressable>

          <View style={styles.centerInfoPill}>
            <Pressable
              onPress={toggleFlash}
              hitSlop={10}
              accessibilityLabel={`Flash ${flash}`}
              accessibilityRole="button"
              style={({ pressed }) => [styles.infoPillButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <FlashIcon size={13} color={flash !== 'off' ? '#FF5500' : '#FFFFFF'} strokeWidth={2.2} />
              <Text variant="caption2" weight="700" color="#FFFFFF" style={styles.flashText}>
                {flash === 'on' ? 'ON' : flash === 'auto' ? 'AUTO' : 'OFF'}
              </Text>
            </Pressable>
            <View style={styles.infoPillDivider} />
            <View style={styles.infoPillGps}>
              <View
                style={[
                  styles.gpsDot,
                  {
                    backgroundColor:
                      locationStatus === 'granted'
                        ? '#34C759'
                        : locationStatus === 'undetermined'
                          ? '#FFCC00'
                          : '#8E8E93',
                  },
                ]}
              />
              <Text variant="caption2" color="#FFFFFF" weight="600">
                {locationStatus === 'granted'
                  ? 'GPS'
                  : locationStatus === 'undetermined'
                    ? 'GPS…'
                    : 'NO GPS'}
              </Text>
            </View>
          </View>

          <Pressable
            onPress={toggleFacing}
            disabled={isSwitching}
            hitSlop={12}
            accessibilityLabel="Switch camera"
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.circularGlassButton,
              { opacity: pressed ? 0.7 : 1, transform: [{ scale: pressed ? 0.92 : 1 }] },
            ]}
          >
            <SwitchCameraIcon size={20} color="#FFFFFF" strokeWidth={2} />
          </Pressable>
        </View>

        <View style={styles.reportNamePill}>
          <Text variant="caption2" weight="600" color="#FFFFFF" numberOfLines={1}>
            {report?.name || 'Report'}
          </Text>
        </View>

        {notice ? (
          <View style={styles.noticePill}>
            <Text variant="caption1" weight="600" color="#FFFFFF" align="center">
              {notice}
            </Text>
          </View>
        ) : null}
      </View>

      {/* Bottom controls */}
      <View style={[styles.bottomOverlay, { bottom: Math.max(insets.bottom, 16) + 12 }]}>
        {showSlider && (
          <View style={styles.zoomSliderRow}>
            <Pressable
              onPress={resetZoom}
              hitSlop={8}
              accessibilityLabel="Reset zoom"
              accessibilityRole="button"
              style={({ pressed }) => [styles.zoomResetChip, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Text variant="caption2" weight="800" color={isZoomed ? '#FFFFFF' : '#FF5500'}>
                1×
              </Text>
            </Pressable>
            <View
              style={styles.zoomTrackTouchArea}
              onLayout={handleSliderLayout}
              {...sliderResponder.panHandlers}
            >
              <View style={styles.zoomTrack} pointerEvents="none">
                <View style={[styles.zoomTrackFill, { width: `${zoom * 100}%` }]} />
              </View>
              <View
                pointerEvents="none"
                style={[styles.zoomThumb, { left: `${zoom * 100}%` }]}
              />
            </View>
            <Text variant="caption2" weight="700" color="#FFFFFF" style={styles.zoomMaxLabel}>
              MAX
            </Text>
          </View>
        )}

        <View style={styles.glassDockContainer}>
          {/* Last photo + count; tapping returns to the report */}
          <Pressable
            onPress={handleDone}
            disabled={isFinalizing || photoCount === 0}
            accessibilityLabel={`${photoCount} photos. Open report`}
            accessibilityRole="button"
            style={({ pressed }) => [styles.dockSideZone, { opacity: pressed ? 0.7 : 1 }]}
          >
            {thumbUri ? (
              <Image
                source={{ uri: thumbUri }}
                style={styles.dockThumb}
                contentFit="cover"
                transition={150}
              />
            ) : null}
            <View style={[styles.dockCountBadge, !thumbUri && styles.dockCountBadgeCentered]}>
              <Text variant="caption1" weight="800" color="#FFFFFF">
                {photoCount}
              </Text>
            </View>
            {pendingCount > 0 && (
              <View style={styles.dockPendingDot}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </Pressable>

          <Animated.View style={{ transform: [{ scale: shutterScale }] }}>
            <Pressable
              onPress={handleCapture}
              disabled={isShutterDisabled}
              accessibilityLabel="Capture photo"
              accessibilityRole="button"
              style={[styles.shutterOuterRing, isShutterDisabled && styles.shutterDisabled]}
            >
              {({ pressed }) => (
                <View
                  style={[
                    styles.shutterInnerCircle,
                    pressed && styles.shutterInnerPressed,
                    isShutterDisabled && styles.shutterInnerDisabled,
                  ]}
                />
              )}
            </Pressable>
          </Animated.View>

          {/* Zoom: shows the slider, or resets when zoomed */}
          <Pressable
            onPress={() => {
              if (isZoomed) {
                resetZoom();
              } else {
                tapHaptic();
                revealZoomSlider(true);
              }
            }}
            accessibilityLabel={isZoomed ? 'Reset zoom' : 'Show zoom slider'}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.dockSideZone,
              isZoomed && styles.dockSideZoneActive,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text variant="subhead" weight="700" color={isZoomed ? '#FF5500' : '#FFFFFF'}>
              {isZoomed ? `${Math.round(zoom * 100)}%` : '1×'}
            </Text>
            <Text variant="caption2" weight="600" color="#8E8E93" style={styles.dockSideSubtext}>
              {isZoomed ? 'Reset' : 'Zoom'}
            </Text>
          </Pressable>
        </View>

        {!showSlider && (
          <Text variant="caption2" color="rgba(255,255,255,0.55)" align="center" style={styles.hintText}>
            Pinch to zoom
          </Text>
        )}
      </View>
    </View>
  );
};

const GLASS = 'rgba(20, 20, 24, 0.65)';
const GLASS_BORDER = 'rgba(255, 255, 255, 0.18)';

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  blackContainer: { flex: 1, backgroundColor: '#000000' },
  darkBackground: { backgroundColor: '#000000' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  permissionCard: { alignItems: 'center' },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  permissionTitle: { marginBottom: 8 },
  permissionDescription: { marginBottom: 24, maxWidth: 280, lineHeight: 22 },
  permissionActions: { width: '100%', marginTop: 8 },
  flashOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#FFFFFF', zIndex: 30 },
  cameraInitOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  cameraInitText: { marginTop: 12, letterSpacing: 0.3 },
  topOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  topControlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  circularGlassButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: GLASS,
    borderWidth: 0.5,
    borderColor: GLASS_BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerInfoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GLASS,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: GLASS_BORDER,
    gap: 8,
  },
  infoPillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  flashText: { fontSize: 11, letterSpacing: 0.5, minWidth: 30 },
  infoPillDivider: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  infoPillGps: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  gpsDot: { width: 6, height: 6, borderRadius: 3 },
  reportNamePill: {
    marginTop: 8,
    maxWidth: '80%',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  noticePill: {
    marginTop: 10,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    maxWidth: '90%',
  },
  bottomOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 20,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  zoomSliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    maxWidth: 380,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: GLASS,
    borderRadius: 22,
    borderWidth: 0.5,
    borderColor: GLASS_BORDER,
  },
  zoomResetChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  zoomTrackTouchArea: {
    flex: 1,
    height: 34,
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  zoomTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    overflow: 'hidden',
  },
  zoomTrackFill: { height: '100%', backgroundColor: '#FF5500' },
  zoomThumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    marginLeft: -9,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#FF5500',
  },
  zoomMaxLabel: { opacity: 0.7, fontSize: 10, letterSpacing: 0.5 },
  glassDockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(20, 20, 24, 0.7)',
    borderRadius: 28,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 18,
    paddingVertical: 12,
    width: '100%',
    maxWidth: 380,
  },
  dockSideZone: {
    width: 64,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  dockSideZoneActive: { borderColor: '#FF5500' },
  dockThumb: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  dockCountBadge: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    minWidth: 22,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dockCountBadgeCentered: {
    position: 'relative',
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  dockPendingDot: {
    position: 'absolute',
    top: 4,
    left: 4,
    transform: [{ scale: 0.7 }],
  },
  dockSideSubtext: { marginTop: 1 },
  shutterOuterRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shutterDisabled: { opacity: 0.5 },
  shutterInnerCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  shutterInnerPressed: { backgroundColor: 'rgba(255, 255, 255, 0.75)', transform: [{ scale: 0.92 }] },
  shutterInnerDisabled: { backgroundColor: 'rgba(255, 255, 255, 0.4)' },
  hintText: { marginTop: 8, letterSpacing: 0.3 },
});
