import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { llmDevPlugin } from './server/llmDevPlugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = env.OPENAI_API_KEY

  return {
    // Relative asset URLs so the built app works inside the Xcode / Capacitor webview.
    base: './',
    plugins: [
      llmDevPlugin(),
      // Keeps /api proxy to your Base44 backend for leftover SDK calls.
      base44({
        legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      }),
      react(),
    ],
    server: {
      proxy: {
        '/openai-proxy': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/openai-proxy/, ''),
        },
      },
    },
  }
})
