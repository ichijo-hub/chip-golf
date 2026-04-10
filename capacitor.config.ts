import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.chipgolf.app',
  appName: 'Chip Golf',
  webDir: 'out',
  ios: {
    contentInset: 'always',
  },
};

export default config;
