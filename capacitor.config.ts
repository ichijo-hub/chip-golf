import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chipgolf.app',
  appName: 'Chip Golf',
  webDir: 'out',
  ios: {
    contentInset: 'never', // CSSのenv(safe-area-inset-top)で制御するのでネイティブinsetは不要
  },
};

export default config;
