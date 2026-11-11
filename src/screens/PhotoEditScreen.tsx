import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  Pressable,
  PanResponder,
  Alert,
  ActivityIndicator,
  LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useReports } from '../context/ReportsContext';
import { Text } from '../components/common/Text';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { ScreenWrapper } from '../components/common/ScreenWrapper';
import { normalizeFileUri } from '../services/storage/fileStorage';
import { RotateIcon, ResetIcon, ShieldCheckIcon } from '../components/icons/Icons';
import { PhotoCrop, CropAspectRatio } from '../models/Photo';
import { computeCropGeometry, hasExactCrop, normalizeRotation, rotatedSize } from '../utils/crop';
import type { PhotoEditScreenProps } from '../navigation/types';

const ASPECT_RATIO_CONFIGS: { id: CropAspectRatio; label: string; ratio?: number }[] = [
  { id: 'free', label: 'Free' },
  { id: 'original', label: 'Original' },
  { id: '1:1', label: '1:1', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
  { id: '16:9', label: '16:9', ratio: 16 / 9 },
];

/** Smallest crop edge, as a fraction of the photo. */
const MIN_SIZE = 0.12;
/** Finger distance (px) from a corner that grabs it. */
const HANDLE_RADIUS = 44;

type Box = { x: number; y: number; w: number; h: number };
type Handle = 'TL' | 'TR' | 'BL' | 'BR' | 'CENTER' | null;

const FULL_BOX: Box = { x: 0, y: 0, w: 1, h: 1 };

/** Pixel aspect ratio a preset locks to (null = free). */
const lockedRatio = (aspect: CropAspectRatio, containerAspect: number): number | null => {
  if (aspect === 'free') return null;
  if (aspect === 'original') return containerAspect;
  return ASPECT_RATIO_CONFIGS.find((c) => c.id === aspect)?.ratio ?? null;
};

/**
 * Largest centred box with the given pixel aspect ratio.
 * `containerAspect` is the rotated photo's width / height.
 */
const centeredBoxForRatio = (pixelRatio: number, containerAspect: number): Box => {
  // In normalized units, w/h must equal pixelRatio / containerAspect.
  const k = pixelRatio / containerAspect;
  let w = 1;
  let h = w / k;
  if (h > 1) {
    h = 1;
    w = k;
  }
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
};

const selectionHaptic = () => {
  Haptics.selectionAsync().catch(() => {});
};

export const PhotoEditScreen: React.FC<PhotoEditScreenProps> = ({ route, navigation }) => {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { getPhoto, updatePhotoCrop } = useReports();
  const { reportId, photoId } = route.params;

  const photo = getPhoto(reportId, photoId);
  const resolvedUri = photo ? normalizeFileUri(photo.originalUri) : null;
  const existingCrop = photo?.crop;

  // Original photo pixel size: from the crop, the capture record, or the image itself.
  const [sourceSize, setSourceSize] = useState<{ width: number; height: number } | null>(() => {
    if (hasExactCrop(existingCrop)) {
      return { width: existingCrop.sourceWidth, height: existingCrop.sourceHeight };
    }
    if (photo?.width && photo?.height) return { width: photo.width, height: photo.height };
    return null;
  });

  const [rotation, setRotation] = useState(() => normalizeRotation(existingCrop?.rotation));
  const [activeAspect, setActiveAspect] = useState<CropAspectRatio>(
    existingCrop?.aspectRatio || 'free'
  );
  // Older crops were measured against a different preview, so those start from full frame.
  const [cropBox, setCropBox] = useState<Box>(() =>
    hasExactCrop(existingCrop)
      ? { x: existingCrop.x, y: existingCrop.y, w: existingCrop.width, h: existingCrop.height }
      : FULL_BOX
  );
  const [isSaving, setIsSaving] = useState(false);
  const [area, setArea] = useState({ width: 0, height: 0 });

  // Displayed container = rotated photo fitted into the available area.
  const containerAspect = useMemo(() => {
    if (!sourceSize) return 1;
    const r = rotatedSize(sourceSize.width, sourceSize.height, rotation);
    return r.width / r.height;
  }, [sourceSize, rotation]);

  const container = useMemo(() => {
    if (!sourceSize || !area.width || !area.height) return { width: 0, height: 0 };
    let width = area.width;
    let height = width / containerAspect;
    if (height > area.height) {
      height = area.height;
      width = height * containerAspect;
    }
    return { width: Math.floor(width), height: Math.floor(height) };
  }, [sourceSize, area, containerAspect]);

  const imageGeometry = sourceSize
    ? computeCropGeometry(
        { x: 0, y: 0, width: 1, height: 1, rotation },
        sourceSize.width,
        sourceSize.height
      )
    : null;

  // Latest values for the gesture handlers (created once).
  const live = useRef({ cropBox, container, activeAspect, containerAspect });
  live.current = { cropBox, container, activeAspect, containerAspect };

  const handleSelectAspect = useCallback(
    (aspectId: CropAspectRatio) => {
      selectionHaptic();
      setActiveAspect(aspectId);
      const ratio = lockedRatio(aspectId, containerAspect);
      if (ratio) setCropBox(centeredBoxForRatio(ratio, containerAspect));
    },
    [containerAspect]
  );

  const handleRotate = useCallback(() => {
    selectionHaptic();
    const next = (rotation + 90) % 360;
    setRotation(next);
    // The frame changes shape when rotating, so re-fit the crop to it.
    if (sourceSize) {
      const r = rotatedSize(sourceSize.width, sourceSize.height, next);
      const nextAspect = r.width / r.height;
      const ratio = lockedRatio(activeAspect, nextAspect);
      setCropBox(ratio ? centeredBoxForRatio(ratio, nextAspect) : FULL_BOX);
    } else {
      setCropBox(FULL_BOX);
    }
  }, [rotation, sourceSize, activeAspect]);

  const handleReset = useCallback(() => {
    selectionHaptic();
    setCropBox(FULL_BOX);
    setRotation(0);
    setActiveAspect('free');
  }, []);

  const handleSave = useCallback(async () => {
    if (isSaving || !photo || !sourceSize) return;
    setIsSaving(true);
    try {
      const isFullFrame =
        cropBox.x <= 0.005 &&
        cropBox.y <= 0.005 &&
        cropBox.w >= 0.995 &&
        cropBox.h >= 0.995 &&
        rotation === 0;

      const finalCrop: PhotoCrop | null = isFullFrame
        ? null
        : {
            x: Math.max(0, Math.min(1, cropBox.x)),
            y: Math.max(0, Math.min(1, cropBox.y)),
            width: Math.max(MIN_SIZE, Math.min(1, cropBox.w)),
            height: Math.max(MIN_SIZE, Math.min(1, cropBox.h)),
            rotation,
            aspectRatio: activeAspect,
            sourceWidth: sourceSize.width,
            sourceHeight: sourceSize.height,
          };

      await updatePhotoCrop(reportId, photoId, finalCrop);
      navigation.goBack();
    } catch (err) {
      console.error('[PhotoEditScreen] Error saving crop:', err);
      Alert.alert('Error', 'Unable to save photo crop settings.');
      setIsSaving(false);
    }
  }, [
    isSaving,
    photo,
    sourceSize,
    cropBox,
    rotation,
    activeAspect,
    updatePhotoCrop,
    reportId,
    photoId,
    navigation,
  ]);

  // ---- Gestures ---------------------------------------------------------------

  const activeHandle = useRef<Handle>(null);
  const dragStart = useRef<Box>(FULL_BOX);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (evt) => {
          const { locationX, locationY } = evt.nativeEvent;
          const { cropBox: box, container: c } = live.current;
          dragStart.current = { ...box };

          const left = box.x * c.width;
          const top = box.y * c.height;
          const right = left + box.w * c.width;
          const bottom = top + box.h * c.height;
          const near = (px: number, py: number) =>
            Math.hypot(locationX - px, locationY - py) < HANDLE_RADIUS;

          if (near(left, top)) activeHandle.current = 'TL';
          else if (near(right, top)) activeHandle.current = 'TR';
          else if (near(left, bottom)) activeHandle.current = 'BL';
          else if (near(right, bottom)) activeHandle.current = 'BR';
          else if (locationX >= left && locationX <= right && locationY >= top && locationY <= bottom)
            activeHandle.current = 'CENTER';
          else activeHandle.current = null;
        },
        onPanResponderMove: (_evt, g) => {
          const handle = activeHandle.current;
          const { container: c, activeAspect: aspect, containerAspect: cAspect } = live.current;
          if (!handle || !c.width || !c.height) return;

          const s = dragStart.current;
          const dx = g.dx / c.width;
          const dy = g.dy / c.height;

          if (handle === 'CENTER') {
            setCropBox({
              x: Math.max(0, Math.min(1 - s.w, s.x + dx)),
              y: Math.max(0, Math.min(1 - s.h, s.y + dy)),
              w: s.w,
              h: s.h,
            });
            return;
          }

          // The corner opposite the dragged one stays fixed.
          const growsLeft = handle === 'TL' || handle === 'BL';
          const growsUp = handle === 'TL' || handle === 'TR';
          const anchorX = growsLeft ? s.x + s.w : s.x;
          const anchorY = growsUp ? s.y + s.h : s.y;
          const maxW = growsLeft ? anchorX : 1 - anchorX;
          const maxH = growsUp ? anchorY : 1 - anchorY;

          let w = Math.max(MIN_SIZE, Math.min(maxW, s.w + (growsLeft ? -dx : dx)));
          let h = Math.max(MIN_SIZE, Math.min(maxH, s.h + (growsUp ? -dy : dy)));

          const ratio = lockedRatio(aspect, cAspect);
          if (ratio) {
            // Keep normalized w/h = ratio / containerAspect, following the larger drag.
            const k = ratio / cAspect;
            if (w / k > h) h = w / k;
            else w = h * k;
            if (h > maxH) {
              h = maxH;
              w = h * k;
            }
            if (w > maxW) {
              w = maxW;
              h = w / k;
            }
          }

          setCropBox({
            x: growsLeft ? anchorX - w : anchorX,
            y: growsUp ? anchorY - h : anchorY,
            w,
            h,
          });
        },
        onPanResponderRelease: () => {
          activeHandle.current = null;
        },
        onPanResponderTerminate: () => {
          activeHandle.current = null;
        },
      }),
    []
  );

  const onAreaLayout = useCallback((e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  }, []);

  if (!photo || !resolvedUri) {
    return (
      <ScreenWrapper>
        <Header title="Edit Photo" onBack={() => navigation.goBack()} />
        <View style={styles.centerEmpty}>
          <Text variant="body" color="secondary">
            Photo not found.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  const cropLeft = cropBox.x * container.width;
  const cropTop = cropBox.y * container.height;
  const cropWidth = cropBox.w * container.width;
  const cropHeight = cropBox.h * container.height;

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="Edit & Crop Photo"
          onBack={() => navigation.goBack()}
          backTitle="Cancel"
          rightAction={
            <Pressable
              onPress={handleReset}
              hitSlop={12}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text variant="subhead" weight="600" color="accent">
                Reset
              </Text>
            </Pressable>
          }
        />

        <View style={styles.integrityBanner}>
          <ShieldCheckIcon size={14} color="#34C759" strokeWidth={2} />
          <Text variant="caption2" weight="600" color="secondary" style={styles.integrityText}>
            Original photo preserved · Edits apply to PDF export only
          </Text>
        </View>

        {/* Crop viewport */}
        <View style={styles.viewportArea} onLayout={onAreaLayout}>
          {!sourceSize ? (
            <>
              {/* Load once just to learn the photo's dimensions. */}
              <Image
                source={{ uri: resolvedUri }}
                style={styles.hiddenProbe}
                onLoad={(e) => setSourceSize({ width: e.source.width, height: e.source.height })}
              />
              <ActivityIndicator color={theme.colors.primary} />
            </>
          ) : container.width > 0 && imageGeometry ? (
            <View
              style={[styles.imageContainer, { width: container.width, height: container.height }]}
              {...panResponder.panHandlers}
            >
              {/* Overlays ignore touches so locationX/Y are always container-relative. */}
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Image
                  source={{ uri: resolvedUri }}
                  contentFit="fill"
                  cachePolicy="memory-disk"
                  style={{
                    position: 'absolute',
                    left: `${imageGeometry.image.left}%`,
                    top: `${imageGeometry.image.top}%`,
                    width: `${imageGeometry.image.width}%`,
                    height: `${imageGeometry.image.height}%`,
                    transform: [{ rotate: `${rotation}deg` }],
                  }}
                />

                <View style={[styles.darkMask, { top: 0, left: 0, right: 0, height: cropTop }]} />
                <View
                  style={[
                    styles.darkMask,
                    { top: cropTop + cropHeight, left: 0, right: 0, bottom: 0 },
                  ]}
                />
                <View
                  style={[
                    styles.darkMask,
                    { top: cropTop, left: 0, width: cropLeft, height: cropHeight },
                  ]}
                />
                <View
                  style={[
                    styles.darkMask,
                    { top: cropTop, left: cropLeft + cropWidth, right: 0, height: cropHeight },
                  ]}
                />

                <View
                  style={[
                    styles.cropFrame,
                    { top: cropTop, left: cropLeft, width: cropWidth, height: cropHeight },
                  ]}
                >
                  <View style={[styles.gridLineH, { top: '33.33%' }]} />
                  <View style={[styles.gridLineH, { top: '66.66%' }]} />
                  <View style={[styles.gridLineV, { left: '33.33%' }]} />
                  <View style={[styles.gridLineV, { left: '66.66%' }]} />
                  <View style={[styles.cornerHandle, styles.cornerTL]} />
                  <View style={[styles.cornerHandle, styles.cornerTR]} />
                  <View style={[styles.cornerHandle, styles.cornerBL]} />
                  <View style={[styles.cornerHandle, styles.cornerBR]} />
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* Aspect ratio chips */}
        <View style={styles.aspectRow}>
          {ASPECT_RATIO_CONFIGS.map((item) => {
            const isSelected = activeAspect === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() => handleSelectAspect(item.id)}
                disabled={!sourceSize}
                style={({ pressed }) => [
                  styles.aspectChip,
                  {
                    backgroundColor: isSelected
                      ? 'rgba(255, 85, 0, 0.15)'
                      : theme.colors.surfaceSubtle,
                    borderColor: isSelected ? '#FF5500' : theme.colors.borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  variant="caption1"
                  weight={isSelected ? '700' : '500'}
                  color={isSelected ? 'accent' : 'secondary'}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Bottom bar */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.colors.glassSurface,
              borderTopColor: theme.colors.borderSubtle,
              paddingBottom: Math.max(insets.bottom, 16) + 8,
            },
          ]}
        >
          <View style={styles.actionButtonsRow}>
            <Pressable
              onPress={handleRotate}
              disabled={!sourceSize}
              hitSlop={12}
              accessibilityLabel="Rotate photo"
              accessibilityRole="button"
              style={({ pressed }) => [styles.toolButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <RotateIcon size={20} color={theme.colors.textPrimary} strokeWidth={2} />
              <Text variant="caption2" color="secondary" style={styles.toolButtonText}>
                Rotate{rotation ? ` (${rotation}°)` : ''}
              </Text>
            </Pressable>

            <Pressable
              onPress={handleReset}
              hitSlop={12}
              accessibilityLabel="Reset crop"
              accessibilityRole="button"
              style={({ pressed }) => [styles.toolButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <ResetIcon size={18} color={theme.colors.textSecondary} strokeWidth={2} />
              <Text variant="caption2" color="secondary" style={styles.toolButtonText}>
                Reset
              </Text>
            </Pressable>
          </View>

          <Button
            title="Done · Apply to PDF"
            variant="primary"
            size="lg"
            loading={isSaving}
            disabled={!sourceSize}
            fullWidth
            onPress={handleSave}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  centerEmpty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  integrityBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(52, 199, 89, 0.08)',
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  integrityText: { letterSpacing: 0.2 },
  viewportArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
  },
  hiddenProbe: { width: 1, height: 1, opacity: 0, position: 'absolute' },
  imageContainer: {
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000000',
  },
  darkMask: { position: 'absolute', backgroundColor: 'rgba(0, 0, 0, 0.6)' },
  cropFrame: { position: 'absolute', borderColor: '#FFFFFF', borderWidth: 1.5 },
  gridLineH: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  gridLineV: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  cornerHandle: { position: 'absolute', width: 20, height: 20, borderColor: '#FF5500' },
  cornerTL: { top: -3, left: -3, borderTopWidth: 4, borderLeftWidth: 4 },
  cornerTR: { top: -3, right: -3, borderTopWidth: 4, borderRightWidth: 4 },
  cornerBL: { bottom: -3, left: -3, borderBottomWidth: 4, borderLeftWidth: 4 },
  cornerBR: { bottom: -3, right: -3, borderBottomWidth: 4, borderRightWidth: 4 },
  aspectRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  aspectChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1 },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  actionButtonsRow: { flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center' },
  toolButton: { alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 16 },
  toolButtonText: { fontSize: 11 },
});
