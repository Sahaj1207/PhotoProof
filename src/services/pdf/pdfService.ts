import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system/legacy';
import { Report } from '../../models/Report';
import { buildReportHtml, validateReportPhotos } from './pdfTemplate';
import {
  ensureReportExportsDirectory,
  getReportExportsDirectory,
} from '../storage/fileStorage';

/**
 * Generates a professional PDF report on-device and offline.
 * The rendered file is copied into application document storage (with a base64
 * fallback) so it stays accessible on Expo Go and EAS standalone builds.
 * Returns the verified destination file URI.
 */
export const generateReportPdf = async (report: Report): Promise<string> => {
  try {
    // 0. Pre-validate photo files exist on disk
    const validation = await validateReportPhotos(report);
    if (!validation.valid && report.photos.length > 0) {
      console.warn(
        `[pdfService] Some photos could not be found on disk: #${validation.missingPhotos.join(', #')}`
      );
    }

    // 1. Build the complete HTML document
    const html = await buildReportHtml(report);

    // 2. Ensure destination exports directory exists in application document storage
    await ensureReportExportsDirectory(report.id);

    const sanitizedName =
      report.name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40) || 'Report';
    const filename = `PhotoProof_${sanitizedName}_${Date.now()}.pdf`;
    const destinationUri = `${getReportExportsDirectory(report.id)}${filename}`;

    // 3. Render the PDF to a temp file (A4). Avoid base64 output here: it pushes the
    // whole PDF through the JS bridge as a string, which is slow and memory-heavy.
    const printResult = await Print.printToFileAsync({ html, width: 595, height: 842 });
    if (!printResult?.uri) {
      throw new Error('PDF generation did not return a file');
    }

    // 4. Move it into app-owned storage. If the direct copy is refused (seen on some
    // Expo Go Android setups), fall back to re-rendering as base64 and writing it.
    try {
      await FileSystem.copyAsync({ from: printResult.uri, to: destinationUri });
    } catch (copyErr) {
      console.warn('[pdfService] copyAsync failed; falling back to base64 write:', copyErr);
      const fallback = await Print.printToFileAsync({ html, width: 595, height: 842, base64: true });
      if (!fallback?.base64) {
        return printResult.uri;
      }
      await FileSystem.writeAsStringAsync(destinationUri, fallback.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });
    }

    // 5. Verify destination file exists and is nonzero
    const destFileInfo = await FileSystem.getInfoAsync(destinationUri);
    if (!destFileInfo.exists || ('size' in destFileInfo && destFileInfo.size === 0)) {
      if (printResult.uri) {
        return printResult.uri;
      }
      throw new Error(`Exported PDF verification failed at: ${destinationUri}`);
    }

    // 6. Clean up temporary cache file if distinct and accessible
    if (printResult.uri && printResult.uri !== destinationUri) {
      try {
        await FileSystem.deleteAsync(printResult.uri, { idempotent: true });
      } catch {
        // Non-fatal cache cleanup
      }
    }

    return destinationUri;
  } catch (error) {
    console.error('[pdfService] Error generating report PDF:', error);
    throw error;
  }
};
