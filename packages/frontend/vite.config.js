import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // true викликає os.networkInterfaces(); у деяких середовищах це падає (sandbox / обмеження ОС)
    host: '127.0.0.1',
  },
  envPrefix: 'VITE_'
})
