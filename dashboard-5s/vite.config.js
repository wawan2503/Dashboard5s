import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => ({
  // Use absolute base so SPA deep-links (e.g. /dashboard) can load assets correctly on hosts like Vercel.
  base: '/',
  plugins: [react()],
  server: {
    host: true,
    port: 8001,
    strictPort: true,
  },
  preview: {
    host: true,
    port: 8001,
    strictPort: true,
  },
}))
