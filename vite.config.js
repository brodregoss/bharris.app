import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
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
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    plugins: [
      llmDevPlugin(),
      react(),
    ],
    server: {
      proxy: {
        '/openai-proxy': {
          target: 'https://api.openai.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/openai-proxy/, ''),
        },
        '/v1': {
          target: 'http://127.0.0.1:8787',
          changeOrigin: true,
        },
        '/__/auth': {
          target: 'https://bharris-app.firebaseapp.com',
          changeOrigin: true,
          secure: true,
        },
        '/__/firebase': {
          target: 'https://bharris-app.firebaseapp.com',
          changeOrigin: true,
          secure: true,
        },
      },
    },
  }
})