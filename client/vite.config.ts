import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rawPort = process.env.PORT
const port =
  rawPort !== undefined && rawPort !== '' && !Number.isNaN(Number(rawPort))
    ? Number(rawPort)
    : 5173

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '0.0.0.0',
    port,
    // Ohne gesetztes PORT (lokal): anderen Port probieren; mit PORT (Replit): strikt
    strictPort: Boolean(rawPort),
    // Replit / andere Proxies mit wechselndem Host-Header
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    port,
    strictPort: Boolean(rawPort),
    allowedHosts: true,
  },
})
