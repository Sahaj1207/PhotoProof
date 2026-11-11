import * as FileSystem from 'expo-file-system/legacy';
import { Report } from '../../models/Report';
import { Photo } from '../../models/Photo';
import { formatDateTime, formatDate } from '../../utils/date';
import { formatPhotoNumber } from '../../utils/formatters';
import { getInspectorProfile } from '../storage/inspectorProfile';
import { normalizeFileUri } from '../storage/fileStorage';
import { computeCropGeometry, hasExactCrop } from '../../utils/crop';

/** Tallest an evidence photo may be on the page, in CSS px. */
const MAX_IMAGE_HEIGHT = 380;

/**
 * HTML for a cropped/rotated photo, using the same geometry as the in-app editor.
 * A padding-top box fixes the aspect ratio; width is capped so height <= MAX_IMAGE_HEIGHT.
 */
const renderExactCrop = (src: string, crop: Parameters<typeof computeCropGeometry>[0], sw: number, sh: number, alt: string): string => {
  const g = computeCropGeometry(crop, sw, sh);
  const maxWidth = Math.round(MAX_IMAGE_HEIGHT * g.outputAspect);
  return `
    <div style="width: 100%; max-width: ${maxWidth}px; margin: 0 auto;">
      <div style="position: relative; width: 100%; padding-top: ${(100 / g.outputAspect).toFixed(4)}%; overflow: hidden; background: #000000;">
        <div style="position: absolute; left: ${g.wrapper.left.toFixed(4)}%; top: ${g.wrapper.top.toFixed(4)}%; width: ${g.wrapper.width.toFixed(4)}%; height: ${g.wrapper.height.toFixed(4)}%;">
          <img src="${src}" alt="${alt}" style="position: absolute; left: ${g.image.left.toFixed(4)}%; top: ${g.image.top.toFixed(4)}%; width: ${g.image.width.toFixed(4)}%; height: ${g.image.height.toFixed(4)}%; transform: rotate(${g.rotation}deg); transform-origin: center center; object-fit: fill;" />
        </div>
      </div>
    </div>`;
};

/**
 * Escapes characters for HTML output to prevent injection or malformed layout.
 */
const escapeHtml = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Resolves a local image URI into a high-reliability Base64 data URI for offline PDF embedding.
 * Handles app restarts by normalizing sandbox paths to the current document directory.
 */
const resolveImageSource = async (fileUri: string): Promise<string> => {
  const normalized = normalizeFileUri(fileUri);
  try {
    let fileInfo = await FileSystem.getInfoAsync(normalized);
    if (!fileInfo.exists && normalized !== fileUri) {
      fileInfo = await FileSystem.getInfoAsync(fileUri);
    }

    if (!fileInfo.exists) {
      console.warn('[pdfTemplate] Photo file not found at:', normalized, 'or', fileUri);
      return '';
    }

    const targetPath = fileInfo.uri || normalized;
    const base64Data = await FileSystem.readAsStringAsync(targetPath, {
      encoding: 'base64',
    });

    if (!base64Data || base64Data.length === 0) {
      console.warn('[pdfTemplate] Base64 data empty for:', targetPath);
      return '';
    }

    return `data:image/jpeg;base64,${base64Data}`;
  } catch (err) {
    console.warn('[pdfTemplate] Failed to encode Base64 image:', normalized, err);
    return '';
  }
};

/**
 * Generates the complete HTML5 and print CSS document for the PDF.
 */
