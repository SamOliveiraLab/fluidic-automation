import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const pioreactorUrl = env.VITE_PIOREACTOR_URL || 'http://localhost:80'

  return {
    plugins: [react()],
    server: {
      port: 3010,
      strictPort: true,
      open: true,
      // Allow Pioreactor hostname + Cloudflare tunnel (subdomain changes each time)
      allowedHosts: ['oliveirapioreactor01.local', '.trycloudflare.com', '.ngrok-free.dev'],
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
