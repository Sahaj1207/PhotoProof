import React, { useEffect, useMemo, useState } from 'react';
import {
  NavigationContainer,
  DefaultTheme as NavigationDefaultTheme,
  DarkTheme as NavigationDarkTheme,
  Theme as NavigationTheme,
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../hooks/useTheme';
import { RootStackParamList } from './types';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { NewReportScreen } from '../screens/NewReportScreen';
import { CaptureScreen } from '../screens/CaptureScreen';
import { ReportDetailsScreen } from '../screens/ReportDetailsScreen';
import { PhotoDetailsScreen } from '../screens/PhotoDetailsScreen';
import { PhotoEditScreen } from '../screens/PhotoEditScreen';
import { PdfPreviewScreen } from '../screens/PdfPreviewScreen';
import { isOnboardingCompleted } from '../services/storage/inspectorProfile';

const Stack = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { theme, isDark, isAppearanceHydrated } = useTheme();
  const [initialRoute, setInitialRoute] = useState<'Onboarding' | 'Home' | null>(null);

  useEffect(() => {
    const checkOnboarding = async () => {
      const completed = await isOnboardingCompleted();
      setInitialRoute(completed ? 'Home' : 'Onboarding');
    };
    checkOnboarding();
  }, []);

  const navigationTheme = useMemo<NavigationTheme>(
    () => ({
      dark: isDark,
      colors: {
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.textPrimary,
        border: theme.colors.borderSubtle,
        notification: theme.colors.error,
      },
      fonts: isDark ? NavigationDarkTheme.fonts : NavigationDefaultTheme.fonts,
    }),
    [isDark, theme]
  );

  // Wait for both onboarding state and the saved theme so the first frame is correct.
  if (!initialRoute || !isAppearanceHydrated) {
    return null;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      <Stack.Navigator
        initialRouteName={initialRoute}
        // getId makes navigate() return to an existing screen instead of pushing a
        // duplicate (React Navigation 7 pushes by default). It also makes double
        // taps harmless.
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="Onboarding" getId={() => 'onboarding'} component={OnboardingScreen} />
        <Stack.Screen name="Home" getId={() => 'home'} component={HomeScreen} />
        <Stack.Screen
          name="Settings" getId={() => 'settings'}
          component={SettingsScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="NewReport" getId={() => 'new-report'}
          component={NewReportScreen}
          options={{
            animation: 'slide_from_bottom',
            presentation: 'modal',
          }}
        />
        <Stack.Screen
          name="Capture" getId={({ params }) => params.reportId}
          component={CaptureScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="ReportDetails" getId={({ params }) => params.reportId}
          component={ReportDetailsScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="PhotoDetails" getId={({ params }) => params.photoId}
          component={PhotoDetailsScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="PhotoEdit" getId={({ params }) => params.photoId}
          component={PhotoEditScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
        <Stack.Screen
          name="PdfPreview" getId={({ params }) => params.reportId}
          component={PdfPreviewScreen}
          options={{
            animation: 'slide_from_right',
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
};
