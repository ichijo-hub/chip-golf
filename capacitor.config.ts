import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chipgolf.app',
  appName: 'Chip Golf',
  webDir: 'out',
  ios: {
    contentInset: 'never',
  },
  plugins: {
    AdMob: {
      appId: 'ca-app-pub-8709651001247712~8920333898',
      initializeForAdRequest: true,
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#145a32',
      showSpinner: false,
    },
  },
};

export default config;
