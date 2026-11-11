import AsyncStorage from '@react-native-async-storage/async-storage';

export interface InspectorProfile {
  name: string;
  role: string;
}

const INSPECTOR_PROFILE_KEY = '@photoproof_inspector_profile_v1';
const ONBOARDING_COMPLETED_KEY = '@photoproof_onboarding_completed_v1';

export const getInspectorProfile = async (): Promise<InspectorProfile | null> => {
  try {
    const raw = await AsyncStorage.getItem(INSPECTOR_PROFILE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

export const saveInspectorProfile = async (profile: InspectorProfile): Promise<void> => {
  try {
    await AsyncStorage.setItem(INSPECTOR_PROFILE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.error('[InspectorProfile] Error saving profile:', error);
  }
};

export const isOnboardingCompleted = async (): Promise<boolean> => {
  try {
    const val = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
    return val === 'true';
  } catch {
    return false;
  }
};

export const setOnboardingCompleted = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  } catch (error) {
    console.error('[InspectorProfile] Error marking onboarding completed:', error);
  }
};
