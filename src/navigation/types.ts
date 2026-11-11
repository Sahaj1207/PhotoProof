import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';

export type RootStackParamList = {
  Onboarding: undefined;
  Home: undefined;
  Settings: undefined;
  NewReport: undefined;
  Capture: { reportId: string };
  ReportDetails: { reportId: string };
  PhotoDetails: { reportId: string; photoId: string };
  PhotoEdit: { reportId: string; photoId: string };
  PdfPreview: { reportId: string };
};

export type OnboardingScreenProps = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;
export type HomeScreenProps = NativeStackScreenProps<RootStackParamList, 'Home'>;
export type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;
export type NewReportScreenProps = NativeStackScreenProps<RootStackParamList, 'NewReport'>;
export type CaptureScreenProps = NativeStackScreenProps<RootStackParamList, 'Capture'>;
export type ReportDetailsScreenProps = NativeStackScreenProps<RootStackParamList, 'ReportDetails'>;
export type PhotoDetailsScreenProps = NativeStackScreenProps<RootStackParamList, 'PhotoDetails'>;
export type PhotoEditScreenProps = NativeStackScreenProps<RootStackParamList, 'PhotoEdit'>;
export type PdfPreviewScreenProps = NativeStackScreenProps<RootStackParamList, 'PdfPreview'>;

export type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
