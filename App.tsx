import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider } from './src/theme';
import { ReportsProvider } from './src/context';
import { RootNavigator } from './src/navigation';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <ReportsProvider>
          <RootNavigator />
        </ReportsProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