export const buildReportHtml = async (report: Report): Promise<string> => {
  const formattedCreationDate = formatDate(report.createdAt);
  const totalPhotos = report.photos.length;
  const inspector = await getInspectorProfile();

  // Resolve all photo image data URIs in controlled batches of 5 to preserve memory on large reports
  const photosWithImages: (Photo & { resolvedImageSrc: string })[] = [];
  const BATCH_SIZE = 5;
  for (let i = 0; i < report.photos.length; i += BATCH_SIZE) {
    const batch = report.photos.slice(i, i + BATCH_SIZE);
    const resolvedBatch = await Promise.all(
      batch.map(async (photo) => {
        const imageSrc = await resolveImageSource(photo.originalUri);
        return {
          ...photo,
          resolvedImageSrc: imageSrc,
        };
      })
    );
    photosWithImages.push(...resolvedBatch);
  }

  // Generate Photo Entry HTML blocks
  const photoEntriesHtml = photosWithImages
    .map((photo) => {
      const formattedCapturedAt = formatDateTime(photo.capturedAt);
      const photoNumberStr = formatPhotoNumber(photo.number);
      const hasLocation = !!(photo.latitude && photo.longitude) || !!photo.location;
      const latitude = photo.latitude ?? photo.location?.latitude;
      const longitude = photo.longitude ?? photo.location?.longitude;

      return `
      <div class="photo-entry-card">
        <div class="photo-header">
          <div class="photo-title-row">
            <span class="photo-badge">PHOTO #${photoNumberStr}</span>
            ${photo.category ? `<span class="category-pill">${escapeHtml(photo.category)}</span>` : ''}
          </div>
          <span class="photo-timestamp">${escapeHtml(formattedCapturedAt)}</span>
        </div>

        <div class="image-viewport">
          ${
            photo.resolvedImageSrc && hasExactCrop(photo.crop)
              ? renderExactCrop(photo.resolvedImageSrc, photo.crop, photo.crop.sourceWidth, photo.crop.sourceHeight, `Photo ${photoNumberStr}`)
              : photo.resolvedImageSrc
              ? photo.crop && (photo.crop.width < 0.98 || photo.crop.height < 0.98 || photo.crop.x > 0.02 || photo.crop.y > 0.02 || photo.crop.rotation)
                ? `
                <div class="cropped-container" style="position: relative; width: 100%; height: 360px; overflow: hidden; background: #000000; border-radius: 6px;">
                  <div style="position: absolute; left: -${((photo.crop.x || 0) / (photo.crop.width || 1)) * 100}%; top: -${((photo.crop.y || 0) / (photo.crop.height || 1)) * 100}%; width: ${(1 / (photo.crop.width || 1)) * 100}%; height: ${(1 / (photo.crop.height || 1)) * 100}%; transform: rotate(${photo.crop.rotation || 0}deg); transform-origin: center center;">
                    <img src="${photo.resolvedImageSrc}" style="width: 100%; height: 100%; object-fit: cover;" alt="Photo ${photoNumberStr}" />
                  </div>
                </div>
                `
                : `<img class="evidence-image" src="${photo.resolvedImageSrc}" style="${photo.crop?.rotation ? `transform: rotate(${photo.crop.rotation}deg);` : ''}" alt="Photo ${photoNumberStr}" />`
              : `<div class="image-missing">Photo file unavailable</div>`
          }
        </div>

        <div class="metadata-table">
          <div class="meta-row">
            <span class="meta-label">Location</span>
            <span class="meta-value ${hasLocation ? 'location-active' : 'location-none'}">
              ${
                hasLocation
                  ? `${latitude?.toFixed(5)}°, ${longitude?.toFixed(5)}°`
                  : 'Location unavailable'
              }
            </span>
          </div>

          ${
            photo.address
              ? `
          <div class="meta-row">
            <span class="meta-label">Address</span>
            <span class="meta-value">${escapeHtml(photo.address)}</span>
          </div>
          `
              : ''
          }

          ${
            photo.note
              ? `
          <div class="notes-block">
            <span class="notes-label">Inspector Remarks</span>
            <p class="notes-content">${escapeHtml(photo.note)}</p>
          </div>
          `
              : ''
          }
        </div>

        <div class="entry-footer">
          <span class="integrity-tag">✓ Original photo preserved &bull; Unmodified by PhotoProof</span>
        </div>
      </div>
      `;
    })
    .join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(report.name)} - Documentation Report</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 14mm 14mm 14mm 14mm;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      font-size: 13px;
      line-height: 1.45;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }

    /* Cover Page */
    .cover-page {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 255mm;
      padding: 10mm 6mm;
    }

    .cover-header {
      border-bottom: 2px solid #0F172A;
      padding-bottom: 16px;
    }

    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .brand-title {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #0F172A;
    }

    .report-type-badge {
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 1px;
      padding: 4px 10px;
      background: #F1F5F9;
      color: #0284C7;
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      text-transform: uppercase;
    }

    .brand-subtitle {
      font-size: 13px;
      color: #64748B;
      font-weight: 500;
    }

    .cover-body {
      margin: 36px 0;
    }

    .report-title {
      font-size: 32px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.2;
      margin-bottom: 16px;
      letter-spacing: -0.5px;
    }

    .report-description {
      font-size: 14px;
      color: #334155;
      line-height: 1.6;
      background: #F8FAFC;
      border-left: 3px solid #0284C7;
      padding: 14px 18px;
      border-radius: 0 6px 6px 0;
      margin-bottom: 30px;
    }

    .summary-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 24px;
    }

    .summary-card {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 8px;
      padding: 16px 20px;
    }

    .summary-card-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748B;
      font-weight: 600;
      margin-bottom: 4px;
    }

    .summary-card-value {
      font-size: 18px;
      font-weight: 700;
      color: #0F172A;
    }

    .cover-footer {
      border-top: 1px solid #E2E8F0;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #64748B;
    }

    /* Page Break */
    .page-break {
      page-break-before: always;
      break-before: page;
    }

    /* Photo Evidence Page & Entries */
    .evidence-section-header {
      border-bottom: 1px solid #0F172A;
      padding-bottom: 8px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .section-title {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0F172A;
    }

    .section-meta {
      font-size: 11px;
      color: #64748B;
    }

    .photo-entry-card {
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 18px;
      page-break-inside: avoid;
      break-inside: avoid;
    }

    .photo-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 1px solid #F1F5F9;
    }

    .photo-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .photo-badge {
      font-size: 12px;
      font-weight: 700;
      color: #0F172A;
    }

    .category-pill {
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      background: #E0F2FE;
      color: #0369A1;
      border-radius: 4px;
    }

    .photo-timestamp {
      font-size: 11px;
      color: #64748B;
      font-weight: 500;
    }

    .image-viewport {
      width: 100%;
      text-align: center;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 10px;
    }

    .evidence-image {
      max-width: 100%;
      max-height: 380px;
      width: auto;
      height: auto;
      display: inline-block;
      vertical-align: middle;
      object-fit: contain;
    }

    .image-missing {
      padding: 40px;
      color: #94A3B8;
      font-size: 12px;
    }

    .metadata-table {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 6px;
      padding: 10px 14px;
      margin-bottom: 8px;
    }

    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      padding: 3px 0;
    }

    .meta-label {
      color: #64748B;
      font-weight: 600;
    }

    .meta-value {
      color: #0F172A;
      font-weight: 500;
      text-align: right;
    }

    .location-active {
      color: #0284C7;
      font-weight: 600;
    }

    .location-none {
      color: #94A3B8;
      font-style: italic;
    }

    .notes-block {
      margin-top: 6px;
      padding-top: 6px;
      border-top: 1px solid #E2E8F0;
    }

    .notes-label {
      display: block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #64748B;
      margin-bottom: 2px;
    }

    .notes-content {
      font-size: 12px;
      color: #1E293B;
      line-height: 1.4;
      white-space: pre-wrap;
    }

    .entry-footer {
      display: flex;
      justify-content: flex-end;
      font-size: 9px;
      color: #94A3B8;
    }
  </style>
