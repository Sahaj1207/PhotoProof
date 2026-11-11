import React, { useState, useCallback, useMemo } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  StyleSheet,
  FlatList,
  Alert,
  useWindowDimensions,
  Platform,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useReports } from '../context/ReportsContext';
import { Text } from '../components/common/Text';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Header } from '../components/common/Header';
import { ScreenWrapper } from '../components/common/ScreenWrapper';
import { MemoizedPhotoTile } from '../components/ReportDetails/MemoizedPhotoTile';
import { formatDate } from '../utils/date';
import { generateReportPdf, sharePdfFile } from '../services';
import {
  listReportPdfExports,
  deleteReportPdfExport,
  PdfExportItem,
} from '../services/storage/fileStorage';
import {
  DocumentPdfIcon,
  ShareIcon,
  TrashIcon,
  CheckIcon,
  CameraIcon,
  CalendarIcon,
  ClockIcon,
} from '../components/icons/Icons';
import { Photo } from '../models/Photo';
import type { ReportDetailsScreenProps } from '../navigation/types';

export const ReportDetailsScreen: React.FC<ReportDetailsScreenProps> = ({
  route,
  navigation,
}) => {
  const { theme } = useTheme();
  const { getReport, deletePhotos } = useReports();
  const { reportId } = route.params;
  const { width } = useWindowDimensions();

  const [isExporting, setIsExporting] = useState(false);
  const [pdfExports, setPdfExports] = useState<PdfExportItem[]>([]);
  const [isPdfSelectMode, setIsPdfSelectMode] = useState(false);
  const [selectedPdfUris, setSelectedPdfUris] = useState<string[]>([]);
  const [isPhotoSelectMode, setIsPhotoSelectMode] = useState(false);
  const [selectedPhotoIds, setSelectedPhotoIds] = useState<string[]>([]);

  const report = getReport(reportId);

  // Load previously generated PDFs
  const loadPdfExports = useCallback(async () => {
    if (!reportId) return;
    try {
      const items = await listReportPdfExports(reportId);
      setPdfExports(items);
    } catch (err) {
      console.warn('[ReportDetailsScreen] Failed to load PDF exports:', err);
    }
  }, [reportId]);

  // Reload whenever the screen regains focus so PDFs exported from the
  // Preview screen show up immediately on return.
  useFocusEffect(
    useCallback(() => {
      loadPdfExports();
    }, [loadPdfExports])
  );

  // Compute item size for 3-column grid
  const numColumns = 3;
  const spacing = 4;
  const totalHorizontalPadding = theme.spacing.lg * 2;
  const availableWidth = width - totalHorizontalPadding;
  const itemSize = Math.floor((availableWidth - spacing * (numColumns - 1)) / numColumns);

  const handleBackToHome = useCallback(() => {
    navigation.navigate('Home');
  }, [navigation]);

  const handleAddPhotos = useCallback(() => {
    navigation.navigate('Capture', { reportId });
  }, [navigation, reportId]);

  const handlePhotoPress = useCallback(
    (photo: Photo) => {
      if (isPhotoSelectMode) {
        setSelectedPhotoIds((prev) =>
          prev.includes(photo.id) ? prev.filter((id) => id !== photo.id) : [...prev, photo.id]
        );
      } else {
        navigation.navigate('PhotoDetails', { reportId, photoId: photo.id });
      }
    },
    [isPhotoSelectMode, navigation, reportId]
  );

  const handleExportPdf = useCallback(async () => {
    if (isExporting || !report || report.photos.length === 0) {
      return;
    }

    setIsExporting(true);
    try {
      // 1. Generate verified PDF in app-owned storage
      const pdfUri = await generateReportPdf(report);

      // Refresh PDF export list
      await loadPdfExports();

      // 2. Invoke native sharing
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
      }
    } catch (err: any) {
      console.error('[ReportDetailsScreen] Failed to generate/share PDF:', err);
      Alert.alert(
        'Export Failed',
        err?.message ||
          'Unable to generate the PDF report. Please verify your photos and try again.'
      );
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, report, loadPdfExports]);

  const handleShareExistingPdf = useCallback(
    async (item: PdfExportItem) => {
      try {
        await sharePdfFile(item.uri, report?.name || 'Report');
      } catch (err) {
        console.error('[ReportDetailsScreen] Share PDF error:', err);
      }
    },
    [report?.name]
  );

  const handleDeleteSinglePdf = useCallback(
    (item: PdfExportItem) => {
      Alert.alert(
        'Delete PDF?',
        'This exported PDF will be removed from this device.\n\nYour original photos and report data will not be affected.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete PDF',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteReportPdfExport(item.uri);
                await loadPdfExports();
              } catch {
                Alert.alert('Error', 'Unable to delete the PDF export.');
              }
            },
          },
        ]
      );
    },
    [loadPdfExports]
  );

  const togglePdfSelection = useCallback((uri: string) => {
    setSelectedPdfUris((prev) =>
      prev.includes(uri) ? prev.filter((u) => u !== uri) : [...prev, uri]
    );
  }, []);

  const handleTogglePdfSelectMode = useCallback(() => {
    setIsPdfSelectMode((prev) => {
      if (prev) {
        setSelectedPdfUris([]);
      }
      return !prev;
    });
  }, []);

  const handleDeleteSelectedPdfs = useCallback(() => {
    const count = selectedPdfUris.length;
    if (count === 0) return;

    Alert.alert(
      count === 1 ? 'Delete 1 PDF?' : `Delete ${count} PDFs?`,
      `These exported PDFs will be removed from this device.\n\nYour original photos and report data will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: count === 1 ? 'Delete PDF' : `Delete ${count} PDFs`,
          style: 'destructive',
          onPress: async () => {
            try {
              for (const uri of selectedPdfUris) {
                await deleteReportPdfExport(uri);
              }
              setSelectedPdfUris([]);
              setIsPdfSelectMode(false);
              await loadPdfExports();
            } catch {
              Alert.alert('Error', 'Unable to delete some of the selected PDFs.');
            }
          },
        },
      ]
    );
  }, [selectedPdfUris, loadPdfExports]);

  const handleTogglePhotoSelectMode = useCallback(() => {
    setIsPhotoSelectMode((prev) => {
      if (prev) {
        setSelectedPhotoIds([]);
      }
      return !prev;
    });
  }, []);

  const handleDeleteSelectedPhotos = useCallback(() => {
    const count = selectedPhotoIds.length;
    if (count === 0) return;

    Alert.alert(
      count === 1 ? 'Delete 1 Photo?' : `Delete ${count} Photos?`,
      `The selected photos and their metadata will be permanently removed from this report.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: count === 1 ? 'Delete Photo' : `Delete ${count} Photos`,
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePhotos(reportId, selectedPhotoIds);
              setSelectedPhotoIds([]);
              setIsPhotoSelectMode(false);
            } catch {
              Alert.alert('Error', 'Unable to delete the selected photos.');
            }
          },
        },
      ]
    );
  }, [selectedPhotoIds, deletePhotos, reportId]);

  const photos = useMemo(() => report?.photos || [], [report?.photos]);
  const hasPhotos = photos.length > 0;
  const formattedDate = report?.createdAt ? formatDate(report.createdAt) : '';

  const creationTimeFormatted = useMemo(() => {
    if (!report?.createdAt) return '';
    try {
      const d = new Date(report.createdAt);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [report?.createdAt]);

  const keyExtractor = useCallback((item: Photo) => item.id, []);

  const renderPhotoItem = useCallback(
    ({ item, index }: { item: Photo; index: number }) => {
      const isSelected = selectedPhotoIds.includes(item.id);
      return (
        <MemoizedPhotoTile
          photo={item}
          itemSize={itemSize}
          spacing={spacing}
          isSelectMode={isPhotoSelectMode}
          isSelected={isSelected}
          isLastInRow={index % numColumns === numColumns - 1}
          onPress={handlePhotoPress}
        />
      );
    },
    [itemSize, spacing, isPhotoSelectMode, selectedPhotoIds, handlePhotoPress]
  );

  const renderHeader = useMemo(
    () => (
      <View style={styles.listHeaderContainer}>
        {/* Compact iOS-Inspired Report Info Area (No background box; natural flow) */}
        <View style={styles.reportInfoArea}>
          {formattedDate ? (
            <Text variant="caption1" weight="600" color="secondary" style={styles.createdDateLabel}>
              Created {formattedDate}
            </Text>
          ) : null}

          <Text variant="title2" weight="800" numberOfLines={2} style={styles.reportTitle}>
            {report?.name || 'Report'}
          </Text>

          {report?.description ? (
            <Text
              variant="footnote"
              color="secondary"
              numberOfLines={2}
              style={styles.reportDescription}
            >
              {report.description}
            </Text>
          ) : null}

          {/* Compact 1-Line Horizontal Metadata Row */}
          <View style={styles.metadataInlineRow}>
            <View style={styles.metadataInlineItem}>
              <CameraIcon size={13} color="#8E8E93" strokeWidth={2} />
              <Text variant="caption2" weight="600" color="secondary" style={styles.metadataInlineText}>
                {photos.length} {photos.length === 1 ? 'Photo' : 'Photos'}
              </Text>
            </View>

            <View style={styles.metadataInlineDivider} />

            <View style={styles.metadataInlineItem}>
              <CalendarIcon size={13} color="#8E8E93" strokeWidth={1.8} />
              <Text variant="caption2" weight="600" color="secondary" style={styles.metadataInlineText}>
                {formattedDate || '—'}
              </Text>
            </View>

            {creationTimeFormatted ? (
              <>
                <View style={styles.metadataInlineDivider} />
                <View style={styles.metadataInlineItem}>
                  <ClockIcon size={13} color="#8E8E93" strokeWidth={1.8} />
                  <Text variant="caption2" weight="600" color="secondary" style={styles.metadataInlineText}>
                    {creationTimeFormatted}
                  </Text>
                </View>
              </>
            ) : null}
          </View>
        </View>

        {/* 3 Action Buttons on ONE Horizontal Line */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleAddPhotos}
            accessibilityLabel="Add photos"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={({ pressed }) => [
              styles.actionButton,
              styles.secondaryActionButton,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text variant="footnote" weight="600" color="primary" numberOfLines={1}>
              + Add Photos
            </Text>
          </Pressable>

          <Pressable
            onPress={() => navigation.navigate('PdfPreview', { reportId })}
            disabled={!hasPhotos}
            accessibilityLabel="Preview PDF"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={({ pressed }) => [
              styles.actionButton,
              styles.secondaryActionButton,
              !hasPhotos && styles.actionButtonDisabled,
              { opacity: pressed ? 0.7 : 1 },
            ]}
          >
            <Text
              variant="footnote"
              weight="600"
              color={hasPhotos ? 'primary' : 'tertiary'}
              numberOfLines={1}
            >
              Preview PDF
            </Text>
          </Pressable>

          <Pressable
            onPress={handleExportPdf}
            disabled={!hasPhotos || isExporting}
            accessibilityLabel="Export PDF"
            accessibilityRole="button"
            hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
            style={({ pressed }) => [
              styles.actionButton,
              styles.primaryActionButton,
              (!hasPhotos || isExporting) && styles.actionButtonDisabled,
              { opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {isExporting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text variant="footnote" weight="700" style={styles.primaryActionButtonText} numberOfLines={1}>
                Export PDF
              </Text>
            )}
          </Pressable>
        </View>

        {/* Generated PDF Exports Management Area */}
        {pdfExports.length > 0 && (
          <View style={styles.pdfExportsSection}>
            <View style={styles.pdfSectionHeaderRow}>
              <Text
                variant="caption1"
                weight="700"
                color="secondary"
                style={styles.sectionTitle}
              >
                EXPORTED PDFS ({pdfExports.length})
              </Text>

              <Pressable
                onPress={handleTogglePdfSelectMode}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Text variant="caption1" weight="700" color="accent">
                  {isPdfSelectMode ? 'Cancel' : 'Select'}
                </Text>
              </Pressable>
            </View>

            {/* Multi-Select PDF Action Bar */}
            {isPdfSelectMode && (
              <View style={styles.multiSelectBar}>
                <Text variant="subhead" weight="600">
                  {selectedPdfUris.length} Selected
                </Text>
                <Pressable
                  onPress={handleDeleteSelectedPdfs}
                  disabled={selectedPdfUris.length === 0}
                  style={({ pressed }) => [
                    styles.multiDeleteButton,
                    selectedPdfUris.length === 0 && styles.multiDeleteButtonDisabled,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text
                    variant="caption1"
                    weight="700"
                    color={selectedPdfUris.length > 0 ? '#FF3B30' : '#8E8E93'}
                  >
                    Delete ({selectedPdfUris.length})
                  </Text>
                </Pressable>
              </View>
            )}

            {pdfExports.map((exportItem) => {
              const isSelected = selectedPdfUris.includes(exportItem.uri);
              return (
                <Pressable
                  key={exportItem.uri}
                  onPress={() => {
                    if (isPdfSelectMode) {
                      togglePdfSelection(exportItem.uri);
                    }
                  }}
                  style={({ pressed }) => [
                    styles.pdfItemPressable,
                    isSelected && {
                      backgroundColor: 'rgba(255, 85, 0, 0.08)',
                      borderRadius: 8,
                    },
                    { opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <View style={styles.pdfExportRow}>
                    {/* Selection Checkbox */}
                    {isPdfSelectMode && (
                      <View
                        style={[
                          styles.selectCheckbox,
                          {
                            borderColor: isSelected
                              ? theme.colors.primary
                              : theme.colors.borderSubtle,
                            backgroundColor: isSelected
                              ? theme.colors.primary
                              : 'transparent',
                          },
                        ]}
                      >
                        {isSelected && <CheckIcon size={12} color="#FFFFFF" strokeWidth={3} />}
                      </View>
                    )}

                    <DocumentPdfIcon size={20} color={theme.colors.primary} strokeWidth={2} style={styles.pdfIcon} />

                    <View style={styles.pdfInfoColumn}>
                      <Text
                        variant="footnote"
                        weight="700"
                        numberOfLines={1}
                        style={styles.pdfFilename}
                      >
                        {exportItem.filename}
                      </Text>
                      <Text variant="caption2" color="secondary">
                        {(exportItem.size / (1024 * 1024)).toFixed(2)} MB · Ready
                      </Text>
                    </View>

                    {!isPdfSelectMode && (
                      <View style={styles.pdfActionsRow}>
                        <Pressable
                          onPress={() => handleShareExistingPdf(exportItem)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Share PDF"
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.pdfActionPill,
                            {
                              backgroundColor: theme.colors.primaryMuted,
                              opacity: pressed ? 0.7 : 1,
                            },
                          ]}
                        >
                          <ShareIcon size={13} color={theme.colors.primary} strokeWidth={2} />
                          <Text variant="caption2" weight="700" color="accent" style={{ marginLeft: 4 }}>
                            Share
                          </Text>
                        </Pressable>

                        <Pressable
                          onPress={() => handleDeleteSinglePdf(exportItem)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          accessibilityLabel="Delete PDF"
                          accessibilityRole="button"
                          style={({ pressed }) => [
                            styles.pdfDeleteButton,
                            { opacity: pressed ? 0.6 : 0.9 },
                          ]}
                        >
                          <TrashIcon size={14} color="#8E8E93" strokeWidth={1.8} />
                        </Pressable>
                      </View>
                    )}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Photo Evidence Section Header with Select Mode */}
        {hasPhotos && (
          <View style={styles.photoSectionHeaderContainer}>
            <View style={styles.photoSectionHeaderRow}>
              <Text
                variant="caption1"
                weight="700"
                color="secondary"
                style={styles.sectionTitle}
              >
                PHOTO EVIDENCE ({photos.length})
              </Text>

              <Pressable
                onPress={handleTogglePhotoSelectMode}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
              >
                <Text variant="caption1" weight="700" color="accent">
                  {isPhotoSelectMode ? 'Cancel' : 'Select'}
                </Text>
              </Pressable>
            </View>

            {/* Multi-Select Photo Action Bar */}
            {isPhotoSelectMode && (
              <View style={styles.multiSelectBar}>
                <Text variant="subhead" weight="600">
                  {selectedPhotoIds.length} Selected
                </Text>
                <Pressable
                  onPress={handleDeleteSelectedPhotos}
                  disabled={selectedPhotoIds.length === 0}
                  style={({ pressed }) => [
                    styles.multiDeleteButton,
                    selectedPhotoIds.length === 0 && styles.multiDeleteButtonDisabled,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text
                    variant="caption1"
                    weight="700"
                    color={selectedPhotoIds.length > 0 ? '#FF3B30' : '#8E8E93'}
                  >
                    Delete ({selectedPhotoIds.length})
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}
      </View>
    ),
    [
      formattedDate,
      report?.name,
      report?.description,
      photos.length,
      creationTimeFormatted,
      handleAddPhotos,
      navigation,
      reportId,
      hasPhotos,
      handleExportPdf,
      isExporting,
      pdfExports,
      isPdfSelectMode,
      handleTogglePdfSelectMode,
      selectedPdfUris,
      handleDeleteSelectedPdfs,
      togglePdfSelection,
      theme.colors.primary,
      theme.colors.borderSubtle,
      theme.colors.primaryMuted,
      handleShareExistingPdf,
      handleDeleteSinglePdf,
      handleTogglePhotoSelectMode,
      isPhotoSelectMode,
      selectedPhotoIds,
      handleDeleteSelectedPhotos,
    ]
  );

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {/* Compact Navigation Bar */}
        <Header
          onBack={handleBackToHome}
          backTitle="Reports"
        />

        {hasPhotos ? (
          <FlatList
            data={photos}
            keyExtractor={keyExtractor}
            renderItem={renderPhotoItem}
            numColumns={numColumns}
            ListHeaderComponent={renderHeader}
            contentContainerStyle={[
              styles.gridContent,
              { paddingHorizontal: theme.spacing.lg },
            ]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={15}
            windowSize={7}
            removeClippedSubviews={Platform.OS === 'android'}
          />
        ) : (
          <View
            style={[
              styles.emptyContainer,
              { paddingHorizontal: theme.spacing.lg },
            ]}
          >
            {renderHeader}
            <Card variant="glass" padding="xl" style={styles.emptyCard}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.colors.primaryMuted },
                ]}
              >
                <CameraIcon size={32} color={theme.colors.primary} strokeWidth={1.8} />
              </View>

              <Text
                variant="title3"
                weight="700"
                align="center"
                style={styles.emptyTitle}
              >
                No Photos in this Report
              </Text>

              <Text
                variant="callout"
                color="secondary"
                align="center"
                style={styles.emptyDescription}
              >
                Add photos to document this inspection. All captures remain local and tamper-evident.
              </Text>

              <Button
                title="Open Camera"
                variant="primary"
                size="lg"
                fullWidth
                onPress={handleAddPhotos}
              />
            </Card>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gridContent: {
    paddingBottom: 50,
  },
  listHeaderContainer: {
    marginTop: 2,
    marginBottom: 20,
  },
  reportInfoArea: {
    marginBottom: 16,
  },
  createdDateLabel: {
    letterSpacing: 0.3,
    marginBottom: 4,
  },
  reportTitle: {
    fontSize: 22,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  reportDescription: {
    marginTop: 4,
    lineHeight: 18,
  },
  metadataInlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    flexWrap: 'nowrap',
  },
  metadataInlineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metadataInlineText: {
    fontSize: 12,
  },
  metadataInlineDivider: {
    width: StyleSheet.hairlineWidth,
    height: 12,
    backgroundColor: 'rgba(128, 128, 128, 0.35)',
    marginHorizontal: 8,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 18,
  },
  actionButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  secondaryActionButton: {
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(128, 128, 128, 0.28)',
  },
  primaryActionButton: {
    backgroundColor: '#FF5500',
  },
  primaryActionButtonText: {
    color: '#FFFFFF',
  },
  actionButtonDisabled: {
    opacity: 0.4,
  },
  pdfExportsSection: {
    marginBottom: 20,
  },
  pdfSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  photoSectionHeaderContainer: {
    marginTop: 4,
    marginBottom: 10,
  },
  photoSectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  multiSelectBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(128, 128, 128, 0.1)',
    borderRadius: 10,
    marginBottom: 10,
  },
  multiDeleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  multiDeleteButtonDisabled: {
    backgroundColor: 'transparent',
  },
  pdfItemPressable: {
    paddingVertical: 6,
    marginBottom: 4,
  },
  pdfExportRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectCheckbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  pdfIcon: {
    marginRight: 10,
  },
  pdfInfoColumn: {
    flex: 1,
    marginRight: 8,
  },
  pdfFilename: {
    fontSize: 13,
  },
  pdfActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pdfActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  pdfDeleteButton: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(142, 142, 147, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    letterSpacing: 0.6,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    marginTop: 20,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    marginBottom: 8,
  },
  emptyDescription: {
    marginBottom: 24,
    maxWidth: 280,
    lineHeight: 22,
  },
});
