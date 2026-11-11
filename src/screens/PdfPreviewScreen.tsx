import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from 'react-native';
import { CroppedImage } from '../components/common/CroppedImage';
import { useTheme } from '../hooks/useTheme';
import { useReports } from '../context/ReportsContext';
import { Text } from '../components/common/Text';
import { Button } from '../components/common/Button';
import { Header } from '../components/common/Header';
import { ScreenWrapper } from '../components/common/ScreenWrapper';
import { normalizeFileUri } from '../services/storage/fileStorage';
import { formatDateTime, formatDate } from '../utils/date';
import { formatPhotoNumber } from '../utils/formatters';
import { generateReportPdf, sharePdfFile } from '../services';
import {
  DocumentPdfIcon,
  ShareIcon,
  CropIcon,
  LocationPinIcon,
  ShieldCheckIcon,
  PhotoProofLogoMark,
} from '../components/icons/Icons';
import { Photo } from '../models/Photo';
import type { PdfPreviewScreenProps } from '../navigation/types';

export const PdfPreviewScreen: React.FC<PdfPreviewScreenProps> = ({
  route,
  navigation,
}) => {
  const { theme } = useTheme();
  const { getReport } = useReports();
  const { reportId } = route.params;

  const [isExporting, setIsExporting] = useState(false);
  const report = getReport(reportId);

  const photos = useMemo(() => report?.photos || [], [report?.photos]);
  const formattedDate = report?.createdAt ? formatDate(report.createdAt) : '';

  const handleEditPhotoCrop = useCallback(
    (photo: Photo) => {
      navigation.navigate('PhotoEdit', { reportId, photoId: photo.id });
    },
    [navigation, reportId]
  );

  const handleExportPdf = useCallback(async () => {
    if (isExporting || !report || photos.length === 0) return;

    setIsExporting(true);
    try {
      const pdfUri = await generateReportPdf(report);
      const shareResult = await sharePdfFile(pdfUri, report.name);

      if (shareResult.status === 'SHARING_UNAVAILABLE') {
        Alert.alert(
          'PDF Saved',
          'The PDF report was successfully generated and saved to your device, but native sharing is not available on this platform.'
        );
      } else if (
        shareResult.status === 'SHARING_FAILED' ||
        shareResult.status === 'FILE_INVALID'
      ) {
        Alert.alert(
          'Share Error',
          shareResult.error || 'Unable to open the share sheet for this PDF report.'
        );
      } else {
        navigation.navigate('ReportDetails', { reportId });
      }
    } catch (err: any) {
      console.error('[PdfPreviewScreen] Error exporting PDF:', err);
      Alert.alert(
        'Export Failed',
        err?.message || 'Unable to generate PDF report.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, report, photos.length, navigation, reportId]);

  if (!report) {
    return (
      <ScreenWrapper>
        <Header title="PDF Preview" onBack={() => navigation.goBack()} />
        <View style={styles.centerEmpty}>
          <Text variant="body" color="secondary">
            Report not found.
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header
          title="PDF Report Preview"
          subtitle={`${photos.length} ${photos.length === 1 ? 'photo' : 'photos'} · Print Ready`}
          onBack={() => navigation.goBack()}
          backTitle="Review"
          rightAction={
            <Button
              title={isExporting ? 'Exporting...' : 'Export'}
              variant="primary"
              size="sm"
              loading={isExporting}
              onPress={handleExportPdf}
            />
          }
        />

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingHorizontal: theme.spacing.lg },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Cover Page Natural Section (No outer white card/rectangle) */}
          <View style={styles.coverPageSection}>
            <View style={styles.coverHeaderRow}>
              <View style={styles.coverBrandRow}>
                <PhotoProofLogoMark size={24} color={theme.colors.primary} />
                <Text variant="caption1" weight="800" color="accent" style={styles.coverBrandText}>
                  PHOTOPROOF
                </Text>
              </View>
              <View style={styles.pageBadge}>
                <Text variant="caption2" weight="600" color="secondary">
                  COVER PAGE
                </Text>
              </View>
            </View>

            <Text variant="title2" weight="800" style={styles.coverTitle}>
              {report.name}
            </Text>
            {report.description ? (
              <Text variant="footnote" color="secondary" style={styles.coverDesc}>
                {report.description}
              </Text>
            ) : null}

            <View style={styles.coverSummaryGrid}>
              <View style={styles.summaryItem}>
                <Text variant="caption2" color="secondary" style={styles.summaryLabel}>
                  DATE
                </Text>
                <Text variant="subhead" weight="600" style={{ marginTop: 2 }}>
                  {formattedDate}
                </Text>
              </View>
              <View style={styles.summaryItem}>
                <Text variant="caption2" color="secondary" style={styles.summaryLabel}>
                  EVIDENCE
                </Text>
                <Text variant="subhead" weight="600" style={{ marginTop: 2 }}>
                  {photos.length} Captured
                </Text>
              </View>
            </View>

            <View style={styles.coverFooterRow}>
              <ShieldCheckIcon size={14} color="#34C759" strokeWidth={2} />
              <Text variant="caption2" color="secondary">
                Original metadata and photos verified on-device
              </Text>
            </View>
          </View>

          {/* Section Header */}
          <View style={styles.sectionHeaderRow}>
            <Text variant="caption1" weight="700" color="secondary" style={styles.sectionTitle}>
              EVIDENCE ENTRIES & CROPS
            </Text>
            <Text variant="caption2" color="tertiary">
              Tap Edit to adjust crop
            </Text>
          </View>

          {/* Evidence Pages Preview (Natural natural flow without enclosing card) */}
          {photos.map((photo) => {
            const resolvedUri = normalizeFileUri(photo.originalUri);
            const crop = photo.crop;
            const hasCustomCrop = Boolean(crop);

            return (
              <View key={photo.id} style={styles.photoEntrySection}>
                {/* Entry Header */}
                <View style={styles.entryHeaderRow}>
                  <View style={styles.numberPill}>
                    <Text variant="caption2" weight="800" color="#FFFFFF">
                      PHOTO #{formatPhotoNumber(photo.number)}
                    </Text>
                  </View>

                  <Pressable
                    onPress={() => handleEditPhotoCrop(photo)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityLabel="Edit crop for photo"
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.editCropButton,
                      { opacity: pressed ? 0.6 : 1 },
                    ]}
                  >
                    <CropIcon
                      size={14}
                      color={hasCustomCrop ? '#FF5500' : theme.colors.textSecondary}
                      strokeWidth={2}
                    />
                    <Text
                      variant="caption2"
                      weight="700"
                      color={hasCustomCrop ? 'accent' : 'primary'}
                      style={{ marginLeft: 4 }}
                    >
                      {hasCustomCrop ? 'Cropped' : 'Edit Crop'}
                    </Text>
                  </Pressable>
                </View>

                {/* Photo Preview with Crop Frame Preview */}
                <View style={styles.previewImageWrapper}>
                  <CroppedImage
                    uri={resolvedUri}
                    crop={crop}
                    sourceWidth={photo.width}
                    sourceHeight={photo.height}
                    maxHeight={300}
                    recyclingKey={photo.id}
                  />
                  {hasCustomCrop && (
                    <View style={styles.customCropIndicatorBadge}>
                      <Text variant="caption2" weight="700" color="#FFFFFF">
                        PDF CROP ACTIVE ({crop?.aspectRatio?.toUpperCase() || 'CUSTOM'})
                      </Text>
                    </View>
                  )}
                </View>

                {/* Entry Metadata Details */}
                <View style={styles.entryMetadataContainer}>
                  <View style={styles.metaRow}>
                    <Text variant="caption2" color="secondary">
                      Timestamp:
                    </Text>
                    <Text variant="caption2" weight="600">
                      {formatDateTime(photo.capturedAt)}
                    </Text>
                  </View>

                  {photo.latitude !== undefined && photo.latitude !== null ? (
                    <View style={styles.metaRow}>
                      <Text variant="caption2" color="secondary">
                        GPS Location:
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                        <LocationPinIcon size={12} color="#FF5500" strokeWidth={2} />
                        <Text variant="caption2" weight="600" color="accent">
                          {photo.latitude.toFixed(5)}°, {photo.longitude?.toFixed(5)}°
                        </Text>
                      </View>
                    </View>
                  ) : null}

                  {photo.category ? (
                    <View style={styles.metaRow}>
                      <Text variant="caption2" color="secondary">
                        Category:
                      </Text>
                      <Text variant="caption2" weight="600">
                        {photo.category}
                      </Text>
                    </View>
                  ) : null}

                  {photo.note ? (
                    <View style={styles.notesBox}>
                      <Text variant="caption2" color="secondary" weight="600">
                        Notes:
                      </Text>
                      <Text variant="caption1" style={{ marginTop: 2 }}>
                        {photo.note}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </ScrollView>

        {/* Bottom Floating Export CTA */}
        <View
          style={[
            styles.bottomBar,
            {
              backgroundColor: theme.colors.glassSurface,
              borderTopColor: theme.colors.borderSubtle,
            },
          ]}
        >
          <Button
            title={isExporting ? 'Generating Verified PDF...' : 'Export & Share PDF'}
            variant="primary"
            size="lg"
            loading={isExporting}
            fullWidth
            onPress={handleExportPdf}
          />
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 110,
  },
  coverPageSection: {
    marginBottom: 20,
    paddingTop: 4,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(142, 142, 147, 0.25)',
  },
  coverHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  coverBrandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  coverBrandText: {
    letterSpacing: 1,
  },
  pageBadge: {
    backgroundColor: 'rgba(142, 142, 147, 0.12)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  coverTitle: {
    fontSize: 22,
    marginTop: 6,
    letterSpacing: -0.4,
  },
  coverDesc: {
    marginTop: 4,
    lineHeight: 18,
  },
  coverSummaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: 12,
  },
  summaryItem: {
    flex: 1,
  },
  summaryLabel: {
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  coverFooterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    letterSpacing: 0.6,
  },
  photoEntrySection: {
    marginBottom: 24,
  },
  entryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  numberPill: {
    backgroundColor: 'rgba(60, 60, 67, 0.85)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  editCropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  previewImageWrapper: {
    width: '100%',
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  entryImage: {
    width: '100%',
    height: '100%',
  },
  customCropIndicatorBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(255, 85, 0, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  entryMetadataContainer: {
    paddingVertical: 10,
    gap: 6,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  notesBox: {
    marginTop: 4,
    padding: 8,
    borderRadius: 6,
    backgroundColor: 'rgba(142, 142, 147, 0.08)',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
