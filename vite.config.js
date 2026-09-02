import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Relative asset URLs so the built app works inside the Xcode / Capacitor webview.
  base: './',
  plugins: [
    // Keeps /api proxy to your Base44 backend for InvokeLLM only.
    // Builder-only features (visual edit, analytics) are disabled.
    base44({
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
    }),
    react(),
  ]
});
