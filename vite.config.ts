import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      dedupe: ['react', 'react-dom'],
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
        '@clerk/nextjs': path.resolve(import.meta.dirname, 'src/lib/clerk.tsx'),
        'next/image': path.resolve(import.meta.dirname, 'src/lib/next-image.tsx'),
        'next/dynamic': path.resolve(import.meta.dirname, 'src/lib/next-dynamic.tsx'),
        'next/script': path.resolve(import.meta.dirname, 'src/lib/next-script.tsx'),
      },
    },
    build: {
      target: 'es2020',
      cssCodeSplit: true,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('lucide-react')) return 'icons-vendor';
              if (id.includes('framer-motion') || id.includes('motion')) return 'motion-vendor';
              if (id.includes('papaparse')) return 'csv-vendor';
              if (id.includes('@clerk')) return 'clerk-vendor';
              if (id.includes('react') || id.includes('react-dom')) return 'react-vendor';
            }
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
