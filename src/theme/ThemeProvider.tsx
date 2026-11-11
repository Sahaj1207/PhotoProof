import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';
import { Theme, lightTheme, darkTheme } from './theme';
import {
  AppearancePreference,
  getSavedAppearance,
  saveAppearance as persistAppearance,
} from '../services/storage/settingsService';

interface ThemeContextValue {
  theme: Theme;
  isDark: boolean;
  colorScheme: 'light' | 'dark';
  appearance: AppearancePreference;
  /** False until the saved appearance preference has been read from storage. */
  isAppearanceHydrated: boolean;
  setAppearance: (pref: AppearancePreference) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  isDark: true,
  colorScheme: 'dark',
  appearance: 'system',
  isAppearanceHydrated: true,
  setAppearance: async () => {},
});

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<AppearancePreference>('system');
  const [isAppearanceHydrated, setIsAppearanceHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getSavedAppearance().then((saved) => {
      if (cancelled) return;
      setAppearanceState(saved);
      setIsAppearanceHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setAppearance = useCallback(async (pref: AppearancePreference) => {
    setAppearanceState(pref);
    await persistAppearance(pref);
  }, []);

  const isDark = useMemo(() => {
    if (appearance === 'dark') return true;
    if (appearance === 'light') return false;
    return systemColorScheme === 'dark';
  }, [appearance, systemColorScheme]);

  const colorScheme: 'light' | 'dark' = isDark ? 'dark' : 'light';

  const theme = useMemo(() => {
    return isDark ? darkTheme : lightTheme;
  }, [isDark]);

  const value = useMemo(
    () => ({
      theme,
      isDark,
      colorScheme,
      appearance,
      isAppearanceHydrated,
      setAppearance,
    }),
    [theme, isDark, colorScheme, appearance, isAppearanceHydrated, setAppearance]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
