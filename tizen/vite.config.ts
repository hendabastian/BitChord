import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import {
  getHomeFeed,
  getRecommendations,
  getExploreFeed,
  searchTracks,
  resolveAudioStream,
  fetchLyrics,
  pipeMedia,
  getAuthStatus,
  startDeviceCodeAuth,
  submitCookie,
  logoutUser,
  getUserLibrary,
  getUserHistory,
  getDetailTracks,
} from './src/server/ytService.ts';

async function parseBody(req: any): Promise<any> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: any) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({ raw });
      }
    });
    req.on('error', () => resolve({}));
  });
}

function bitchordYtPlugin(): Plugin {
  const handler = async (req: any, res: any, next: any) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/yt/')) {
      return next();
    }

    try {
      // ---------------- Auth Endpoints ----------------
      if (url.pathname === '/api/yt/auth/status') {
        const data = await getAuthStatus();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      }

      if (url.pathname === '/api/yt/auth/device-code') {
        const data = await startDeviceCodeAuth();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      }

      if (url.pathname === '/api/yt/auth/cookie' && req.method === 'POST') {
        const body = await parseBody(req);
        const cookie = body.cookie || body.raw || '';
        const data = await submitCookie(cookie);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      }

      if (url.pathname === '/api/yt/auth/logout' && req.method === 'POST') {
        const data = await logoutUser();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      }

      // ---------------- Personalization & Library ----------------
      if (url.pathname === '/api/yt/library') {
        const data = await getUserLibrary();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      }

      if (url.pathname === '/api/yt/history') {
        const tracks = await getUserHistory();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ tracks }));
      }

      if (url.pathname === '/api/yt/detail' || url.pathname === '/api/yt/playlist') {
        const id = url.searchParams.get('id') || url.searchParams.get('browseId') || '';
        const type = url.searchParams.get('type') || undefined;
        if (!id) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'id required' }));
        }
        const data = await getDetailTracks(id, type);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      }

      // ---------------- Feed & Recommendations ----------------
      if (url.pathname === '/api/yt/home') {
        const data = await getHomeFeed();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      }

      if (url.pathname === '/api/yt/recommendations') {
        const videoId = url.searchParams.get('videoId') || '';
        if (!videoId) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'videoId required' }));
        }
        const recommendations = await getRecommendations(videoId);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ recommendations }));
      }

      if (url.pathname === '/api/yt/explore') {
        const data = await getExploreFeed();
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(data));
      }

      if (url.pathname === '/api/yt/search') {
        const q = url.searchParams.get('q') || '';
        const tracks = await searchTracks(q);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify({ tracks }));
      }

      if (url.pathname === '/api/yt/stream') {
        const videoId = url.searchParams.get('videoId');
        if (!videoId) {
          res.statusCode = 400;
          return res.end(JSON.stringify({ error: 'videoId required' }));
        }
        const stream = await resolveAudioStream(videoId);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(stream));
      }

      if (url.pathname === '/api/yt/lyrics') {
        const artist = url.searchParams.get('artist') || '';
        const title = url.searchParams.get('title') || '';
        const duration = parseFloat(url.searchParams.get('duration') || '0');
        const videoId = url.searchParams.get('videoId') || '';
        const lyr = await fetchLyrics(artist, title, duration, videoId);
        res.setHeader('Content-Type', 'application/json');
        return res.end(JSON.stringify(lyr));
      }

      if (url.pathname === '/api/yt/pipe') {
        const mediaUrl = url.searchParams.get('url');
        if (!mediaUrl) {
          res.statusCode = 400;
          return res.end('Media URL required');
        }
        return pipeMedia(mediaUrl, req, res);
      }

      next();
    } catch (e: any) {
      console.error('[ytApi] Server error:', e);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: e?.message || 'Server error' }));
    }
  };

  return {
    name: 'bitchord-yt-api',
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), bitchordYtPlugin()],
  resolve: {
    alias: [
      { find: /^@\/(.*)/, replacement: fileURLToPath(new URL('./src/$1', import.meta.url)) },
      { find: '@bitchord/shared/bridge', replacement: fileURLToPath(new URL('../web/shared/src/bridge/index.ts', import.meta.url)) },
      { find: '@bitchord/shared', replacement: fileURLToPath(new URL('../web/shared/src/index.ts', import.meta.url)) },
    ],
  },
  build: {
    outDir: 'build/wgt-src',
    emptyOutDir: false,
    target: 'chrome79',
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
      },
    },
  },
  server: {
    port: 5174,
  },
});
