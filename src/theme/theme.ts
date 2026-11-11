import { ThemeColors, lightColors, darkColors } from './colors';
import { typography, TypographyScale } from './typography';
import { spacing, Spacing } from './spacing';
import { borderRadius, borderWidth } from './borders';
import { lightShadows, darkShadows } from './shadows';
import { ViewStyle } from 'react-native';

export interface Theme {
  isDark: boolean;
  colors: ThemeColors;
  typography: TypographyScale;
  spacing: Spacing;
  borderRadius: typeof borderRadius;
  borderWidth: typeof borderWidth;
  shadows: Record<'subtle' | 'card' | 'elevated' | 'floating', ViewStyle>;
}

export const lightTheme: Theme = {
  isDark: false,
  colors: lightColors,
  typography,
  spacing,
  borderRadius,
  borderWidth,
  shadows: lightShadows,
};

export const darkTheme: Theme = {
  isDark: true,
  colors: darkColors,
  typography,
  spacing,
  borderRadius,
  borderWidth,
  shadows: darkShadows,
};
