import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Last Minute Study',
  slug: 'last-minute-study',
  scheme: 'lastminutestudy',
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
  plugins: ['expo-router'],
  experiments: {
    typedRoutes: true,
  },
});
