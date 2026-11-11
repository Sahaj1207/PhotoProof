import React from 'react';
import { View, StyleSheet, ViewStyle, ViewProps } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export type CardVariant = 'default' | 'glass' | 'subtle' | 'outlined';

export interface CardProps extends ViewProps {
  variant?: CardVariant;
  padding?: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  children?: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'lg',
  style,
  children,
  ...rest
}) => {
  const { theme } = useTheme();

  const getPaddingValue = (): number => {
    switch (padding) {
      case 'none':
        return 0;
      case 'sm':
        return theme.spacing.sm;
      case 'md':
        return theme.spacing.md;
      case 'xl':
        return theme.spacing.xl;
      case 'lg':
      default:
        return theme.spacing.lg;
    }
  };

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
      case 'glass':
        return {
          backgroundColor: theme.colors.glassSurface,
          borderColor: theme.colors.glassBorder,
          borderWidth: theme.borderWidth.thin,
          ...theme.shadows.card,
        };
      case 'subtle':
        return {
          backgroundColor: theme.colors.surfaceSubtle,
          borderColor: 'transparent',
          borderWidth: 0,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderColor: theme.colors.borderSubtle,
          borderWidth: theme.borderWidth.thin,
        };
      case 'default':
      default:
        return {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.cardBorder,
          borderWidth: theme.borderWidth.hairline,
          ...theme.shadows.card,
        };
    }
  };

  return (
    <View
      style={[
        {
          borderRadius: theme.borderRadius.xl,
          padding: getPaddingValue(),
        },
        getVariantStyles(),
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};
