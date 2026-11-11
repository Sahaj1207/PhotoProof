import React from 'react';
import { View, StyleSheet, Pressable, ViewStyle, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Text } from './Text';
import { ChevronLeftIcon } from '../icons/Icons';

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  largeTitle?: boolean;
  onBack?: () => void;
  backTitle?: string;
  rightAction?: React.ReactNode;
  style?: ViewStyle;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  largeTitle = false,
  onBack,
  backTitle = 'Back',
  rightAction,
  style,
}) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.container,
        !title && styles.navOnlyContainer,
        { paddingHorizontal: theme.spacing.lg },
        style,
      ]}
    >
      {/* Top Action Row (Back Button & Right Actions) */}
      {(onBack || rightAction) && (
        <View style={[styles.actionRow, !title && styles.navOnlyActionRow]}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityLabel={`Go back to ${backTitle}`}
              accessibilityRole="button"
              hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
              style={({ pressed }) => [styles.backButton, { opacity: pressed ? 0.6 : 1 }]}
            >
              <ChevronLeftIcon size={22} color={theme.colors.primary} strokeWidth={2.5} />
              <Text variant="body" color="accent" weight="500" style={styles.backTitleText}>
                {backTitle}
              </Text>
            </Pressable>
          ) : (
            <View />
          )}

          {rightAction ? <View style={styles.rightAction}>{rightAction}</View> : null}
        </View>
      )}

      {/* Header Title & Subtitle with Generous Hierarchy */}
      {title ? (
        <View
          style={[
            largeTitle ? styles.largeTitleContainer : styles.standardTitleContainer,
            !(onBack || rightAction) && styles.noActionRowOffset,
          ]}
        >
          <Text
            variant={largeTitle ? 'largeTitle' : 'title2'}
            weight="800"
            numberOfLines={1}
            style={styles.titleText}
          >
            {title}
          </Text>
          {subtitle ? (
            <Text
              variant="subhead"
              color="secondary"
              style={styles.subtitleText}
              numberOfLines={1}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: Platform.OS === 'ios' ? 12 : 8,
    paddingBottom: 16,
  },
  navOnlyContainer: {
    paddingBottom: 4,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    minHeight: 36,
  },
  navOnlyActionRow: {
    marginBottom: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  backTitleText: {
    marginLeft: 2,
    fontSize: 16,
  },
  rightAction: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  largeTitleContainer: {
    marginTop: 6,
  },
  standardTitleContainer: {
    marginTop: 4,
  },
  noActionRowOffset: {
    marginTop: 8,
  },
  titleText: {
    letterSpacing: -0.3,
  },
  subtitleText: {
    marginTop: 6,
    lineHeight: 18,
  },
});
