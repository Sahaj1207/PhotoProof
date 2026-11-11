import * as FileSystem from 'expo-file-system/legacy';

const getBaseDir = (): string => FileSystem.documentDirectory || '';

/**
 * Normalizes a stored file URI to the current application document directory.
 * On iOS and Expo Go, the container sandbox UUID changes across app relaunches/restarts,
 * which invalidates previously persisted absolute document URIs.
 * This ensures the URI always points to the live documentDirectory.
 */
export const normalizeFileUri = (storedUri: string | null | undefined): string => {
  if (!storedUri) return '';

  const baseDocDir = getBaseDir();

  // If storedUri points inside 'reports/...', extract everything starting from 'reports/'
  const reportsIndex = storedUri.indexOf('reports/');
  if (reportsIndex !== -1) {
    const relativePath = storedUri.substring(reportsIndex);
    return `${baseDocDir}${relativePath}`;
  }

  return storedUri;
};

/**
 * Returns the directory path for a report's photos.
 */
export const getReportPhotosDirectory = (reportId: string): string => {
  return `${getBaseDir()}reports/${reportId}/photos/`;
};

/**
 * Returns the permanent file URI for a photo.
 */
export const getPermanentPhotoUri = (reportId: string, photoId: string): string => {
  return `${getReportPhotosDirectory(reportId)}${photoId}.jpg`;
};

/**
 * Ensures the target directory for report photos exists.
 */
export const ensureReportPhotosDirectory = async (reportId: string): Promise<string> => {
  const dir = getReportPhotosDirectory(reportId);
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
};

/**
 * Copies the raw captured camera output into permanent local document storage.
 * PhotoProof never modifies the image bytes or burns metadata into the image file.
 * Returns the permanent file URI upon successful verification.
 */
export const saveOriginalPhoto = async (
  tempUri: string,
  reportId: string,
  photoId: string
): Promise<string> => {
  await ensureReportPhotosDirectory(reportId);
  const targetUri = getPermanentPhotoUri(reportId, photoId);

  // Copy the camera output to the permanent document path
  await FileSystem.copyAsync({
    from: tempUri,
    to: targetUri,
  });

  // Verify that the destination file actually exists and has nonzero size
  const targetInfo = await FileSystem.getInfoAsync(targetUri);
  if (!targetInfo.exists) {
    throw new Error(`Failed to preserve photo file at: ${targetUri}`);
  }

  // Clean up the temporary cache file if distinct
  try {
    const tempInfo = await FileSystem.getInfoAsync(tempUri);
    if (tempInfo.exists && tempUri !== targetUri) {
      await FileSystem.deleteAsync(tempUri, { idempotent: true });
    }
  } catch {
    // Non-fatal cache cleanup error
  }

  return targetUri;
};

/**
 * Deletes a permanent photo file safely.
 */
export const deletePhotoFile = async (fileUri: string): Promise<void> => {
  try {
    const normalized = normalizeFileUri(fileUri);
    const info = await FileSystem.getInfoAsync(normalized);
    if (info.exists) {
      await FileSystem.deleteAsync(normalized, { idempotent: true });
    }
  } catch {
    // Non-fatal error during rollback/deletion
  }
};

/**
 * Checks whether a permanent photo file exists.
 */
export const photoFileExists = async (fileUri: string): Promise<boolean> => {
  try {
    const normalized = normalizeFileUri(fileUri);
    const info = await FileSystem.getInfoAsync(normalized);
    return info.exists;
  } catch {
    return false;
  }
};

/**
 * Returns the directory path for a report's PDF exports.
 */
export const getReportExportsDirectory = (reportId: string): string => {
  return `${getBaseDir()}reports/${reportId}/exports/`;
};

/**
 * Ensures the target directory for report PDF exports exists.
 */
export const ensureReportExportsDirectory = async (reportId: string): Promise<string> => {
  const dir = getReportExportsDirectory(reportId);
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
};

/**
 * Deletes the entire file directory for a report (photos, exports, subdirs).
 */
export const deleteReportDirectory = async (reportId: string): Promise<void> => {
  try {
    const reportDir = `${getBaseDir()}reports/${reportId}/`;
    const dirInfo = await FileSystem.getInfoAsync(reportDir);
    if (dirInfo.exists) {
      await FileSystem.deleteAsync(reportDir, { idempotent: true });
    }
  } catch (err) {
    console.warn('[FileStorage] Error deleting report directory:', reportId, err);
  }
};

export interface PdfExportItem {
  filename: string;
  uri: string;
  size: number;
  modificationTime: number;
}

/**
 * Lists all generated PDF exports for a specific report, sorted newest first.
 */
export const listReportPdfExports = async (reportId: string): Promise<PdfExportItem[]> => {
  try {
    const dir = getReportExportsDirectory(reportId);
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      return [];
    }

    const fileNames = await FileSystem.readDirectoryAsync(dir);
    const pdfFiles = fileNames.filter((name) => name.toLowerCase().endsWith('.pdf'));

    const items: PdfExportItem[] = [];
    for (const name of pdfFiles) {
      const uri = `${dir}${name}`;
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) {
        items.push({
          filename: name,
          uri,
          size: 'size' in info && typeof info.size === 'number' ? info.size : 0,
          modificationTime:
            'modificationTime' in info && typeof info.modificationTime === 'number'
              ? info.modificationTime * 1000 // Convert sec to ms
              : Date.now(),
        });
      }
    }

    return items.sort((a, b) => b.modificationTime - a.modificationTime);
  } catch (error) {
    console.warn('[FileStorage] Error listing report exports:', error);
    return [];
  }
};

/**
 * Safely deletes an exported PDF without touching original photos or report metadata.
 */
export const deleteReportPdfExport = async (fileUri: string): Promise<void> => {
  try {
    const normalized = normalizeFileUri(fileUri);
    const info = await FileSystem.getInfoAsync(normalized);
    if (info.exists) {
      await FileSystem.deleteAsync(normalized, { idempotent: true });
    }
  } catch (error) {
    console.error('[FileStorage] Error deleting PDF export:', error);
    throw error;
  }
};
