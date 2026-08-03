import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow Cloudflare / localtunnel quick-tunnel hostnames in cloud demos.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/hubs': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
      },
      '/health': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/swagger': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
})
