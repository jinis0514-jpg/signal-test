import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5174,
    strictPort: true,
  },

  build: {
    // 청크 크기 경고 임계값 (500KB)
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // vendor 청크 분리 (react, react-dom)
        manualChunks: {
          vendor: ['react', 'react-dom'],
          icons:  ['lucide-react'],
        },
      },
    },
  },
})
