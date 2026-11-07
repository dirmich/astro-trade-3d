import { defineConfig, loadEnv } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'node:path';

/**
 * Vite configuration that loads the shared root `../.env` file
 * so both Frontend and Backend share the exact same `.env` file at the project root.
 */
export default defineConfig(({ mode }) => {
  const rootDir = resolve(__dirname, '..');
  const env = loadEnv(mode, rootDir, '');

  return {
    plugins: [svelte()],
    envDir: rootDir,
    server: {
      host: true,
      port: Number(env.FRONTEND_PORT || 3000),
      proxy: {
        '/api': {
          target: `http://localhost:${env.BACKEND_PORT || 8000}`,
          changeOrigin: true,
        },
      },
    },
    define: {
      __APP_NAME__: JSON.stringify(env.APP_NAME || 'AstroTrade 3D'),
      __APP_VERSION__: JSON.stringify(env.APP_VERSION || '1.0.0'),
      __SUPERUSER_EMAIL__: JSON.stringify(env.SUPERUSER_EMAIL || 'oldtv.cf@gmail.com'),
    },
    build: {
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          manualChunks: {
            three: ['three'],
          },
        },
      },
    },
  };
});
