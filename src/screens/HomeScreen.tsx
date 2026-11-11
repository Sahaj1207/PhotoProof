import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  RefreshControl,
  Platform,
  Pressable,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useReports } from '../context/ReportsContext';
import { Text } from '../components/common/Text';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { ScreenWrapper } from '../components/common/ScreenWrapper';
import { ReportListItem } from '../components/Home/ReportListItem';
import { PhotoProofLogoMark, SettingsIcon, FolderIcon } from '../components/icons/Icons';
import type { HomeScreenProps } from '../navigation/types';
import type { Report } from '../models/Report';

export const HomeScreen: React.FC<HomeScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { reports, isHydrated, refreshReports, deleteReport } = useReports();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleNewReport = useCallback(() => {
    navigation.navigate('NewReport');
  }, [navigation]);

  const handleSelectReport = useCallback(
    (report: Report) => {
      navigation.navigate('ReportDetails', { reportId: report.id });
    },
    [navigation]
  );

  const handleDeleteReport = useCallback(
    (report: Report) => {
      Alert.alert(
        'Delete Report?',
        'This will permanently delete this report, its photos, metadata, and exported PDFs from this device. This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete Report',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteReport(report.id);
              } catch (err) {
                console.error('[HomeScreen] Error deleting report:', err);
                Alert.alert('Error', 'Failed to delete the report.');
              }
            },
          },
        ]
      );
    },
    [deleteReport]
  );

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshReports();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshReports]);

  const hasReports = reports.length > 0;

  const keyExtractor = useCallback((item: Report) => item.id, []);

  const renderItem = useCallback(
    ({ item }: { item: Report }) => {
      return (
        <ReportListItem
          report={item}
          onPress={handleSelectReport}
          onDelete={handleDeleteReport}
        />
      );
    },
    [handleSelectReport, handleDeleteReport]
  );

  const listHeader = useMemo(
    () => (
      <View style={styles.headerContainer}>
        {/* Top Title Row with Logo, Brand Name & Offline Badge */}
        <View style={styles.titleRow}>
          <View style={styles.brandTitleRow}>
            <PhotoProofLogoMark size={36} color={theme.colors.primary} />
            <Text variant="largeTitle" weight="800" style={styles.brandTitleText}>
              PhotoProof
            </Text>
          </View>

          <View
            style={[
              styles.badge,
              {
                backgroundColor: theme.colors.primaryMuted,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            <Text
              variant="caption2"
              weight="700"
              color="accent"
              style={styles.badgeText}
            >
              OFFLINE
            </Text>
          </View>
        </View>

        {/* Large Visible Gap & Calm Subtitle */}
        <Text
          variant="body"
          color="secondary"
          style={styles.headerSubtitle}
        >
          Verified on-device photo documentation
        </Text>

        {/* Substantial Intentional Separation Before RECENT REPORTS */}
        {hasReports && (
          <View style={styles.sectionHeaderRow}>
            <Text
              variant="caption1"
              weight="700"
              color="secondary"
              style={styles.sectionTitle}
            >
              RECENT REPORTS
            </Text>
            <Text variant="caption2" color="tertiary">
              {reports.length} {reports.length === 1 ? 'report' : 'reports'}
            </Text>
          </View>
        )}
      </View>
    ),
    [
      hasReports,
      reports.length,
      theme.colors.primary,
      theme.colors.primaryMuted,
    ]
  );

  if (!isHydrated) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <Text variant="subhead" color="secondary">
            Loading reports...
          </Text>
        </View>
      </ScreenWrapper>
    );
  }

  // Dynamic bottom padding respecting home indicator
  const bottomBarPadding = Math.max(insets.bottom, Platform.OS === 'ios' ? 24 : 16) + 12;

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {hasReports ? (
          <FlatList
            data={reports}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            ListHeaderComponent={listHeader}
            contentContainerStyle={[
              styles.listContent,
              {
                paddingHorizontal: theme.spacing.lg,
                paddingBottom: bottomBarPadding + 140,
              },
            ]}
            showsVerticalScrollIndicator={false}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={5}
            removeClippedSubviews={Platform.OS === 'android'}
            refreshControl={
              <RefreshControl
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
                colors={[theme.colors.primary]}
              />
            }
          />
        ) : (
          <View
            style={[
              styles.emptyContainer,
              { paddingHorizontal: theme.spacing.lg },
            ]}
          >
            {listHeader}
            <Card variant="glass" padding="xl" style={styles.emptyCard}>
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: theme.colors.primaryMuted },
                ]}
              >
                <FolderIcon size={36} color={theme.colors.primary} strokeWidth={1.8} />
              </View>

              <Text
                variant="title3"
                weight="700"
                align="center"
                style={styles.emptyTitle}
              >
                No Reports Yet
              </Text>

              <Text
                variant="callout"
                color="secondary"
                align="center"
                style={styles.emptyDescription}
              >
                PhotoProof keeps your documentation organized locally. Create your first report to start capturing verified photos.
              </Text>

              <View style={styles.cardActionWrapper}>
                <Button
                  title="Create Your First Report"
                  variant="primary"
                  size="lg"
                  fullWidth
                  onPress={handleNewReport}
                />
              </View>
            </Card>
          </View>
        )}

        {/* Dedicated Bottom Action Area: Floating Tools Above New Report */}
        <View
          pointerEvents="box-none"
          style={[
            styles.bottomActionContainer,
            {
              paddingBottom: bottomBarPadding,
              paddingHorizontal: theme.spacing.lg,
            },
          ]}
        >
          {/* Floating Circular Glass Tools Button (Aligned to Right, Sits ABOVE New Report) */}
          <View pointerEvents="box-none" style={styles.floatingToolsRow}>
            <Pressable
              onPress={() => navigation.navigate('Settings')}
              accessibilityLabel="Tools and settings"
              accessibilityRole="button"
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [
                styles.floatingToolsButton,
                {
                  backgroundColor: 'rgba(28, 30, 36, 0.92)',
                  borderColor: 'rgba(255, 255, 255, 0.18)',
                  opacity: pressed ? 0.7 : 1,
                  transform: [{ scale: pressed ? 0.94 : 1 }],
                },
              ]}
            >
              <SettingsIcon size={22} color="#FFFFFF" strokeWidth={2} />
            </Pressable>
          </View>

          {/* Primary Action Button (Completely Unobstructed) */}
          {hasReports && (
            <Button
              title="New Report"
              variant="primary"
              size="lg"
              fullWidth
              onPress={handleNewReport}
            />
          )}
        </View>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerContainer: {
    paddingTop: Platform.OS === 'ios' ? 44 : 28,
    paddingBottom: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 52,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  brandTitleText: {
    letterSpacing: -0.6,
  },
  headerSubtitle: {
    marginTop: 20,
    lineHeight: 24,
    fontSize: 16,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 0.5,
  },
  badgeText: {
    letterSpacing: 0.8,
    fontSize: 11,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 56,
  },
  sectionTitle: {
    letterSpacing: 0.8,
    fontSize: 12,
  },
  listContent: {
    paddingBottom: 160,
  },
  emptyContainer: {
    flex: 1,
  },
  emptyCard: {
    alignItems: 'center',
    marginTop: 40,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    marginBottom: 10,
  },
  emptyDescription: {
    marginBottom: 28,
    maxWidth: 300,
    lineHeight: 24,
  },
  cardActionWrapper: {
    width: '100%',
  },
  bottomActionContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
  },
  floatingToolsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 14,
  },
  floatingToolsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
});
