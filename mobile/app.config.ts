import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Last Minute Study',
  slug: 'last-minute-study',
  scheme: 'lastminutestudy',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  icon: './assets/images/icon.png',
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.brodregoss.lastminutestudy',
    buildNumber: '1',
    infoPlist: {
      CFBundleDisplayName: 'Last Minute Study',
      ITSAppUsesNonExemptEncryption: false,
      NSCameraUsageDescription: 'Take a photo of your notes to start a cram session.',
      NSPhotoLibraryUsageDescription: 'Choose a photo of your notes to start a cram session.',
    },
  },
  android: {
    package: 'com.brodregoss.lastminutestudy',
    adaptiveIcon: {
      backgroundColor: '#0f172a',
      foregroundImage: './assets/images/android-icon-foreground.png',
    },
  },
  plugins: [
    'expo-router',
    'expo-dev-client',
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a photo of your notes to start a cram session.',
        cameraPermission: 'Take a photo of your notes to start a cram session.',
      },
    ],
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-icon.png',
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
      },
    ],
  ],
  experiments: {
    typedRoutes: true,
  },
});
