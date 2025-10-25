import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api/spacetrack': {
        target: 'http://localhost:5174',
        changeOrigin: true
      },
      '/api/conjunctions': {
        target: 'http://localhost:5174',
        changeOrigin: true
      },
      '/api/health': {
        target: 'http://localhost:5174',
        changeOrigin: true
      },
      '/api/celestrak': {
        target: 'https://celestrak.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/celestrak/, '')
      },
      '/api/donki': {
        target: 'https://kauai.ccmc.gsfc.nasa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/donki/, '')
      },
      '/api/n2yo': {
        target: 'https://api.n2yo.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/n2yo/, '')
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
})
