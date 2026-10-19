import type { CapacitorConfig } from '@capacitor/cli';

// The App Store build: the same single-file web build (dist/) inside a native iOS shell (Capacitor 8, Swift Package Manager).
const config: CapacitorConfig = {
  appId: 'com.qwerty3d.scrapbotcity',
  appName: 'Scrapbot City',
  webDir: 'dist',
  backgroundColor: '#140f24',
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    backgroundColor: '#140f24',
    preferredContentMode: 'mobile',
  },
  plugins: {
    SplashScreen: { launchAutoHide: true, launchShowDuration: 600, backgroundColor: '#140f24', showSpinner: false },
    StatusBar: { overlaysWebView: true },
  },
};

export default config;
