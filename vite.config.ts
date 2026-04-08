import { defineConfig, loadEnv } from 'vite';
import { resolve } from 'path';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const proxyTarget = (env.VITE_SOYBIS_API_PROXY_TARGET || 'http://localhost/soybis').replace(
    /\/$/,
    ''
  );

  return {
    root: '.',
    publicDir: 'public',
    // Use repository subpath only in CI deploys.
    base: process.env.GITHUB_ACTIONS ? '/SOY-BIS-Modular/' : '/',
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: true,
      rollupOptions: {
        input: {
          main: resolve(__dirname, 'index.html'),
        },
        output: {
          manualChunks: {
            'vendor-charts': ['chart.js'],
            'vendor-utils': ['html2pdf.js', 'xlsx'],
          },
        },
      },
      // Optimize chunk size
      chunkSizeWarningLimit: 1000,
    },
    resolve: {
      alias: {
        '@': resolve(__dirname, './src'),
        '@components': resolve(__dirname, './src/components'),
        '@modules': resolve(__dirname, './src/modules'),
        '@utils': resolve(__dirname, './src/utils'),
        '@types': resolve(__dirname, './src/types'),
        '@services': resolve(__dirname, './src/services'),
      },
    },
    server: {
      port: 3000,
      open: true,
      cors: true,
      // VITE_SOYBIS_API_BASE=/api iken istekler buraya düşer; Apache/PHP API köküne yönlendirilir.
      proxy: {
        '/api': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
    preview: {
      port: 4173,
      open: true,
    },
    // Optimize dependencies
    optimizeDeps: {
      include: ['chart.js', 'html2pdf.js', 'xlsx'],
    },
  };
});
