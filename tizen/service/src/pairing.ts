import http from 'node:http';
import { parse } from 'node:url';
import { setAuthCookie } from './keystore.js';

export interface TvStatus {
  isPlaying: boolean;
  title: string;
  artist: string;
  artworkUrl?: string | null;
  currentPositionMs: number;
  durationMs: number;
}

let latestStatus: TvStatus = {
  isPlaying: false,
  title: 'BitChord TV',
  artist: 'Ready to Play',
  artworkUrl: null,
  currentPositionMs: 0,
  durationMs: 0,
};

type ActionDispatcher = (action: string, payload?: Record<string, unknown>) => void;
let dispatchAction: ActionDispatcher = () => {};

export function updateTvStatus(status: Partial<TvStatus>): void {
  latestStatus = { ...latestStatus, ...status };
}

export function startPairingServer(port: number, onAction: ActionDispatcher): http.Server {
  dispatchAction = onAction;

  const server = http.createServer((req, res) => {
    const parsed = parse(req.url || '/', true);
    const path = parsed.pathname || '/';

    // CORS headers for local LAN
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // 1. Current Status API
    if (path === '/api/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(latestStatus));
      return;
    }

    // 2. Playback & Remote Action API
    if (path === '/api/action' && (req.method === 'POST' || req.method === 'GET')) {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        let action = (parsed.query.action as string) || '';
        try {
          if (body) {
            const parsedBody = JSON.parse(body);
            if (parsedBody.action) action = parsedBody.action;
          }
        } catch {
          // Ignore
        }

        if (action) {
          dispatchAction(action, parsed.query as Record<string, unknown>);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, action }));
      });
      return;
    }

    // 3. Cookie Submission API
    if (path === '/submit' && req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        let cookie = '';
        try {
          const parsedBody = JSON.parse(body);
          cookie = parsedBody.cookie || '';
        } catch {
          // Form-urlencoded fallback
          const match = body.match(/cookie=([^&]+)/);
          if (match && match[1]) cookie = decodeURIComponent(match[1]);
        }

        if (cookie) {
          setAuthCookie(cookie);
          dispatchAction('cookie_received', { cookie });
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(getSuccessHtml());
        } else {
          res.writeHead(400, { 'Content-Type': 'text/html' });
          res.end(getAuthHtml('No cookie provided. Please try again.'));
        }
      });
      return;
    }

    // 4. Mobile Remote Control HTML Page
    if (path === '/remote') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getRemoteControlHtml());
      return;
    }

    // 5. Default Landing & Auth Page
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(getAuthHtml());
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[pairing] Server listening on http://0.0.0.0:${port}`);
  });

  return server;
}

function getRemoteControlHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>BitChord TV • Mobile Remote</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
    body { background: #08080B; color: #FFF; font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif; min-height: 100vh; padding: 20px; display: flex; flex-direction: column; align-items: center; }
    .header { display: flex; align-items: center; gap: 10px; width: 100%; max-width: 400px; padding: 10px 0 16px; }
    .header h1 { font-size: 20px; font-weight: 700; }
    .card { width: 100%; max-width: 400px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); border-radius: 24px; padding: 20px; margin-bottom: 20px; backdrop-filter: blur(20px); }
    .now-playing { display: flex; gap: 14px; align-items: center; margin-bottom: 14px; }
    .art { width: 68px; height: 68px; border-radius: 12px; background: #222; object-fit: cover; }
    .title { font-size: 16px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .artist { font-size: 13px; color: #A0A0AB; margin-top: 3px; }
    .transport-row { display: flex; justify-content: center; align-items: center; gap: 20px; margin-top: 14px; }
    .btn { border: none; outline: none; background: rgba(255,255,255,0.15); color: #FFF; border-radius: 50%; width: 50px; height: 50px; font-size: 20px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .btn:active { transform: scale(0.92); }
    .btn-play { width: 64px; height: 64px; background: #FA2D48; font-size: 26px; }
    .dpad-card { width: 100%; max-width: 400px; display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 16px; }
    .dpad-row { display: flex; gap: 8px; }
    .dpad-btn { width: 72px; height: 72px; border-radius: 20px; font-size: 22px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="header"><h1>BitChord Remote</h1></div>
  <div class="card">
    <div class="now-playing">
      <img id="art" class="art" src="" style="display:none;" />
      <div style="flex:1;min-width:0;">
        <div id="title" class="title">Connecting...</div>
        <div id="artist" class="artist">BitChord TV</div>
      </div>
    </div>
    <div class="transport-row">
      <button class="btn" onclick="sendAction('prev')">⏮</button>
      <button id="playBtn" class="btn btn-play" onclick="sendAction('play_pause')">▶</button>
      <button class="btn" onclick="sendAction('next')">⏭</button>
    </div>
  </div>

  <div class="dpad-card">
    <button class="btn dpad-btn" onclick="sendAction('key_up')">▲</button>
    <div class="dpad-row">
      <button class="btn dpad-btn" onclick="sendAction('key_left')">◀</button>
      <button class="btn dpad-btn" style="background:#FA2D48;" onclick="sendAction('key_select')">OK</button>
      <button class="btn dpad-btn" onclick="sendAction('key_right')">▶</button>
    </div>
    <button class="btn dpad-btn" onclick="sendAction('key_down')">▼</button>
  </div>
  <button class="btn" style="width:120px;border-radius:24px;font-size:14px;" onclick="sendAction('key_back')">Back / Return</button>

  <script>
    async function sendAction(act) {
      await fetch('/api/action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: act }) });
    }
    async function poll() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();
        document.getElementById('title').textContent = data.title || 'BitChord TV';
        document.getElementById('artist').textContent = data.artist || '';
        document.getElementById('playBtn').textContent = data.isPlaying ? '⏸' : '▶';
        const art = document.getElementById('art');
        if (data.artworkUrl) { art.src = data.artworkUrl; art.style.display = 'block'; }
        else { art.style.display = 'none'; }
      } catch {}
    }
    setInterval(poll, 1500);
    poll();
  </script>
</body>
</html>`;
}

function getAuthHtml(error?: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sign in to BitChord TV</title>
  <style>
    body { background: #08080B; color: #FFF; font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; padding: 20px; }
    .box { background: rgba(255,255,255,0.08); border-radius: 20px; padding: 24px; max-width: 440px; width: 100%; text-align: center; }
    h1 { font-size: 22px; margin-bottom: 12px; }
    p { font-size: 14px; color: #AAA; line-height: 1.5; margin-bottom: 20px; }
    textarea { width: 100%; height: 90px; background: rgba(0,0,0,0.5); border: 1px solid #444; border-radius: 10px; color: #FFF; padding: 10px; margin-bottom: 16px; }
    button { background: #FA2D48; color: #FFF; border: none; border-radius: 12px; padding: 12px 24px; font-weight: 700; cursor: pointer; width: 100%; font-size: 16px; }
    .err { color: #FA2D48; margin-bottom: 10px; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Connect to BitChord TV</h1>
    ${error ? `<div class="err">${error}</div>` : ''}
    <p>Paste your YouTube Music session cookie below to sync your library, liked tracks, and personalized mix to this TV.</p>
    <form action="/submit" method="POST">
      <textarea name="cookie" placeholder="Paste cookie string here..."></textarea>
      <button type="submit">Sign In TV</button>
    </form>
    <div style="margin-top:20px;">
      <a href="/remote" style="color:#FA2D48;text-decoration:none;font-size:14px;">Open Mobile TV Remote &rarr;</a>
    </div>
  </div>
</body>
</html>`;
}

function getSuccessHtml(): string {
  return `<!DOCTYPE html>
<html>
<body style="background:#08080B;color:#FFF;font-family:sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;text-align:center;">
  <h1 style="color:#22C55E;">Signed In Successfully!</h1>
  <p style="color:#AAA;margin-top:10px;">Your TV is now signed in. You can close this tab or open the remote below.</p>
  <a href="/remote" style="margin-top:20px;background:#FA2D48;color:#FFF;padding:12px 24px;border-radius:12px;text-decoration:none;font-weight:700;">Open Mobile Remote</a>
</body>
</html>`;
}

