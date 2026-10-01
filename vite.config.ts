import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiDevPlugin(): Plugin {
  return {
    name: 'api-dev-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) {
          return next();
        }

        const urlObj = new URL(req.url, 'http://localhost');
        const pathname = urlObj.pathname;

        // Parse query params
        const query: Record<string, string> = {};
        urlObj.searchParams.forEach((v, k) => {
          query[k] = v;
        });
        (req as any).query = query;

        // Buffer and parse request body for POST/PATCH
        if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
          const buffers: Buffer[] = [];
          for await (const chunk of req) {
            buffers.push(chunk as Buffer);
          }
          const rawBody = Buffer.concat(buffers).toString('utf-8');
          try {
            (req as any).body = rawBody ? JSON.parse(rawBody) : {};
          } catch {
            (req as any).body = rawBody;
          }
        }

        // Express-like response helpers for Vercel functions
        (res as any).status = function (code: number) {
          res.statusCode = code;
          return res;
        };
        (res as any).json = function (data: any) {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify(data));
          return res;
        };

        try {
          if (pathname === '/api/submissions') {
            const mod = await server.ssrLoadModule('/api/submissions.ts');
            return mod.default(req, res);
          }
          if (pathname === '/api/feedback') {
            const mod = await server.ssrLoadModule('/api/feedback.ts');
            return mod.default(req, res);
          }
        } catch (err: any) {
          console.error('API middleware error:', err);
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          return res.end(JSON.stringify({ error: err.message }));
        }

        next();
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiDevPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
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

