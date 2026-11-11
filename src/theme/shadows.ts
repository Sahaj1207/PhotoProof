import { Platform, ViewStyle } from 'react-native';

export interface ShadowToken {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export const lightShadows: Record<'subtle' | 'card' | 'elevated' | 'floating', ViewStyle> = {
  subtle: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.04,
      shadowRadius: 2,
    },
    default: {
      elevation: 1,
    },
  }) as ViewStyle,
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.06,
      shadowRadius: 8,
    },
    default: {
      elevation: 2,
    },
  }) as ViewStyle,
  elevated: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 16,
    },
    default: {
      elevation: 4,
    },
  }) as ViewStyle,
  floating: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.14,
      shadowRadius: 24,
    },
    default: {
      elevation: 8,
    },
  }) as ViewStyle,
};

export const darkShadows: Record<'subtle' | 'card' | 'elevated' | 'floating', ViewStyle> = {
  subtle: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
    },
    default: {
      elevation: 1,
    },
  }) as ViewStyle,
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.4,
      shadowRadius: 8,
    },
    default: {
      elevation: 2,
    },
  }) as ViewStyle,
  elevated: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.5,
      shadowRadius: 16,
    },
    default: {
      elevation: 4,
    },
  }) as ViewStyle,
  floating: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.6,
      shadowRadius: 24,
    },
    default: {
      elevation: 8,
    },
  }) as ViewStyle,
};
