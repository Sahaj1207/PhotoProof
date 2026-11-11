import React, { useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { Text } from '../components/common/Text';
import { Button } from '../components/common/Button';
import { ScreenWrapper } from '../components/common/ScreenWrapper';
import { locationService } from '../services/location/locationService';
import {
  saveInspectorProfile,
  setOnboardingCompleted,
} from '../services/storage/inspectorProfile';
import {
  PhotoProofLogoMark,
  CameraIcon,
  DocumentPdfIcon,
} from '../components/icons/Icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>;

export const OnboardingScreen: React.FC<Props> = ({ navigation }) => {
  const { theme } = useTheme();
  const [slideIndex, setSlideIndex] = useState(0);

  // Profile Form (Slide 3)
  const [companyName, setCompanyName] = useState('');
  const [role, setRole] = useState('');
  const [companyFocused, setCompanyFocused] = useState(false);
  const [roleFocused, setRoleFocused] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFinish = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (companyName.trim()) {
        await saveInspectorProfile({
          name: companyName.trim(),
          role: role.trim() || 'Inspector',
        });
      }
      await setOnboardingCompleted();
      await locationService.requestPermission();
      navigation.replace('Home');
    } catch {
      navigation.replace('Home');
    }
  };

  const handleSkip = async () => {
    await setOnboardingCompleted();
    navigation.replace('Home');
  };

  const handleNext = () => {
    if (slideIndex < 2) {
      setSlideIndex((prev) => prev + 1);
    } else {
      handleFinish();
    }
  };

  return (
    <ScreenWrapper style={styles.screenWrapper} statusBarStyle="light">
      <View style={styles.container}>
        {/* Top Bar: Brand Logo & Title + Skip Button */}
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <PhotoProofLogoMark size={28} color="#FF5500" />
            <Text variant="title3" weight="700" color="#FFFFFF" style={styles.brandTitle}>
              PhotoProof
            </Text>
          </View>

          {slideIndex < 2 ? (
            <Pressable
              onPress={handleSkip}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}
            >
              <Text variant="subhead" color="#8E8E93">
                Skip
              </Text>
            </Pressable>
          ) : <View style={{ width: 40 }} />}
        </View>

        {/* Main Slide Content Area */}
        <KeyboardAvoidingView
          behavior="padding"
          style={styles.contentFlex}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 20 : 0}
        >
          {slideIndex === 0 && (
            <View style={styles.slideBody}>
              <View style={styles.iconCircleGraphic}>
                <CameraIcon size={30} color="#FF5500" strokeWidth={1.8} />
              </View>

              <Text style={styles.taglineMono}>
                STAMPED AT THE MOMENT OF CAPTURE
              </Text>

              <Text variant="largeTitle" weight="800" color="#FFFFFF" style={styles.headline}>
                Shoot the job.
              </Text>

              <Text variant="callout" color="#9CA3AF" style={styles.bodyDescription}>
                Every frame is numbered, time-stamped and pinned to where you stood. Shoot twenty in a row — nothing gets in the way of the shutter.
              </Text>
            </View>
          )}

          {slideIndex === 1 && (
            <View style={styles.slideBody}>
              <View style={styles.iconCircleGraphic}>
                <DocumentPdfIcon size={30} color="#FF5500" strokeWidth={1.8} />
              </View>

              <Text style={styles.taglineMono}>
                READY BEFORE YOU REACH THE VAN
              </Text>

              <Text variant="largeTitle" weight="800" color="#FFFFFF" style={styles.headline}>
                Hand over a proof.
              </Text>

              <Text variant="callout" color="#9CA3AF" style={styles.bodyDescription}>
                The report builds itself into a clean, print-ready PDF. Share it to WhatsApp, email or a client portal straight from the job.
              </Text>
            </View>
          )}

          {slideIndex === 2 && (
            <View style={styles.slideBody}>
              <Text style={styles.taglineMono}>
                SIGN YOUR REPORTS
              </Text>

              <Text variant="title1" weight="800" color="#FFFFFF" style={styles.headline}>
                Who is this proof from?
              </Text>

              <Text variant="subhead" color="#9CA3AF" style={styles.bodyDescription}>
                Printed on the cover of every PDF you send. You can change it any time in Settings.
              </Text>

              <View style={styles.formContainer}>
                {/* Company or Name Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabelMono}>COMPANY OR YOUR NAME</Text>
                  <TextInput
                    value={companyName}
                    onChangeText={setCompanyName}
                    placeholder="e.g. Fenwick Property Services"
                    placeholderTextColor="#4B5563"
                    onFocus={() => setCompanyFocused(true)}
                    onBlur={() => setCompanyFocused(false)}
                    style={[
                      styles.underlinedInput,
                      {
                        color: '#FFFFFF',
                        borderBottomColor: companyFocused ? theme.colors.primary : '#272A30',
                      },
                    ]}
                  />
                </View>

                {/* Trade or Role Input */}
                <View style={[styles.inputGroup, { marginTop: 24 }]}>
                  <Text style={styles.inputLabelMono}>TRADE OR ROLE</Text>
                  <TextInput
                    value={role}
                    onChangeText={setRole}
                    placeholder="e.g. Property Inspection"
                    placeholderTextColor="#4B5563"
                    onFocus={() => setRoleFocused(true)}
                    onBlur={() => setRoleFocused(false)}
                    style={[
                      styles.underlinedInput,
                      {
                        color: '#FFFFFF',
                        borderBottomColor: roleFocused ? theme.colors.primary : '#272A30',
                      },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}

          {/* Bottom Actions & Pager */}
          <View style={styles.bottomArea}>
            {/* Pagination Dots */}
            <View style={styles.pagerDotsRow}>
              {[0, 1, 2].map((i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    slideIndex === i ? styles.activeDot : styles.inactiveDot,
                  ]}
                />
              ))}
            </View>

            {/* Main CTA Button */}
            <Button
              title={slideIndex === 2 ? 'Start Documenting' : 'Continue'}
              variant="primary"
              size="lg"
              fullWidth
              loading={isSubmitting}
              style={styles.ctaButton}
              onPress={handleNext}
            />

            <Text style={styles.microFooter}>
              {slideIndex === 2
                ? 'NOTHING IS UPLOADED · EVER'
                : 'TAP ANYWHERE TO CONTINUE'}
            </Text>
          </View>
        </KeyboardAvoidingView>
      </View>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  screenWrapper: {
    backgroundColor: '#0D0E11',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandTitle: {
    letterSpacing: -0.3,
  },
  contentFlex: {
    flex: 1,
    justifyContent: 'space-between',
    paddingTop: 24,
  },
  slideBody: {
    flex: 1,
  },
  iconCircleGraphic: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255, 85, 0, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255, 85, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  taglineMono: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FF5500',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  headline: {
    fontSize: 34,
    lineHeight: 40,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  bodyDescription: {
    lineHeight: 22,
    maxWidth: width - 48,
    marginBottom: 24,
  },
  formContainer: {
    marginTop: 8,
  },
  inputGroup: {
    width: '100%',
  },
  inputLabelMono: {
    fontSize: 10,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 1,
    marginBottom: 8,
  },
  underlinedInput: {
    fontSize: 18,
    fontWeight: '600',
    paddingVertical: 10,
    borderBottomWidth: 1.5,
  },
  bottomArea: {
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    alignItems: 'center',
  },
  pagerDotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 20,
  },
  dot: {
    height: 4,
    borderRadius: 2,
  },
  activeDot: {
    width: 24,
    backgroundColor: '#FF5500',
  },
  inactiveDot: {
    width: 6,
    backgroundColor: '#272A30',
  },
  ctaButton: {
    borderRadius: 28,
    backgroundColor: '#FF5500',
  },
  microFooter: {
    fontSize: 10,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 1.2,
    marginTop: 16,
    textAlign: 'center',
  },
});
