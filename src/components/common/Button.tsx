import React from 'react';
import {
  Pressable,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  PressableProps,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<PressableProps, 'style'> {
  title: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  textStyle,
  icon,
  onPress,
  ...rest
}) => {
  const { theme } = useTheme();

  const getContainerStyles = (pressed: boolean): ViewStyle => {
    let baseBackground = theme.colors.primary;
    let borderColor = 'transparent';
    let borderWidth = 0;

    switch (variant) {
      case 'primary':
        baseBackground = theme.colors.primary;
        break;
      case 'secondary':
        baseBackground = theme.colors.primaryMuted;
        break;
      case 'outline':
        baseBackground = 'transparent';
        borderColor = theme.colors.border;
        borderWidth = theme.borderWidth.thin;
        break;
      case 'ghost':
        baseBackground = 'transparent';
        break;
      case 'destructive':
        baseBackground = theme.colors.error;
        break;
    }

    let paddingVertical: number = theme.spacing.md;
    let paddingHorizontal: number = theme.spacing.xl;
    let minHeight = 48;

    if (size === 'sm') {
      paddingVertical = theme.spacing.sm;
      paddingHorizontal = theme.spacing.md;
      minHeight = 36;
    } else if (size === 'lg') {
      paddingVertical = theme.spacing.lg;
      paddingHorizontal = theme.spacing.xxl;
      minHeight = 56;
    }

    return {
      backgroundColor: baseBackground,
      borderColor,
      borderWidth,
      borderRadius: theme.borderRadius.lg,
      paddingVertical,
      paddingHorizontal,
      minHeight,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      opacity: disabled ? 0.45 : pressed ? 0.75 : 1,
      width: fullWidth ? '100%' : undefined,
      alignSelf: fullWidth ? 'stretch' : 'flex-start',
    };
  };

  const getTextColor = (): 'primary' | 'secondary' | 'accent' | 'error' | string => {
    switch (variant) {
      case 'primary':
      case 'destructive':
        return '#FFFFFF';
      case 'secondary':
      case 'outline':
      case 'ghost':
        return theme.colors.primary;
      default:
        return '#FFFFFF';
    }
  };

  const getTextVariant = () => {
    switch (size) {
      case 'sm':
        return 'footnote';
      case 'lg':
        return 'headline';
      default:
        return 'body';
    }
  };

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [getContainerStyles(pressed), style]}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' || variant === 'destructive' ? '#FFFFFF' : theme.colors.primary}
        />
      ) : (
        <>
          {icon ? <>{icon}</> : null}
          <Text
            variant={getTextVariant()}
            weight="600"
            color={getTextColor()}
            style={[styles.text, icon ? styles.textWithIcon : undefined, textStyle]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  text: {
    textAlign: 'center',
  },
  textWithIcon: {
    marginLeft: 8,
  },
});
