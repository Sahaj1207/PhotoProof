import type { PhotoCrop } from '../models/Photo';

/**
 * Shared crop geometry, so the editor, the in-app PDF preview and the exported
 * PDF all render a crop identically.
 *
 * Model: rotate the original photo by `rotation`, then take the rectangle
 * (x, y, width, height) given as fractions of the rotated photo.
 *
 * Rendering: a viewport with the crop's aspect ratio clips a "wrapper" sized and
 * offset so the crop rectangle fills the viewport. The wrapper holds the image,
 * rotated about its centre. All values are percentages so they work in both
 * React Native styles and HTML/CSS.
 */
export interface CropGeometry {
  /** width / height of the visible (cropped) result */
  outputAspect: number;
  /** wrapper (= whole rotated photo), as % of the viewport */
  wrapper: { left: number; top: number; width: number; height: number };
  /** unrotated image box, as % of the wrapper, before the rotation transform */
  image: { left: number; top: number; width: number; height: number };
  rotation: number;
}

export const normalizeRotation = (rotation?: number | null): number =>
  (((Math.round((rotation || 0) / 90) * 90) % 360) + 360) % 360;

export const isQuarterTurn = (rotation: number) => rotation === 90 || rotation === 270;

/** Size of the photo after rotation. */
export const rotatedSize = (width: number, height: number, rotation: number) =>
  isQuarterTurn(rotation) ? { width: height, height: width } : { width, height };

/** True when the crop can be rendered with exact geometry. */
export const hasExactCrop = (crop?: PhotoCrop | null): crop is PhotoCrop & {
  sourceWidth: number;
  sourceHeight: number;
} => !!crop && !!crop.sourceWidth && !!crop.sourceHeight;

export const computeCropGeometry = (
  crop: Pick<PhotoCrop, 'x' | 'y' | 'width' | 'height' | 'rotation'>,
  sourceWidth: number,
  sourceHeight: number
): CropGeometry => {
  const rotation = normalizeRotation(crop.rotation);
  const rot = rotatedSize(sourceWidth, sourceHeight, rotation);
  const rotatedAspect = rot.width / rot.height;

  const cw = Math.max(0.01, Math.min(1, crop.width));
  const ch = Math.max(0.01, Math.min(1, crop.height));
  const cx = Math.max(0, Math.min(1 - cw, crop.x));
  const cy = Math.max(0, Math.min(1 - ch, crop.y));

  const wrapper = {
    width: 100 / cw,
    height: 100 / ch,
    left: -(cx / cw) * 100,
    top: -(cy / ch) * 100,
  };

  // For quarter turns the unrotated image is "tall" inside a "wide" wrapper:
  // width = wrapperHeight, height = wrapperWidth, centred, then rotated.
  const image = isQuarterTurn(rotation)
    ? {
        width: 100 / rotatedAspect,
        height: 100 * rotatedAspect,
        left: (100 - 100 / rotatedAspect) / 2,
        top: (100 - 100 * rotatedAspect) / 2,
      }
    : { width: 100, height: 100, left: 0, top: 0 };

  return {
    outputAspect: (cw * rot.width) / (ch * rot.height),
    wrapper,
    image,
    rotation,
  };
};
