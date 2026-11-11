import AsyncStorage from '@react-native-async-storage/async-storage';
import { Report } from '../../models/Report';

const REPORTS_STORAGE_KEY = '@photoproof_reports_v1';

/**
 * Loads all saved reports and their photo metadata from AsyncStorage.
 */
export const loadPersistedReports = async (): Promise<Report[]> => {
  try {
    const rawData = await AsyncStorage.getItem(REPORTS_STORAGE_KEY);
    if (!rawData) {
      return [];
    }
    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed as Report[];
  } catch (error) {
    console.warn('[StorageService] Error loading reports from storage:', error);
    return [];
  }
};

/**
 * Persists all reports and their photo metadata to AsyncStorage.
 */
export const persistReports = async (reports: Report[]): Promise<void> => {
  try {
    const serialized = JSON.stringify(reports);
    await AsyncStorage.setItem(REPORTS_STORAGE_KEY, serialized);
  } catch (error) {
    console.error('[StorageService] Error persisting reports:', error);
    throw error;
  }
};
