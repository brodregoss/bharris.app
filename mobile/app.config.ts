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
    infoPlist: {
      NSCameraUsageDescription: 'Take a photo of your notes to start a cram session.',
      NSPhotoLibraryUsageDescription: 'Choose a photo of your notes to start a cram session.',
    },
  },
  android: {
    package: 'com.brodregoss.lastminutestudy',
  },
  plugins: ['expo-router', 'expo-image-picker'],
  experiments: {
    typedRoutes: true,
  },
});
