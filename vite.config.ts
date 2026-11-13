import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const clerkPublishableKey =
    env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    env.VITE_CLERK_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ||
    process.env.VITE_CLERK_PUBLISHABLE_KEY ||
    '';
  const adminEmail =
    env.NEXT_PUBLIC_ADMIN_EMAIL ||
    env.VITE_ADMIN_EMAIL ||
    env.ADMIN_EMAIL ||
    process.env.NEXT_PUBLIC_ADMIN_EMAIL ||
    process.env.VITE_ADMIN_EMAIL ||
    process.env.ADMIN_EMAIL ||
    '';

  const devEdgeApiPlugin = {
    name: 'dev-edge-api-bridge',
    configureServer(server: any) {
      server.middlewares.use(async (req: any, res: any, next: any) => {
        const urlPath = (req.url || '').split('?')[0];
        if (!urlPath.startsWith('/api/') && urlPath !== '/api' && !urlPath.startsWith('/ws/api/')) {
          return next();
        }
        try {
          const mod = await server.ssrLoadModule('/functions/api/[[route]].ts');
          const chunks: Buffer[] = [];
          if (req.method !== 'GET' && req.method !== 'HEAD') {
            await new Promise<void>((resolve, reject) => {
              req.on('data', (chunk: Buffer) => chunks.push(chunk));
              req.on('end', () => resolve());
              req.on('error', reject);
            });
          }
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers || {})) {
            if (typeof v === 'string') headers.set(k, v);
            else if (Array.isArray(v)) headers.set(k, v.join(', '));
          }
          const host = headers.get('host') || 'localhost:3000';
          const fetchReq = new Request(`http://${host}${req.url}`, {
            method: req.method,
            headers,
            body: chunks.length > 0 ? Buffer.concat(chunks) : undefined,
          });
          const runtimeEnv = {
            ...process.env,
            ...env,
            DB: null,
          };
          const fetchRes: Response = await mod.onRequest({ request: fetchReq, env: runtimeEnv });
          res.statusCode = fetchRes.status;
          fetchRes.headers.forEach((value, key) => {
            res.setHeader(key, value);
          });
          const buf = Buffer.from(await fetchRes.arrayBuffer());
          res.end(buf);
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: err?.message || 'Dev Edge API Error' }));
        }
      });
    },
  };

  return {
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    define: {
      'process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY': JSON.stringify(clerkPublishableKey),
      'process.env.VITE_CLERK_PUBLISHABLE_KEY': JSON.stringify(clerkPublishableKey),
      'process.env.NEXT_PUBLIC_ADMIN_EMAIL': JSON.stringify(adminEmail),
      'process.env.VITE_ADMIN_EMAIL': JSON.stringify(adminEmail),
    },
    plugins: [react(), tailwindcss(), devEdgeApiPlugin],
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
