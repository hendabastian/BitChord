/**
 * Local Bridge Client
 * Communicates with the background Node.js service running on 127.0.0.1 on the TV.
 * Used for phone pairing status, remote actions, and YouTube cookie retrieval.
 */

export interface RemoteStatusPayload {
  isPlaying: boolean;
  title: string;
  artist: string;
  artworkUrl?: string | null;
  currentPositionMs: number;
  durationMs: number;
}

type RemoteActionHandler = (action: string, payload?: Record<string, unknown>) => void;
const actionHandlers: RemoteActionHandler[] = [];

let socket: WebSocket | null = null;
let isConnected = false;

export function onRemoteAction(handler: RemoteActionHandler): () => void {
  actionHandlers.push(handler);
  return () => {
    const idx = actionHandlers.indexOf(handler);
    if (idx !== -1) actionHandlers.splice(idx, 1);
  };
}

export function initBridge(port = 8766): void {
  if (typeof window === 'undefined') return;

  function connect() {
    try {
      socket = new WebSocket(`ws://127.0.0.1:${port}`);

      socket.onopen = () => {
        isConnected = true;
        console.log('[bridge] Connected to local service');
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'action') {
            for (const handler of actionHandlers) {
              handler(data.action, data.payload);
            }
          }
        } catch {
          // Ignore
        }
      };

      socket.onclose = () => {
        isConnected = false;
        setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        isConnected = false;
        socket?.close();
      };
    } catch {
      setTimeout(connect, 3000);
    }
  }

  connect();
}

export function syncRemoteStatus(status: RemoteStatusPayload): void {
  if (!socket || !isConnected || socket.readyState !== WebSocket.OPEN) return;
  try {
    socket.send(JSON.stringify({ type: 'status', data: status }));
  } catch {
    // Ignore
  }
}

