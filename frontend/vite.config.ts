import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  server: {
    port: 5173,
    proxy: {}
  },
  optimizeDeps: {
    exclude: ['latex.js'],
  },
  build: {
    rollupOptions: {
      external: [],
    },
  },
  assetsInclude: ['**/*.keep'],
})
