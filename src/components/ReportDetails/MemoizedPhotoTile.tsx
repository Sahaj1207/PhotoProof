import React from 'react';
import { StyleSheet, Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { Photo } from '../../models/Photo';
import { Text } from '../common/Text';
import { formatPhotoNumber } from '../../utils/formatters';
import { normalizeFileUri } from '../../services/storage/fileStorage';

import { CheckIcon } from '../icons/Icons';

interface MemoizedPhotoTileProps {
  photo: Photo;
  itemSize: number;
  spacing: number;
  isSelectMode?: boolean;
  isSelected?: boolean;
  /** Last tile in a row gets no right margin so the grid stays flush with the padding. */
  isLastInRow?: boolean;
  onPress: (photo: Photo) => void;
}

export const MemoizedPhotoTile = React.memo<MemoizedPhotoTileProps>(
  ({ photo, itemSize, spacing, isSelectMode, isSelected, isLastInRow, onPress }) => {
    const resolvedUri = normalizeFileUri(photo.originalUri);

    return (
      <Pressable
        onPress={() => onPress(photo)}
        style={({ pressed }) => [
          styles.photoTile,
          {
            width: itemSize,
            height: itemSize,
            marginRight: isLastInRow ? 0 : spacing,
            marginBottom: spacing,
            opacity: pressed ? 0.75 : 1,
            borderColor: isSelected ? '#FF5500' : 'rgba(255, 255, 255, 0.1)',
            borderWidth: isSelected ? 2 : 0.5,
          },
        ]}
      >
        <Image
          source={{ uri: resolvedUri }}
          style={styles.tileImage}
          contentFit="cover"
          recyclingKey={photo.id}
          cachePolicy="memory-disk"
          transition={120}
        />

        {/* Number Badge Overlay (Top Left) */}
        {!isSelectMode && (
          <View style={styles.numberBadge}>
            <Text variant="caption2" weight="700" color="#FFFFFF">
              #{formatPhotoNumber(photo.number)}
            </Text>
          </View>
        )}

        {/* Selection Checkbox (Top Right when select mode active) */}
        {isSelectMode && (
          <View
            style={[
              styles.selectionIndicator,
              {
                backgroundColor: isSelected ? '#FF5500' : 'rgba(0, 0, 0, 0.5)',
                borderColor: isSelected ? '#FF5500' : 'rgba(255, 255, 255, 0.6)',
              },
            ]}
          >
            {isSelected && <CheckIcon size={14} color="#FFFFFF" strokeWidth={3} />}
          </View>
        )}

        {/* Category Badge if present */}
        {photo.category && !isSelectMode ? (
          <View style={styles.categoryBadge}>
            <Text
              variant="caption2"
              weight="600"
              color="#FFFFFF"
              numberOfLines={1}
              style={styles.categoryBadgeText}
            >
              {photo.category}
            </Text>
          </View>
        ) : null}
      </Pressable>
    );
  },
  (prev, next) => {
    return (
      prev.photo.id === next.photo.id &&
      prev.photo.number === next.photo.number &&
      prev.photo.originalUri === next.photo.originalUri &&
      prev.photo.category === next.photo.category &&
      prev.photo.note === next.photo.note &&
      prev.itemSize === next.itemSize &&
      prev.spacing === next.spacing &&
      prev.isSelectMode === next.isSelectMode &&
      prev.isSelected === next.isSelected &&
      prev.isLastInRow === next.isLastInRow &&
      prev.onPress === next.onPress
    );
  }
);

const styles = StyleSheet.create({
  photoTile: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1C1E24',
    position: 'relative',
  },
  tileImage: {
    width: '100%',
    height: '100%',
  },
  numberBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
  },
  selectionIndicator: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmarkText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  categoryBadge: {
    position: 'absolute',
    bottom: 6,
    left: 6,
    right: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  categoryBadgeText: {
    fontSize: 9,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
});
