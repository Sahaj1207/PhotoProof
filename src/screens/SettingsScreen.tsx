import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Alert,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Text } from '../components/common/Text';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Header } from '../components/common/Header';
import { ScreenWrapper } from '../components/common/ScreenWrapper';
import { AppearancePreference } from '../services/storage/settingsService';
import {
  getInspectorProfile,
  saveInspectorProfile,
} from '../services/storage/inspectorProfile';
import {
  ShieldCheckIcon,
  CameraIcon,
  LocationPinIcon,
} from '../components/icons/Icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ navigation }) => {
  const { theme, appearance, setAppearance } = useTheme();

  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      const p = await getInspectorProfile();
      if (p) {
        setCompanyName(p.name || '');
        setRole(p.role || '');
      }
    };
    loadProfile();
  }, []);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleSaveProfile = useCallback(async () => {
    Keyboard.dismiss();
    setIsSavingProfile(true);
    try {
      await saveInspectorProfile({
        name: companyName.trim(),
        role: role.trim(),
      });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 2500);
    } catch {
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setIsSavingProfile(false);
    }
  }, [companyName, role]);

  const appearanceOptions: { id: AppearancePreference; label: string; desc: string }[] = useMemo(
    () => [
      { id: 'system', label: 'System', desc: 'Match device appearance settings' },
      { id: 'light', label: 'Light', desc: 'Clean white surfaces with dark typography' },
      { id: 'dark', label: 'Dark', desc: 'Deep neutral dark theme for low light' },
    ],
    []
  );

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Header title="Settings" onBack={handleBack} backTitle="Back" />

        <KeyboardAvoidingView
          behavior="padding"
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingHorizontal: theme.spacing.lg },
            ]}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Appearance Section */}
            <View style={styles.sectionHeaderRow}>
              <Text variant="caption1" weight="700" color="secondary" style={styles.sectionTitle}>
                APPEARANCE
              </Text>
            </View>

            <Card variant="default" padding="none" style={styles.groupCard}>
              {appearanceOptions.map((opt, idx) => {
                const isSelected = appearance === opt.id;
                const isLast = idx === appearanceOptions.length - 1;
                return (
                  <Pressable
                    key={opt.id}
                    onPress={() => setAppearance(opt.id)}
                    style={({ pressed }) => [
                      styles.optionRow,
                      { opacity: pressed ? 0.75 : 1 },
                      !isLast && {
                        borderBottomWidth: StyleSheet.hairlineWidth,
                        borderBottomColor: theme.colors.borderSubtle,
                      },
                    ]}
                  >
                    <View style={styles.optionTextContainer}>
                      <Text variant="body" weight="600">
                        {opt.label}
                      </Text>
                      <Text variant="caption1" color="secondary" style={{ marginTop: 2 }}>
                        {opt.desc}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.radioCircle,
                        {
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                          backgroundColor: isSelected ? theme.colors.primary : 'transparent',
                        },
                      ]}
                    >
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </Pressable>
                );
              })}
            </Card>

            {/* Inspector Profile Section */}
            <View style={styles.sectionHeaderRow}>
              <Text variant="caption1" weight="700" color="secondary" style={styles.sectionTitle}>
                REPORT SIGNATURE & PROFILE
              </Text>
            </View>

            <Card variant="glass" padding="md" style={styles.groupCard}>
              <Text variant="caption2" color="secondary" style={{ marginBottom: 12 }}>
                Printed on the cover page of every generated PDF report.
              </Text>

              <View style={styles.inputGroup}>
                <Text variant="caption1" weight="600" color="secondary" style={styles.inputLabel}>
                  COMPANY OR INSPECTOR NAME
                </Text>
                <TextInput
                  value={companyName}
                  onChangeText={setCompanyName}
                  placeholder="e.g. Fenwick Property Services"
                  placeholderTextColor={theme.colors.textTertiary}
                  selectionColor="#FF5500"
                  style={[
                    styles.input,
                    {
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.surfaceSubtle,
                      borderColor: theme.colors.borderSubtle,
                    },
                  ]}
                />
              </View>

              <View style={[styles.inputGroup, { marginTop: 14 }]}>
                <Text variant="caption1" weight="600" color="secondary" style={styles.inputLabel}>
                  TRADE OR ROLE
                </Text>
                <TextInput
                  value={role}
                  onChangeText={setRole}
                  placeholder="e.g. Property Inspector"
                  placeholderTextColor={theme.colors.textTertiary}
                  selectionColor="#FF5500"
                  style={[
                    styles.input,
                    {
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.surfaceSubtle,
                      borderColor: theme.colors.borderSubtle,
                    },
                  ]}
                />
              </View>

              <Button
                title={profileSaved ? 'Profile Saved' : 'Save Signature'}
                variant="primary"
                size="md"
                fullWidth
                loading={isSavingProfile}
                style={{ marginTop: 16 }}
                onPress={handleSaveProfile}
              />
            </Card>

            {/* Trust & Privacy Section */}
            <View style={styles.sectionHeaderRow}>
              <Text variant="caption1" weight="700" color="secondary" style={styles.sectionTitle}>
                TRUST & PRIVACY GUARANTEES
              </Text>
            </View>

            <Card variant="glass" padding="md" style={styles.groupCard}>
              <View style={styles.trustItem}>
                <View style={styles.trustIconCircle}>
                  <ShieldCheckIcon size={18} color="#FF5500" strokeWidth={2} />
                </View>
                <View style={styles.trustTextContainer}>
                  <Text variant="subhead" weight="600">
                    100% On-Device & Offline
                  </Text>
                  <Text variant="caption1" color="secondary" style={{ marginTop: 2 }}>
                    No accounts, no cloud sync, and no tracking. All photos and reports live exclusively on this device.
                  </Text>
                </View>
              </View>

              <View style={styles.trustItem}>
                <View style={styles.trustIconCircle}>
                  <CameraIcon size={18} color="#FF5500" strokeWidth={2} />
                </View>
                <View style={styles.trustTextContainer}>
                  <Text variant="subhead" weight="600">
                    Original Photo Preservation
                  </Text>
                  <Text variant="caption1" color="secondary" style={{ marginTop: 2 }}>
                    Original captured photo files are never cropped, watermarked, or modified.
                  </Text>
                </View>
              </View>

              <View style={styles.trustItem}>
                <View style={styles.trustIconCircle}>
                  <LocationPinIcon size={18} color="#FF5500" strokeWidth={2} />
                </View>
                <View style={styles.trustTextContainer}>
                  <Text variant="subhead" weight="600">
                    Verifiable Metadata
                  </Text>
                  <Text variant="caption1" color="secondary" style={{ marginTop: 2 }}>
                    Timestamps and GPS coordinates are recorded at capture time and formatted into executive PDF proofs.
                  </Text>
                </View>
              </View>
            </Card>

            {/* App Version Info */}
            <View style={styles.versionFooter}>
              <Text variant="caption2" color="tertiary" align="center">
                PhotoProof v1.0.0 · Production Release
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 48,
    paddingTop: 8,
  },
  sectionHeaderRow: {
    marginTop: 28,
    marginBottom: 10,
  },
  sectionTitle: {
    letterSpacing: 0.8,
  },
  groupCard: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionTextContainer: {
    flex: 1,
    marginRight: 12,
  },
  radioCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  inputGroup: {
    width: '100%',
  },
  inputLabel: {
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginVertical: 8,
  },
  trustIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 85, 0, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  trustTextContainer: {
    flex: 1,
  },
  versionFooter: {
    marginTop: 20,
    marginBottom: 16,
  },
});
