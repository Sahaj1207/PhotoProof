import React from 'react';
import {
  Text as RNText,
  TextProps as RNTextProps,
  StyleSheet,
  TextStyle,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { TypographyScale } from '../../theme/typography';

export type TextVariant = keyof TypographyScale;

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  color?: 'primary' | 'secondary' | 'tertiary' | 'accent' | 'error' | 'success' | 'warning' | string;
  weight?: TextStyle['fontWeight'];
  align?: TextStyle['textAlign'];
  children?: React.ReactNode;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = 'primary',
  weight,
  align,
  style,
  children,
  ...rest
}) => {
  const { theme } = useTheme();

  const getTextColor = (): string => {
    switch (color) {
      case 'primary':
        return theme.colors.textPrimary;
      case 'secondary':
        return theme.colors.textSecondary;
      case 'tertiary':
        return theme.colors.textTertiary;
      case 'accent':
        return theme.colors.primary;
      case 'error':
        return theme.colors.error;
      case 'success':
        return theme.colors.success;
      case 'warning':
        return theme.colors.warning;
      default:
        return color;
    }
  };

  const typographyStyle = theme.typography[variant];

  const computedStyle: TextStyle = {
    ...typographyStyle,
    color: getTextColor(),
    ...(weight ? { fontWeight: weight } : {}),
    ...(align ? { textAlign: align } : {}),
  };

  return (
    <RNText style={[computedStyle, style]} {...rest}>
      {children}
    </RNText>
  );
};
