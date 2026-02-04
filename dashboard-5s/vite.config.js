import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Avoid blank page when deployed under a subpath or opened from a folder.
  // Dev stays at '/' so HMR paths remain stable.
  base: command === 'build' ? './' : '/',
  plugins: [react()],
  server: {
    port: 8001,
    strictPort: true,
  },
  preview: {
    port: 8001,
    strictPort: true,
  },
}))
