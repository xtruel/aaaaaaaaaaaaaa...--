import type { CapacitorConfig } from '@capacitor/cli';

// The App Store build: the same single-file web build (dist/) inside a native iOS shell (Capacitor 8, Swift Package Manager).
// Colours: the game's night (src/style.css --night), behind the splash and the web view. The game itself finds the shell
// at runtime (src/platform/native.ts); docs/APPSTORE.md has the rest.
const config: CapacitorConfig = {
  appId: 'com.qwerty3d.scrapbotcity',
  appName: 'Scrapbot City',
  webDir: 'dist',
  backgroundColor: '#120b29',
  ios: {
    contentInset: 'never',
    scrollEnabled: false,
    backgroundColor: '#120b29',
    preferredContentMode: 'mobile',
    // no page zoom (two fingers zoom the map, src/session.ts) and no link previews on a long press
    zoomEnabled: false,
    allowsLinkPreview: false,
  },
  plugins: {
    SplashScreen: { launchAutoHide: true, launchShowDuration: 600, backgroundColor: '#120b29', showSpinner: false },
    StatusBar: { overlaysWebView: true },
  },
};

export default config;
