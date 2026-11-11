import AsyncStorage from '@react-native-async-storage/async-storage';

export type AppearancePreference = 'system' | 'light' | 'dark';

const APPEARANCE_STORAGE_KEY = '@photoproof_appearance_preference_v1';

export const getSavedAppearance = async (): Promise<AppearancePreference> => {
  try {
    const val = await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY);
    if (val === 'light' || val === 'dark' || val === 'system') {
      return val;
    }
    return 'system';
  } catch {
    return 'system';
  }
};

export const saveAppearance = async (pref: AppearancePreference): Promise<void> => {
  try {
    await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, pref);
  } catch (err) {
    console.error('[SettingsService] Failed to save appearance:', err);
  }
};
