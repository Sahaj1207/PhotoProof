export interface ThemeColors {
  background: string;
  surface: string;
  surfaceSubtle: string;
  card: string;
  cardBorder: string;
  modal: string;
  primary: string;
  primaryActive: string;
  primaryMuted: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderSubtle: string;
  separator: string;
  success: string;
  warning: string;
  error: string;
  glassSurface: string;
  glassBorder: string;
  overlay: string;
}

export const lightColors: ThemeColors = {
  background: '#F8F9FA',
  surface: '#FFFFFF',
  surfaceSubtle: '#F1F3F5',
  card: '#FFFFFF',
  cardBorder: '#E5E5EA',
  modal: '#FFFFFF',
  primary: '#FF5500',
  primaryActive: '#E04B00',
  primaryMuted: 'rgba(255, 85, 0, 0.12)',
  textPrimary: '#111111',
  textSecondary: '#6C6C70',
  textTertiary: '#8E8E93',
  border: '#D1D1D6',
  borderSubtle: '#E5E5EA',
  separator: '#C6C6C8',
  success: '#34C759',
  warning: '#FF9500',
  error: '#FF3B30',
  glassSurface: 'rgba(255, 255, 255, 0.88)',
  glassBorder: 'rgba(0, 0, 0, 0.08)',
  overlay: 'rgba(0, 0, 0, 0.5)',
};

export const darkColors: ThemeColors = {
  background: '#0D0E11',
  surface: '#15171C',
  surfaceSubtle: '#1C1E24',
  card: '#15171C',
  cardBorder: 'rgba(255, 255, 255, 0.08)',
  modal: '#15171C',
  primary: '#FF5500',
  primaryActive: '#FF6F26',
  primaryMuted: 'rgba(255, 85, 0, 0.18)',
  textPrimary: '#FFFFFF',
  textSecondary: '#98989D',
  textTertiary: '#636366',
  border: '#282B33',
  borderSubtle: '#1E2128',
  separator: '#282B33',
  success: '#30D158',
  warning: '#FF9F0A',
  error: '#FF453A',
  glassSurface: 'rgba(21, 23, 28, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.75)',
};
