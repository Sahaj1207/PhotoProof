import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';

export type ShareResultStatus =
  | 'SUCCESS'
  | 'CANCELLED'
  | 'GENERATION_FAILED'
  | 'FILE_INVALID'
  | 'COPY_FAILED'
  | 'SHARING_UNAVAILABLE'
  | 'SHARING_FAILED';

export interface ShareResult {
  status: ShareResultStatus;
  uri?: string;
  error?: string;
}

/**
 * Opens the platform-native share sheet for a verified application-owned PDF file.
 * Handles user dismissal, cancellation, and errors with granular status codes.
 */
export const sharePdfFile = async (
  pdfUri: string,
  reportName: string
): Promise<ShareResult> => {
  try {
    // 1. Verify file exists on disk
    const fileInfo = await FileSystem.getInfoAsync(pdfUri);
    if (!fileInfo.exists) {
      console.warn('[sharingService] Cannot share non-existent file:', pdfUri);
      return {
        status: 'FILE_INVALID',
        uri: pdfUri,
        error: 'The PDF file is missing on disk.',
      };
    }

    // 2. Check platform capability
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      console.warn('[sharingService] Sharing is not available on this platform/device');
      return {
        status: 'SHARING_UNAVAILABLE',
        uri: pdfUri,
        error: 'Sharing is not supported on this device/runtime.',
      };
    }

    // 3. Invoke native share sheet with explicit PDF MIME metadata and standard UTI
    await Sharing.shareAsync(pdfUri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share ${reportName} Report`,
      UTI: '.pdf',
    });

    return {
      status: 'SUCCESS',
      uri: pdfUri,
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.log('[sharingService] Share sheet interaction outcome:', errorMsg);

    // Differentiate user dismissal/cancellation from fatal sharing errors
    const isUserDismissal =
      errorMsg.toLowerCase().includes('cancel') ||
      errorMsg.toLowerCase().includes('dismiss') ||
      errorMsg.toLowerCase().includes('user');

    if (isUserDismissal) {
      return {
        status: 'CANCELLED',
        uri: pdfUri,
      };
    }

    return {
      status: 'SHARING_FAILED',
      uri: pdfUri,
      error: errorMsg,
    };
  }
};
