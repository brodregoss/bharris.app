import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Keyboard, KeyboardResize } from '@capacitor/keyboard';
import { App as CapApp } from '@capacitor/app';

export const isNativeApp = () => Capacitor.isNativePlatform();

export async function bootstrapNativeShell() {
  if (!isNativeApp()) return;

  document.documentElement.classList.add('native-app');

  try {
    await StatusBar.setStyle({ style: Style.Dark });
  } catch {
    // StatusBar is iOS/Android only; ignore on other platforms.
  }

  try {
    await Keyboard.setResizeMode({ mode: KeyboardResize.Body });
  } catch {
    // Keyboard plugin may be unavailable during web preview.
  }

  try {
    await SplashScreen.hide();
  } catch {
    // Splash already dismissed by launchAutoHide.
  }

  CapApp.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack) {
      window.history.back();
    } else {
      CapApp.exitApp();
    }
  });
}
