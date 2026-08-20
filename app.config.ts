import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Last Minute Study',
  slug: 'last-minute-study',
  scheme: 'lastminutestudy',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.brodregoss.lastminutestudy',
  },
  android: {
    package: 'com.brodregoss.lastminutestudy',
    adaptiveIcon: {
      foregroundImage: './assets/android-icon-foreground.png',
      backgroundImage: './assets/android-icon-background.png',
    },
  },
  plugins: ['expo-router', 'expo-image-picker'],
  experiments: {
    typedRoutes: true,
  },
});
