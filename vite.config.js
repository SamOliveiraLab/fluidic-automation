import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const pioreactorUrl = env.VITE_PIOREACTOR_URL || 'http://localhost:80'

  return {
    plugins: [react()],
    server: {
      port: 3000,
      open: true,
      proxy: {
        '/api': {
          target: pioreactorUrl,
          changeOrigin: true,
          secure: false,
          headers: { 'ngrok-skip-browser-warning': '1' },
        }
      }
    }
  }
})
