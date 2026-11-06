/**
 * Samsung Tizen TV Remote Control Key Handler
 * Registers required media and special keys via tizen.tvinputdevice.
 */

declare global {
  interface Window {
    tizen?: {
      tvinputdevice: {
        registerKey: (keyName: string) => void;
        unregisterKey: (keyName: string) => void;
      };
      application: {
        getCurrentApplication: () => {
          exit: () => void;
        };
      };
    };
  }
}

export const TvKeys = {
  // Navigation
  ENTER: 13,
  ARROW_LEFT: 37,
  ARROW_UP: 38,
  ARROW_RIGHT: 39,
  ARROW_DOWN: 40,
  RETURN: 10009, // Tizen hardware back button

  // Media Keys
  PLAY: 415,
  PAUSE: 19,
  PLAY_PAUSE: 10252,
  STOP: 413,
  FAST_FORWARD: 417,
  REWIND: 412,
  TRACK_NEXT: 10233,
  TRACK_PREV: 10232,

  // Color Keys
  RED: 403,
  GREEN: 404,
  YELLOW: 405,
  BLUE: 406,
} as const;

const REGISTERED_KEYS = [
  'MediaPlay',
  'MediaPause',
  'MediaPlayPause',
  'MediaStop',
  'MediaFastForward',
  'MediaRewind',
  'MediaTrackNext',
  'MediaTrackPrevious',
  'ColorF0Red',
  'ColorF1Green',
  'ColorF2Yellow',
  'ColorF3Blue',
];

type BackListener = () => boolean; // return true if handled
const backListeners: BackListener[] = [];

export function pushBackListener(listener: BackListener): () => void {
  backListeners.push(listener);
  return () => {
    const idx = backListeners.indexOf(listener);
    if (idx !== -1) backListeners.splice(idx, 1);
  };
}

export function registerTizenKeys(): void {
  if (typeof window === 'undefined') return;

  try {
    const inputDevice = window.tizen?.tvinputdevice;
    if (inputDevice) {
      for (const key of REGISTERED_KEYS) {
        try {
          inputDevice.registerKey(key);
        } catch (e) {
          console.warn(`[keys] Failed to register key: ${key}`, e);
        }
      }
    }
  } catch (e) {
    console.warn('[keys] tizen.tvinputdevice not available', e);
  }

  // Tizen HW Key listener for Back button
  window.addEventListener('tizenhwkey', (e: Event) => {
    const hwEvent = e as CustomEvent<{ keyName: string }>;
    if (hwEvent.detail?.keyName === 'back' || (e as unknown as { keyName: string }).keyName === 'back') {
      handleBack();
    }
  });

  // Standard keyboard fallback for back/return (Backspace or Escape in browser)
  window.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.keyCode === TvKeys.RETURN || e.key === 'Escape') {
      e.preventDefault();
      handleBack();
    }
  });
}

function handleBack(): void {
  for (let i = backListeners.length - 1; i >= 0; i--) {
    const listener = backListeners[i];
    if (listener && listener()) {
      return;
    }
  }

  // If no listener consumed the back event, exit app on Tizen
  try {
    window.tizen?.application.getCurrentApplication().exit();
  } catch {
    console.log('[keys] Back pressed at root; would exit app on Tizen');
  }
}

