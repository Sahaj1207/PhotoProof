import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  ScrollView,
  Pressable,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useReports } from '../context/ReportsContext';
import { Text } from '../components/common/Text';
import { Button } from '../components/common/Button';
import { ScreenWrapper } from '../components/common/ScreenWrapper';
import {
  PhotoProofLogoMark,
  FolderIcon,
  DocumentPdfIcon,
  CameraIcon,
  ShieldCheckIcon,
} from '../components/icons/Icons';
import type { NewReportScreenProps } from '../navigation/types';

const QUICK_TEMPLATES = [
  { id: 'Move-Out', label: 'Move-Out', title: 'Apartment Move-Out', icon: FolderIcon },
  { id: 'Move-In', label: 'Move-In', title: 'Move-In Handover', icon: ShieldCheckIcon },
  { id: 'Inspection', label: 'Inspection', title: 'Site Inspection', icon: DocumentPdfIcon },
  { id: 'Damage', label: 'Damage', title: 'Damage Survey', icon: CameraIcon },
];

export const NewReportScreen: React.FC<NewReportScreenProps> = ({ navigation }) => {
  const { theme, isDark } = useTheme();
  const { createReport } = useReports();

  const [reportName, setReportName] = useState('');
  const [description, setDescription] = useState('');
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const descriptionRef = useRef<TextInput>(null);

  const isFormValid = reportName.trim().length > 0;

  const handleCancel = () => {
    Keyboard.dismiss();
    navigation.goBack();
  };

  const handleSelectTemplate = (title: string) => {
    setReportName(title);
  };

  const handleCreate = async () => {
    if (!isFormValid || isSubmitting) {
      return;
    }
    Keyboard.dismiss();
    setIsSubmitting(true);
    try {
      const newReport = await createReport(reportName, description);
      navigation.replace('Capture', { reportId: newReport.id });
    } catch (err) {
      console.error('[NewReportScreen] Error creating report:', err);
      setIsSubmitting(false);
    }
  };

  return (
    <ScreenWrapper style={styles.screenWrapper}>
      <View style={styles.container}>
        {/* Top Sheet Drag Indicator */}
        <View style={styles.sheetHandleRow}>
          <View
            style={[
              styles.sheetHandle,
              { backgroundColor: isDark ? '#38383A' : '#D1D1D6' },
            ]}
          />
        </View>

        {/* Top Header Row with Cancel & Title */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={handleCancel}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            style={({ pressed }) => [
              styles.cancelButton,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <Text variant="subhead" weight="500" color="accent">
              Cancel
            </Text>
          </Pressable>
          <Text variant="headline" weight="700" style={styles.sheetTitle}>
            New Report
          </Text>
          <View style={{ width: 44 }} />
        </View>

        <KeyboardAvoidingView
          behavior="padding"
          style={styles.keyboardAvoid}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 12 : 0}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode="on-drag"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.formContent}>
              {/* Visual Icon Header */}
              <View style={styles.iconCircleWrapper}>
                <View
                  style={[
                    styles.iconCircle,
                    { backgroundColor: theme.colors.surfaceSubtle },
                  ]}
                >
                  <PhotoProofLogoMark size={40} color={theme.colors.primary} />
                </View>
              </View>

              {/* Report Title Section */}
              <View style={styles.inputSection}>
                <Text variant="subhead" weight="700" style={styles.inputLabel}>
                  Report Title
                </Text>
                <TextInput
                  value={reportName}
                  onChangeText={setReportName}
                  placeholder="e.g. Apartment Move-Out"
                  placeholderTextColor={theme.colors.textTertiary}
                  autoFocus
                  selectionColor="#FF5500"
                  autoCapitalize="sentences"
                  returnKeyType="next"
                  submitBehavior="submit"
                  onSubmitEditing={() => descriptionRef.current?.focus()}
                  maxLength={80}
                  onFocus={() => setNameFocused(true)}
                  onBlur={() => setNameFocused(false)}
                  style={[
                    styles.textInput,
                    {
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.surfaceSubtle,
                      borderColor: nameFocused ? '#FF5500' : theme.colors.borderSubtle,
                    },
                  ]}
                />
              </View>

              {/* Quick Start Chips */}
              <View style={styles.quickStartSection}>
                <Text variant="subhead" weight="700" style={styles.inputLabel}>
                  Quick Start
                </Text>
                <View style={styles.quickStartGrid}>
                  {QUICK_TEMPLATES.map((item) => {
                    const isSelected = reportName === item.title;
                    const IconComponent = item.icon;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => handleSelectTemplate(item.title)}
                        style={({ pressed }) => [
                          styles.templateCard,
                          {
                            backgroundColor: isSelected
                              ? 'rgba(255, 85, 0, 0.12)'
                              : theme.colors.surfaceSubtle,
                            borderColor: isSelected
                              ? '#FF5500'
                              : theme.colors.borderSubtle,
                            opacity: pressed ? 0.75 : 1,
                          },
                        ]}
                      >
                        <View style={styles.templateIconCircle}>
                          <IconComponent
                            size={18}
                            color={isSelected ? '#FF5500' : '#8E8E93'}
                            strokeWidth={2}
                          />
                        </View>
                        <Text
                          variant="caption1"
                          weight={isSelected ? '700' : '500'}
                          color={isSelected ? 'accent' : 'primary'}
                          style={styles.templateLabel}
                        >
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              {/* Optional Location / Description Input */}
              <View style={styles.inputSection}>
                <Text variant="subhead" weight="700" style={styles.inputLabel}>
                  Location / Unit (Optional)
                </Text>
                <TextInput
                  ref={descriptionRef}
                  value={description}
                  onChangeText={setDescription}
                  placeholder="e.g. 123 Oak Street, Apt 4B"
                  placeholderTextColor={theme.colors.textTertiary}
                  selectionColor="#FF5500"
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                  maxLength={160}
                  onFocus={() => setDescFocused(true)}
                  onBlur={() => setDescFocused(false)}
                  style={[
                    styles.textInput,
                    {
                      color: theme.colors.textPrimary,
                      backgroundColor: theme.colors.surfaceSubtle,
                      borderColor: descFocused ? '#FF5500' : theme.colors.borderSubtle,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Bottom Action Button & Tagline */}
            <View style={styles.bottomContainer}>
              <Button
                title="Continue"
                variant="primary"
                size="lg"
                fullWidth
                loading={isSubmitting}
                disabled={!isFormValid || isSubmitting}
                style={styles.ctaButton}
                onPress={handleCreate}
              />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  sheetHandleRow: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  cancelButton: {
    paddingVertical: 4,
  },
  sheetTitle: {
    fontSize: 17,
  },
  keyboardAvoid: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },
  formContent: {
    paddingTop: 8,
  },
  iconCircleWrapper: {
    alignItems: 'center',
    marginVertical: 16,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputSection: {
    marginBottom: 20,
  },
  inputLabel: {
    marginBottom: 8,
  },
  textInput: {
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  quickStartSection: {
    marginBottom: 20,
  },
  quickStartGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  templateCard: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  templateIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 85, 0, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  templateLabel: {
    fontSize: 11,
  },
  bottomContainer: {
    paddingTop: 16,
    alignItems: 'center',
  },
  ctaButton: {
    borderRadius: 28,
    backgroundColor: '#FF5500',
  },
});
