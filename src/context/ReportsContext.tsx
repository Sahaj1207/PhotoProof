import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  ReactNode,
} from 'react';
import { Report } from '../models/Report';
import { Photo, PhotoCategory, PhotoCrop } from '../models/Photo';
import { generateId, getNowIso } from '../utils';
import { loadPersistedReports, persistReports } from '../services/storage/storageService';
import { deleteReportDirectory, deletePhotoFile } from '../services/storage/fileStorage';

export interface PhotoMetadataUpdates {
  note?: string | null;
  category?: PhotoCategory | null;
  crop?: PhotoCrop | null;
}

interface ReportsContextValue {
  reports: Report[];
  isHydrated: boolean;
  createReport: (name: string, description?: string) => Promise<Report>;
  addPhotoToReport: (reportId: string, photo: Photo) => Promise<Report>;
  updatePhotoMetadata: (
    reportId: string,
    photoId: string,
    updates: PhotoMetadataUpdates
  ) => Promise<Report>;
  updatePhotoCrop: (reportId: string, photoId: string, crop: PhotoCrop | null) => Promise<Report>;
  deleteReport: (reportId: string) => Promise<void>;
  deletePhotos: (reportId: string, photoIds: string[]) => Promise<Report>;
  getReport: (id: string) => Report | undefined;
  getPhoto: (reportId: string, photoId: string) => Photo | undefined;
  refreshReports: () => Promise<void>;
}

const ReportsContext = createContext<ReportsContextValue | undefined>(undefined);

export const ReportsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [reports, setReports] = useState<Report[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  // Source of truth for mutations. Reading from a ref (instead of inside a setState
  // updater) keeps side effects out of React's render phase and lets every mutation
  // see the result of the previous one immediately, even before a re-render.
  const reportsRef = useRef<Report[]>([]);

  // All AsyncStorage writes go through one serial queue so they can never land
  // out of order and overwrite newer data with an older snapshot.
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());

  const commit = useCallback((next: Report[]): Promise<void> => {
    reportsRef.current = next;
    setReports(next);
    // A failed write is logged, not thrown: the in-memory state is already updated
    // and the next successful write will persist it, so callers should not roll back.
    writeQueueRef.current = writeQueueRef.current
      .then(() => persistReports(next))
      .catch((err) => {
        console.error('[ReportsContext] persist error:', err);
      });
    return writeQueueRef.current;
  }, []);

  const loadInitialReports = useCallback(async () => {
    try {
      // Let pending writes finish first so a refresh never reads stale data.
      await writeQueueRef.current;
      const persisted = await loadPersistedReports();
      reportsRef.current = persisted;
      setReports(persisted);
    } catch (err) {
      console.warn('[ReportsContext] Failed to load persisted reports:', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    loadInitialReports();
  }, [loadInitialReports]);

  /**
   * Applies `transform` to a single report, commits, and returns the updated report.
   */
  const updateReport = useCallback(
    async (reportId: string, transform: (report: Report) => Report): Promise<Report> => {
      const current = reportsRef.current;
      const index = current.findIndex((r) => r.id === reportId);
      if (index === -1) {
        throw new Error(`Report with id ${reportId} not found`);
      }
      const updated = { ...transform(current[index]), updatedAt: getNowIso() };
      const next = current.slice();
      next[index] = updated;
      await commit(next);
      return updated;
    },
    [commit]
  );

  const createReport = useCallback(
    async (name: string, description?: string): Promise<Report> => {
      const trimmedDescription = description?.trim();
      const newReport: Report = {
        id: generateId('rep'),
        name: name.trim(),
        createdAt: getNowIso(),
        photos: [],
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
      };
      await commit([newReport, ...reportsRef.current]);
      return newReport;
    },
    [commit]
  );

  const addPhotoToReport = useCallback(
    (reportId: string, photo: Photo) =>
      updateReport(reportId, (r) => ({ ...r, photos: [...r.photos, photo] })),
    [updateReport]
  );

  const updatePhotoMetadata = useCallback(
    (reportId: string, photoId: string, updates: PhotoMetadataUpdates) =>
      updateReport(reportId, (r) => ({
        ...r,
        photos: r.photos.map((p) =>
          p.id === photoId
            ? {
                ...p,
                ...(updates.note !== undefined ? { note: updates.note } : {}),
                ...(updates.category !== undefined ? { category: updates.category } : {}),
                ...(updates.crop !== undefined ? { crop: updates.crop } : {}),
              }
            : p
        ),
      })),
    [updateReport]
  );

  const updatePhotoCrop = useCallback(
    (reportId: string, photoId: string, crop: PhotoCrop | null) =>
      updatePhotoMetadata(reportId, photoId, { crop }),
    [updatePhotoMetadata]
  );

  const deleteReport = useCallback(
    async (reportId: string): Promise<void> => {
      // Remove from the list first so the UI updates instantly, then clean up files.
      await commit(reportsRef.current.filter((r) => r.id !== reportId));
      await deleteReportDirectory(reportId);
    },
    [commit]
  );

  const deletePhotos = useCallback(
    async (reportId: string, photoIds: string[]): Promise<Report> => {
      const idSet = new Set(photoIds);
      const report = reportsRef.current.find((r) => r.id === reportId);
      const removed = report ? report.photos.filter((p) => idSet.has(p.id)) : [];

      const updated = await updateReport(reportId, (r) => ({
        ...r,
        photos: r.photos.filter((p) => !idSet.has(p.id)),
      }));

      // Metadata is saved; now remove the files without blocking the caller.
      Promise.all(removed.map((p) => deletePhotoFile(p.originalUri))).catch((err) =>
        console.warn('[ReportsContext] Error deleting photo files:', err)
      );
      return updated;
    },
    [updateReport]
  );

  const getReport = useCallback(
    (id: string): Report | undefined => reports.find((r) => r.id === id),
    [reports]
  );

  const getPhoto = useCallback(
    (reportId: string, photoId: string): Photo | undefined =>
      reports.find((r) => r.id === reportId)?.photos.find((p) => p.id === photoId),
    [reports]
  );

  const contextValue = useMemo(
    () => ({
      reports,
      isHydrated,
      createReport,
      addPhotoToReport,
      updatePhotoMetadata,
      updatePhotoCrop,
      deleteReport,
      deletePhotos,
      getReport,
      getPhoto,
      refreshReports: loadInitialReports,
    }),
    [
      reports,
      isHydrated,
      createReport,
      addPhotoToReport,
      updatePhotoMetadata,
      updatePhotoCrop,
      deleteReport,
      deletePhotos,
      getReport,
      getPhoto,
      loadInitialReports,
    ]
  );

  return <ReportsContext.Provider value={contextValue}>{children}</ReportsContext.Provider>;
};

export const useReports = (): ReportsContextValue => {
  const context = useContext(ReportsContext);
  if (!context) {
    throw new Error('useReports must be used within a ReportsProvider');
  }
  return context;
};
