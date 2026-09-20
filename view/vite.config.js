import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig(({ mode }) => {
  const { VITE_API_PROXY_TARGET } = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [vue()],
    server: VITE_API_PROXY_TARGET
      ? {
        proxy: {
          '/api': {
            target: VITE_API_PROXY_TARGET,
            changeOrigin: true,
          },
        },
      }
      : undefined,
  };
});
