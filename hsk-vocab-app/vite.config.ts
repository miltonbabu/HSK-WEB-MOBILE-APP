import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/ai': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    exclude: ['@mlc-ai/web-llm'],
  },
  build: {
    chunkSizeWarningLimit: 5000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('@mlc-ai/web-llm')) return 'webllm'
          return undefined
        },
      },
    },
  },
})