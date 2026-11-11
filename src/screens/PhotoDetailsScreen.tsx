import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
} from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../hooks/useTheme';
import { useReports } from '../context/ReportsContext';
import { Text } from '../components/common/Text';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Header } from '../components/common/Header';
import { ScreenWrapper } from '../components/common/ScreenWrapper';
import { formatDateTime } from '../utils/date';
import { formatPhotoNumber } from '../utils/formatters';
import { PHOTO_CATEGORIES, PhotoCategory } from '../models/Photo';
import { normalizeFileUri } from '../services/storage/fileStorage';
import { LocationPinIcon, CropIcon } from '../components/icons/Icons';
import type { PhotoDetailsScreenProps } from '../navigation/types';

export const PhotoDetailsScreen: React.FC<PhotoDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const { theme } = useTheme();
  const { getPhoto, updatePhotoMetadata } = useReports();
  const { reportId, photoId } = route.params;

  const photo = getPhoto(reportId, photoId);

  const [category, setCategory] = useState<PhotoCategory | null>(
    photo?.category || null
  );
  const [note, setNote] = useState<string>(photo?.note || '');
  const [noteFocused, setNoteFocused] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Latest edits, read by the leave-screen listener below without re-subscribing.
  const draftRef = useRef({ note, category, photo });
  draftRef.current = { note, category, photo };

  // Auto-save unsaved edits however the user leaves: header back button,
  // iOS swipe-back gesture, or Android hardware back.
  useEffect(() => {
    return navigation.addListener('beforeRemove', () => {
      const { note: draftNote, category: draftCategory, photo: current } = draftRef.current;
      if (!current) return;
      const trimmedNote = draftNote.trim() || null;
      if (draftCategory !== (current.category || null) || trimmedNote !== (current.note || null)) {
        updatePhotoMetadata(reportId, photoId, { category: draftCategory, note: trimmedNote }).catch(
          (err) => console.warn('[PhotoDetailsScreen] Error auto-saving on leave:', err)
        );
      }
    });
  }, [navigation, updatePhotoMetadata, reportId, photoId]);

  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
  }, []);

  const handleBack = useCallback(() => {
    Keyboard.dismiss();
    navigation.goBack();
  }, [navigation]);

  const handleSelectCategory = useCallback((cat: PhotoCategory) => {
    setCategory((prev) => (prev === cat ? null : cat));
    setSavedSuccess(false);
  }, []);

  const handleSave = useCallback(async () => {
    if (!photo || isSaving) return;
    Keyboard.dismiss();
    setIsSaving(true);
    try {
      await updatePhotoMetadata(reportId, photoId, {
        category,
        note: note.trim() || null,
      });
      setSavedSuccess(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err) {
      console.error('[PhotoDetailsScreen] Error saving photo metadata:', err);
    } finally {
      setIsSaving(false);
    }
  }, [photo, isSaving, updatePhotoMetadata, reportId, photoId, category, note]);

  const resolvedImageUri = useMemo(
    () => (photo ? normalizeFileUri(photo.originalUri) : ''),
    [photo?.originalUri]
  );

  const hasLocation = useMemo(
    () => !!(photo?.latitude && photo?.longitude) || !!photo?.location,
    [photo?.latitude, photo?.longitude, photo?.location]
  );
  const latitude = photo?.latitude ?? photo?.location?.latitude;
  const longitude = photo?.longitude ?? photo?.location?.longitude;
  const formattedDateTime = useMemo(
    () => (photo?.capturedAt ? formatDateTime(photo.capturedAt) : ''),
    [photo?.capturedAt]
  );

  if (!photo) {
    return (
      <ScreenWrapper>
        <Header title="Photo Not Found" onBack={handleBack} backTitle="Report" />
        <View style={styles.centerContainer}>
          <Text variant="body" color="secondary">
            The requested photo could not be found.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Header */}
        <Header
          title={`Photo #${formatPhotoNumber(photo.number)}`}
          subtitle={formattedDateTime}
          onBack={handleBack}
          backTitle="Report"
          rightAction={
            <Button
              title={savedSuccess ? 'Saved' : 'Save'}
              variant={savedSuccess ? 'secondary' : 'primary'}
              size="sm"
              loading={isSaving}
              onPress={handleSave}
            />
          }
        />

        <KeyboardAvoidingView
          behavior="padding"
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: theme.spacing.lg },
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Large Original Photo Preview */}
            <View
              style={[
                styles.imageContainer,
                {
                  backgroundColor: theme.colors.surfaceSubtle,
                  borderColor: theme.colors.borderSubtle,
                },
              ]}
            >
              <Image
                source={{ uri: resolvedImageUri }}
                style={styles.mainImage}
                contentFit="contain"
                cachePolicy="memory-disk"
                transition={120}
              />
              <View style={styles.imageOverlayBadge}>
                <Text variant="caption2" weight="700" color="#FFFFFF">
                  Original • Untouched
                </Text>
              </View>
            </View>

            {/* Quick Action: Edit & Crop for PDF */}
            <View style={styles.photoActionsRow}>
              <Pressable
                onPress={() => navigation.navigate('PhotoEdit', { reportId, photoId })}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Edit and crop photo for PDF"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.editCropRowButton,
                  {
                    backgroundColor: photo?.crop
                      ? 'rgba(255, 85, 0, 0.12)'
                      : theme.colors.surfaceSubtle,
                    borderColor: photo?.crop ? '#FF5500' : theme.colors.borderSubtle,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <CropIcon
                  size={16}
                  color={photo?.crop ? '#FF5500' : theme.colors.textPrimary}
                  strokeWidth={2}
                />
                <Text
                  variant="subhead"
                  weight="600"
                  color={photo?.crop ? 'accent' : 'primary'}
                  style={{ marginLeft: 6 }}
                >
                  {photo?.crop ? 'Edit PDF Crop (Active)' : 'Edit & Crop for PDF'}
                </Text>
              </Pressable>
            </View>

            {/* Details Inspection Group */}
            <View style={styles.sectionHeaderRow}>
              <Text
                variant="caption1"
                weight="700"
                color="secondary"
                style={styles.sectionTitle}
              >
                DETAILS
              </Text>
            </View>

            <Card variant="default" padding="none" style={styles.detailsCard}>
              {/* Date & Time Row */}
              <View style={styles.tableRow}>
                <Text variant="subhead" color="secondary" style={styles.tableLabel}>
                  Date & Time
                </Text>
                <Text variant="subhead" weight="600" style={styles.tableValue}>
                  {formattedDateTime || 'Unknown'}
                </Text>
              </View>

              <View style={[styles.separator, { backgroundColor: theme.colors.borderSubtle }]} />

              {/* Location Coordinates Row */}
              <View style={styles.tableRow}>
                <Text variant="subhead" color="secondary" style={styles.tableLabel}>
                  Location
                </Text>
                {hasLocation ? (
                  <View style={styles.locationValueRow}>
                    <Text variant="subhead" weight="600" color="accent" style={{ marginRight: 4 }}>
                      {latitude?.toFixed(5)}°, {longitude?.toFixed(5)}°
                    </Text>
                    <LocationPinIcon size={16} color="#FF5500" strokeWidth={2} />
                  </View>
                ) : (
                  <Text variant="caption1" color="tertiary">
                    Location unavailable
                  </Text>
                )}
              </View>

              <View style={[styles.separator, { backgroundColor: theme.colors.borderSubtle }]} />

              {/* Address Row */}
              <View style={styles.tableRow}>
                <Text variant="subhead" color="secondary" style={styles.tableLabel}>
                  Address
                </Text>
                <Text
                  variant="subhead"
                  weight="500"
                  numberOfLines={2}
                  style={styles.tableValue}
                >
                  {photo.address || 'Address unavailable'}
                </Text>
              </View>
            </Card>

            {/* Category Selector Section */}
            <View style={styles.sectionHeaderRow}>
              <View style={styles.labelRow}>
                <Text
                  variant="caption1"
                  weight="700"
                  color="secondary"
                  style={styles.sectionTitle}
                >
                  CATEGORY
                </Text>
                {category ? (
                  <Pressable onPress={() => setCategory(null)}>
                    <Text variant="caption2" color="accent" weight="600">
                      Clear
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            <Card variant="glass" padding="md" style={styles.categoryCard}>
              <View style={styles.categoryChipsContainer}>
                {PHOTO_CATEGORIES.map((cat) => {
                  const isSelected = category === cat;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => handleSelectCategory(cat)}
                      style={({ pressed }) => [
                        styles.chip,
                        {
                          backgroundColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.surfaceSubtle,
                          borderColor: isSelected
                            ? theme.colors.primary
                            : theme.colors.borderSubtle,
                          opacity: pressed ? 0.75 : 1,
                        },
                      ]}
                    >
                      <Text
                        variant="footnote"
                        weight={isSelected ? '700' : '400'}
                        color={isSelected ? '#FFFFFF' : 'primary'}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Card>

            {/* Inspector Notes Section */}
            <View style={styles.sectionHeaderRow}>
              <Text
                variant="caption1"
                weight="700"
                color="secondary"
                style={styles.sectionTitle}
              >
                NOTES
              </Text>
            </View>

            <Card variant="glass" padding="md" style={styles.notesCard}>
              <TextInput
                value={note}
                onChangeText={(val) => {
                  setNote(val);
                  setSavedSuccess(false);
                }}
                placeholder="Water seepage, cracks, or inspection observations..."
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                numberOfLines={4}
                selectionColor="#FF5500"
                onFocus={() => setNoteFocused(true)}
                onBlur={() => setNoteFocused(false)}
                style={[
                  styles.noteInput,
                  {
                    color: theme.colors.textPrimary,
                    backgroundColor: theme.colors.surfaceSubtle,
                    borderColor: noteFocused
                      ? theme.colors.primary
                      : theme.colors.borderSubtle,
                  },
                ]}
              />
            </Card>

            {/* Bottom Save Action */}
            <View style={styles.bottomSaveWrapper}>
              <Button
                title={savedSuccess ? 'Metadata Saved' : 'Save Changes'}
                variant="primary"
                size="lg"
                fullWidth
                loading={isSaving}
                onPress={handleSave}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
    paddingTop: 8,
  },
  imageContainer: {
    width: '100%',
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 0.5,
    marginBottom: 16,
    position: 'relative',
  },
  mainImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlayBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  photoActionsRow: {
    marginBottom: 12,
  },
  editCropRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  sectionHeaderRow: {
    marginTop: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    letterSpacing: 0.5,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailsCard: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 10,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  tableLabel: {
    width: 100,
  },
  tableValue: {
    flex: 1,
    textAlign: 'right',
  },
  locationValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pinEmoji: {
    fontSize: 14,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  categoryCard: {
    marginBottom: 10,
  },
  categoryChipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  notesCard: {
    marginBottom: 10,
  },
  noteInput: {
    borderWidth: 1,
    minHeight: 80,
    borderRadius: 10,
    padding: 12,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 20,
  },
  bottomSaveWrapper: {
    marginTop: 16,
    marginBottom: 20,
  },
});
