import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: parseInt(process.env.PORT || '3000'),
    proxy: {
      '/api': 'http://localhost:3001',
      '/outputs': 'http://localhost:3001',
      '/templates': 'http://localhost:3001',
      '/workflows': 'http://localhost:3001',
      '/sse': 'http://localhost:3001',
      '/webhook': 'http://localhost:3001',
    },
    historyApiFallback: true,
  }
})
