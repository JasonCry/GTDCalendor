import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,        // 监听所有网卡，本机 IP 可访问
    port: 5173,
    strictPort: false, // 端口占用时自动尝试下一端口
  },
  preview: {
    host: true,
    port: 4173,
    strictPort: false,
  },
})
