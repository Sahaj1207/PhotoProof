import React from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Report } from '../../models/Report';
import { Text } from '../common/Text';
import { Card } from '../common/Card';
import { formatDate } from '../../utils/date';
import { normalizeFileUri } from '../../services/storage/fileStorage';
import { CameraIcon, TrashIcon, ChevronRightIcon } from '../icons/Icons';

interface ReportListItemProps {
  report: Report;
  onPress: (report: Report) => void;
  onDelete: (report: Report) => void;
}

export const ReportListItem = React.memo<ReportListItemProps>(
  ({ report, onPress, onDelete }) => {
    const firstPhoto = report.photos.length > 0 ? report.photos[0] : null;
    const thumbnailUri = firstPhoto ? normalizeFileUri(firstPhoto.originalUri) : null;

    return (
      <Pressable
        onPress={() => onPress(report)}
        style={({ pressed }) => [
          styles.pressable,
          { opacity: pressed ? 0.75 : 1 },
        ]}
      >
        <Card variant="default" padding="none" style={styles.card}>
          <View style={styles.cardContentRow}>
            {/* Left Thumbnail or SVG Camera Placeholder */}
            <View style={styles.thumbnailContainer}>
              {thumbnailUri ? (
                <Image
                  source={{ uri: thumbnailUri }}
                  style={styles.thumbnailImage}
                  contentFit="cover"
                  recyclingKey={firstPhoto?.id}
                  cachePolicy="memory-disk"
                  transition={120}
                />
              ) : (
                <View style={styles.placeholderContainer}>
                  <CameraIcon size={22} color="#FF5500" strokeWidth={1.8} />
                </View>
              )}
            </View>

            {/* Middle Info Column */}
            <View style={styles.infoColumn}>
              <View style={styles.headerRow}>
                <Text variant="headline" weight="700" numberOfLines={1} style={styles.title}>
                  {report.name}
                </Text>
                <Pressable
                  onPress={(e) => {
                    e.stopPropagation();
                    onDelete(report);
                  }}
                  accessibilityLabel="Delete report"
                  accessibilityRole="button"
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  style={({ pressed }) => [
                    styles.deleteIconButton,
                    { opacity: pressed ? 0.5 : 0.8 },
                  ]}
                >
                  <TrashIcon size={16} color="#8E8E93" strokeWidth={1.8} />
                </Pressable>
              </View>

              {report.description ? (
                <Text variant="footnote" color="secondary" numberOfLines={1} style={styles.description}>
                  {report.description}
                </Text>
              ) : null}

              <View style={styles.footerRow}>
                <View style={styles.photoCountPill}>
                  <CameraIcon size={12} color="#8E8E93" strokeWidth={2} style={styles.pillIcon} />
                  <Text variant="caption2" weight="600" color="secondary" style={styles.pillText}>
                    {report.photos.length} {report.photos.length === 1 ? 'photo' : 'photos'}
                  </Text>
                </View>
                <View style={styles.dateAndChevronRow}>
                  <Text variant="caption1" color="tertiary">
                    {formatDate(report.createdAt)}
                  </Text>
                  <ChevronRightIcon size={14} color="#8E8E93" strokeWidth={2} />
                </View>
              </View>
            </View>
          </View>
        </Card>
      </Pressable>
    );
  },
  (prev, next) => {
    return (
      prev.report.id === next.report.id &&
      prev.report.name === next.report.name &&
      prev.report.description === next.report.description &&
      prev.report.photos.length === next.report.photos.length &&
      prev.report.photos[0]?.originalUri === next.report.photos[0]?.originalUri &&
      prev.report.updatedAt === next.report.updatedAt
    );
  }
);

const styles = StyleSheet.create({
  pressable: {
    marginBottom: 10,
  },
  card: {
    overflow: 'hidden',
  },
  cardContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  thumbnailContainer: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1C1E24',
    marginRight: 12,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  placeholderContainer: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 85, 0, 0.08)',
  },
  infoColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    flex: 1,
    marginRight: 8,
    fontSize: 16,
  },
  deleteIconButton: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  description: {
    marginTop: 2,
    marginBottom: 6,
    lineHeight: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  photoCountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: 'rgba(128, 128, 128, 0.12)',
    gap: 4,
  },
  pillIcon: {
    marginRight: 2,
  },
  pillText: {
    fontSize: 11,
  },
  dateAndChevronRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});
