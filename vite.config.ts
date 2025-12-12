import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Vercel yoki local .env fayllaridan o'zgaruvchilarni yuklaymiz
  // process.cwd() joriy papkani bildiradi, '' esa barcha o'zgaruvchilarni (VITE_ prefiksisiz ham) yuklashni anglatadi
  const env = loadEnv(mode, '.', '');

  return {
    plugins: [react()],
    build: {
      outDir: 'dist',
      sourcemap: false
    },
    server: {
      port: 3000
    },
    // Bu qism juda muhim: process.env.API_KEY ni kod ichiga "build" vaqtida yozib yuboradi.
    // Shunda brauzerda "process is not defined" degan xato chiqmaydi.
    define: {
      'process.env.API_KEY': JSON.stringify(env.API_KEY)
    }
  };
});