/**
 * Formats a sequential photo number with 3-digit zero-padding (e.g. 1 -> "001", 24 -> "024").
 */
export const formatPhotoNumber = (num: number): string => {
  if (isNaN(num) || num < 0) return '000';
  return num.toString().padStart(3, '0');
};
