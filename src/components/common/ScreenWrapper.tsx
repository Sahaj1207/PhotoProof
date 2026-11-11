import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView, SafeAreaViewProps, Edge } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../hooks/useTheme';

export interface ScreenWrapperProps extends SafeAreaViewProps {
  children: React.ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
  contentContainerStyle?: ViewStyle;
  backgroundColor?: string;
  statusBarStyle?: 'auto' | 'inverted' | 'light' | 'dark';
}

export const ScreenWrapper: React.FC<ScreenWrapperProps> = ({
  children,
  edges = ['top', 'left', 'right'],
  style,
  backgroundColor,
  statusBarStyle,
  ...rest
}) => {
  const { theme, isDark } = useTheme();

  const activeBackgroundColor = backgroundColor || theme.colors.background;
  const activeStatusBarStyle = statusBarStyle || (isDark ? 'light' : 'dark');

  return (
    <SafeAreaView
      edges={edges}
      style={[
        styles.container,
        { backgroundColor: activeBackgroundColor },
        style,
      ]}
      {...rest}
    >
      <StatusBar style={activeStatusBarStyle} />
      {children}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
