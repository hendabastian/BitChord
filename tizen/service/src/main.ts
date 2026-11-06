import { WebSocketServer, WebSocket } from 'ws';
import { startPairingServer, updateTvStatus, type TvStatus } from './pairing.js';

const BRIDGE_PORT = 8766;
const PAIRING_PORT = 8765;

const wss = new WebSocketServer({ port: BRIDGE_PORT, host: '127.0.0.1' });
console.log(`[service] Local bridge listening on ws://127.0.0.1:${BRIDGE_PORT}`);

const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  console.log('[service] TV UI connected to local bridge');

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.type === 'status' && data.data) {
        updateTvStatus(data.data as Partial<TvStatus>);
      }
    } catch {
      // Ignore
    }
  });

  ws.on('close', () => {
    clients.delete(ws);
    console.log('[service] TV UI disconnected');
  });
});

function broadcastToTv(action: string, payload?: Record<string, unknown>) {
  const msg = JSON.stringify({ type: 'action', action, payload });
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}

startPairingServer(PAIRING_PORT, (action, payload) => {
  broadcastToTv(action, payload);
});

