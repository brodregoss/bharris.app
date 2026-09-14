import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { llmDevPlugin } from './server/llmDevPlugin.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  for (const key of [
    'OPENAI_API_KEY',
    'ACCOUNT_SECRET',
    'ADMIN_EMAIL',
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
  ]) {
    if (env[key]) process.env[key] = env[key]
  }

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
