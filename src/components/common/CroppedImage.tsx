import React, { useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent, ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { PhotoCrop } from '../../models/Photo';
import { computeCropGeometry, hasExactCrop, normalizeRotation, rotatedSize } from '../../utils/crop';

interface CroppedImageProps {
  uri: string;
  crop?: PhotoCrop | null;
  /** Pixel size of the original photo, if known (used when there is no crop). */
  sourceWidth?: number | null;
  sourceHeight?: number | null;
  /** Upper bound on the rendered height. */
  maxHeight: number;
  recyclingKey?: string;
  style?: ViewStyle;
}

/**
 * Renders a photo exactly as it will appear in the exported PDF:
 * rotated and cropped using the same geometry as the PDF template.
 */
export const CroppedImage: React.FC<CroppedImageProps> = ({
  uri,
  crop,
  sourceWidth,
  sourceHeight,
  maxHeight,
  recyclingKey,
  style,
}) => {
  const [availableWidth, setAvailableWidth] = useState(0);
  const [loadedSize, setLoadedSize] = useState<{ width: number; height: number } | null>(null);

  const srcW = (hasExactCrop(crop) ? crop.sourceWidth : sourceWidth) || loadedSize?.width;
  const srcH = (hasExactCrop(crop) ? crop.sourceHeight : sourceHeight) || loadedSize?.height;
  const rotation = normalizeRotation(crop?.rotation);

  const geometry =
    srcW && srcH
      ? computeCropGeometry(
          // Legacy crops (no source size) can't be reproduced exactly; show them uncropped.
          hasExactCrop(crop) ? crop : { x: 0, y: 0, width: 1, height: 1, rotation },
          srcW,
          srcH
        )
      : null;

  const aspect = geometry?.outputAspect ?? (srcW && srcH ? rotatedSize(srcW, srcH, rotation).width / rotatedSize(srcW, srcH, rotation).height : 4 / 3);
  const width = availableWidth ? Math.min(availableWidth, maxHeight * aspect) : 0;
  const height = width ? width / aspect : maxHeight;

  const onLayout = (e: LayoutChangeEvent) => setAvailableWidth(e.nativeEvent.layout.width);

  return (
    <View style={[styles.outer, style]} onLayout={onLayout}>
      <View style={[styles.viewport, { width: width || '100%', height }]}>
        <View
          style={[
            styles.abs,
            geometry
              ? {
                  left: `${geometry.wrapper.left}%`,
                  top: `${geometry.wrapper.top}%`,
                  width: `${geometry.wrapper.width}%`,
                  height: `${geometry.wrapper.height}%`,
                }
              : styles.fill,
          ]}
        >
          <Image
            source={{ uri }}
            recyclingKey={recyclingKey}
            cachePolicy="memory-disk"
            transition={120}
            contentFit={geometry ? 'fill' : 'cover'}
            onLoad={(e) => {
              if (!loadedSize) setLoadedSize({ width: e.source.width, height: e.source.height });
            }}
            style={[
              styles.abs,
              geometry
                ? {
                    left: `${geometry.image.left}%`,
                    top: `${geometry.image.top}%`,
                    width: `${geometry.image.width}%`,
                    height: `${geometry.image.height}%`,
                    transform: [{ rotate: `${geometry.rotation}deg` }],
                  }
                : styles.fill,
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  outer: { width: '100%', alignItems: 'center' },
  viewport: { overflow: 'hidden', backgroundColor: '#000000', borderRadius: 8 },
  abs: { position: 'absolute' },
  fill: { left: 0, top: 0, width: '100%', height: '100%' },
});
