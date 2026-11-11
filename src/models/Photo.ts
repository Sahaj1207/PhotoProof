export const PHOTO_CATEGORIES = [
  'General',
  'Exterior',
  'Interior',
  'Living Room',
  'Bedroom',
  'Kitchen',
  'Bathroom',
  'Damage',
  'Other',
] as const;

export type PhotoCategory = (typeof PHOTO_CATEGORIES)[number];

export interface GeoLocation {
  latitude: number;
  longitude: number;
  altitude?: number | null;
  accuracy?: number | null;
}

export type CropAspectRatio = 'free' | 'original' | '1:1' | '4:3' | '16:9';

export interface PhotoCrop {
  x: number; // normalized horizontal offset (0 to 1)
  y: number; // normalized vertical offset (0 to 1)
  width: number; // normalized width (0 to 1)
  height: number; // normalized height (0 to 1)
  rotation?: number; // 0, 90, 180, 270 degrees
  aspectRatio?: CropAspectRatio;
  /**
   * Pixel size of the original (unrotated) photo the crop was made against.
   * When present, x/y/width/height are fractions of the *rotated* photo itself.
   * Older crops lack this and were measured against the editor's preview box.
   */
  sourceWidth?: number;
  sourceHeight?: number;
}

export interface Photo {
  id: string;
  number: number;
  originalUri: string;
  capturedAt: string; // ISO 8601 string
  latitude?: number | null;
  longitude?: number | null;
  address?: string | null;
  note?: string | null;
  category?: PhotoCategory | null;
  location?: GeoLocation | null;
  crop?: PhotoCrop | null;
  /** Pixel size of the saved photo, recorded at capture time (older photos lack it). */
  width?: number | null;
  height?: number | null;
}
