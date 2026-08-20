import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Last Minute Study',
  slug: 'cram-app',
  scheme: 'cramapp',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.brodregoss.lastminutestudy',
  },
  android: {
    package: 'com.brodregoss.lastminutestudy',
  },
  plugins: ['expo-router', 'expo-image-picker'],
  experiments: {
    typedRoutes: true,
  },
});