</head>
<body>

  <!-- COVER PAGE -->
  <div class="cover-page">
    <div class="cover-header">
      <div class="brand-row">
        <span class="brand-title">PhotoProof</span>
        <span class="report-type-badge">Photo Documentation Report</span>
      </div>
      <div class="brand-subtitle">Verified on-device photo inspection record</div>
    </div>

    <div class="cover-body">
      <h1 class="report-title">${escapeHtml(report.name)}</h1>
      ${
        report.description
          ? `<div class="report-description">${escapeHtml(report.description)}</div>`
          : ''
      }

      <div class="summary-grid">
        <div class="summary-card">
          <div class="summary-card-label">Created Date</div>
          <div class="summary-card-value">${escapeHtml(formattedCreationDate)}</div>
        </div>

        <div class="summary-card">
          <div class="summary-card-label">Total Photos</div>
          <div class="summary-card-value">${totalPhotos} ${totalPhotos === 1 ? 'Photo' : 'Photos'}</div>
        </div>

        <div class="summary-card">
          <div class="summary-card-label">Status</div>
          <div class="summary-card-value" style="color: #0284C7;">Verified Local Records</div>
        </div>

        ${
          inspector
            ? `
        <div class="summary-card">
          <div class="summary-card-label">Prepared By</div>
          <div class="summary-card-value" style="font-size: 15px;">${escapeHtml(inspector.name)}</div>
          ${inspector.role ? `<div style="font-size: 11px; color: #64748B; margin-top: 2px;">${escapeHtml(inspector.role)}</div>` : ''}
        </div>
        `
            : ''
        }

        <div class="summary-card">
          <div class="summary-card-label">Integrity Standard</div>
          <div class="summary-card-value" style="font-size: 13px; font-weight: 600;">Original Photos Preserved</div>
        </div>
      </div>
    </div>

    <div class="cover-footer">
      <span>Generated by PhotoProof Mobile</span>
      <span>${escapeHtml(report.name)} &bull; Page 1</span>
    </div>
  </div>

  <!-- EVIDENCE SECTION (PAGE 2+) -->
  ${
    totalPhotos > 0
      ? `
  <div class="page-break"></div>
  <div class="evidence-section-header">
    <span class="section-title">Photographic Evidence</span>
    <span class="section-meta">${escapeHtml(report.name)} &bull; ${totalPhotos} ${totalPhotos === 1 ? 'Entry' : 'Entries'}</span>
  </div>
  ${photoEntriesHtml}
  `
      : ''
  }

</body>
</html>
  `.trim();
};

/**
 * Validates that all photos in the report have readable files on disk.
 */
export const validateReportPhotos = async (
  report: Report
): Promise<{ valid: boolean; missingPhotos: number[] }> => {
  const missingPhotos: number[] = [];
  for (const photo of report.photos) {
    const normalized = normalizeFileUri(photo.originalUri);
    try {
      const info = await FileSystem.getInfoAsync(normalized);
      if (!info.exists) {
        missingPhotos.push(photo.number);
      }
    } catch {
      missingPhotos.push(photo.number);
    }
  }
  return {
    valid: missingPhotos.length === 0,
    missingPhotos,
  };
};
