/**
 * Samsung AVPlay Hardware Media Player Adapter
 * Wraps window.webapis.avplay in a standard HTMLMediaElement / Audio-compatible interface.
 * Falls back to HTML5 Audio in browsers or environments where AVPlay is unavailable.
 */

declare global {
  interface Window {
    webapis?: {
      avplay?: {
        open: (url: string) => void;
        close: () => void;
        prepareAsync: (success: () => void, error: (err: unknown) => void) => void;
        play: () => void;
        pause: () => void;
        stop: () => void;
        seekTo: (timeMs: number, success?: () => void, error?: (err: unknown) => void) => void;
        getState: () => 'NONE' | 'IDLE' | 'READY' | 'PLAYING' | 'PAUSED';
        getCurrentTime: () => number; // ms
        getDuration: () => number; // ms
        setSpeed: (speed: number) => void;
        setDisplayRect: (x: number, y: number, w: number, h: number) => void;
        setListener: (listener: {
          onbufferingstart?: () => void;
          onbufferingcomplete?: () => void;
          oncurrentplaytime?: (timeMs: number) => void;
          onstreamcompleted?: () => void;
          onerror?: (err: unknown) => void;
        }) => void;
      };
      appcommon?: {
        setScreenSaver: (state: number) => void;
        AppCommonScreenSaverState: {
          SCREEN_SAVER_OFF: number;
          SCREEN_SAVER_ON: number;
        };
      };
      productinfo?: {
        getModel: () => string;
        getFirmware: () => string;
        getDuid: () => string;
        is8KPanelSupported?: () => boolean;
        isUdPanelSupported?: () => boolean;
      };
    };
  }
}

export function isAvplaySupported(): boolean {
  return typeof window !== 'undefined' && !!window.webapis?.avplay;
}

const avplayManager = new (class {
  owner: AvplayAudio | null = null;
  openUrl: string | null = null;
  prepared = false;
  objectReady = false;

  get api() {
    const api = window.webapis?.avplay;
    if (!api) throw new Error('AVPlay is not available on this device');
    return api;
  }

  ensureObject() {
    if (this.objectReady || document.querySelector('object[type="application/avplayer"]')) {
      this.objectReady = true;
      return;
    }
    const obj = document.createElement('object');
    obj.type = 'application/avplayer';
    obj.setAttribute('aria-hidden', 'true');
    obj.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1000';
    document.body.appendChild(obj);
    this.objectReady = true;
  }

  close() {
    try {
      const state = this.api.getState();
      if (state !== 'NONE' && state !== 'IDLE') {
        this.api.stop();
      }
      this.api.close();
    } catch {
      // Ignore
    }
    this.openUrl = null;
    this.prepared = false;
  }
})();

export class AvplayAudio extends EventTarget {
  readonly isAvplayAudio = true;
  private fallbackAudio: HTMLAudioElement | null = null;

  private source: string | null = null;
  private startSec = 0;
  private knownDuration = NaN;
  private rate = 1;
  private isPaused = true;
  private isEnded = false;
  private lastTimeUpdate = 0;
  private playingPromise: Promise<void> | null = null;

  volume = 1;
  muted = false;

  constructor() {
    super();
    if (!isAvplaySupported()) {
      this.fallbackAudio = new Audio();
      this.forwardFallbackEvents();
    }
  }

  private forwardFallbackEvents() {
    if (!this.fallbackAudio) return;
    const events = ['play', 'playing', 'pause', 'ended', 'waiting', 'timeupdate', 'seeked', 'canplay', 'durationchange', 'error'];
    for (const ev of events) {
      this.fallbackAudio.addEventListener(ev, () => this.dispatchEvent(new Event(ev)));
    }
  }

  get ownsPlayer(): boolean {
    return avplayManager.owner === this;
  }

  get live(): boolean {
    return this.ownsPlayer && avplayManager.prepared;
  }

  setSource(url: string, startSec = 0, duration?: number) {
    if (this.fallbackAudio) {
      this.fallbackAudio.src = url;
      this.fallbackAudio.currentTime = startSec;
      return;
    }

    this.source = url;
    this.startSec = startSec;
    this.knownDuration = duration ?? NaN;
    this.isEnded = false;
    if (this.ownsPlayer) {
      avplayManager.close();
    }
    this.dispatchEvent(new Event('durationchange'));
  }

  get src(): string {
    if (this.fallbackAudio) return this.fallbackAudio.src;
    return this.source ?? '';
  }

  set src(url: string) {
    this.setSource(url);
  }

  get currentTime(): number {
    if (this.fallbackAudio) return this.fallbackAudio.currentTime;
    if (!this.live) return this.startSec;
    try {
      return avplayManager.api.getCurrentTime() / 1000;
    } catch {
      return this.startSec;
    }
  }

  set currentTime(timeSec: number) {
    const clamped = Math.max(0, timeSec);
    if (this.fallbackAudio) {
      this.fallbackAudio.currentTime = clamped;
      return;
    }

    if (!this.live) {
      this.startSec = clamped;
    } else {
      try {
        avplayManager.api.seekTo(
          Math.round(clamped * 1000),
          () => this.dispatchEvent(new Event('seeked')),
          () => this.dispatchEvent(new Event('seeked')),
        );
        this.isEnded = false;
      } catch {
        this.startSec = clamped;
      }
    }
  }

  get duration(): number {
    if (this.fallbackAudio) return this.fallbackAudio.duration;
    if (this.live) {
      try {
        const d = avplayManager.api.getDuration();
        if (d > 0) return d / 1000;
      } catch {
        // Fall through
      }
    }
    return this.knownDuration;
  }

  get paused(): boolean {
    if (this.fallbackAudio) return this.fallbackAudio.paused;
    return this.isPaused;
  }

  get ended(): boolean {
    if (this.fallbackAudio) return this.fallbackAudio.ended;
    return this.isEnded;
  }

  get readyState(): number {
    if (this.fallbackAudio) return this.fallbackAudio.readyState;
    return this.source ? 4 : 0;
  }

  get playbackRate(): number {
    if (this.fallbackAudio) return this.fallbackAudio.playbackRate;
    return this.rate;
  }

  set playbackRate(val: number) {
    if (this.fallbackAudio) {
      this.fallbackAudio.playbackRate = val;
      return;
    }
    this.rate = val;
    if (this.live) {
      try {
        avplayManager.api.setSpeed(val);
      } catch {
        // Ignore
      }
    }
    this.dispatchEvent(new Event('ratechange'));
  }

  async play(): Promise<void> {
    if (this.fallbackAudio) {
      return this.fallbackAudio.play();
    }

    if (!this.source) {
      return Promise.reject(new DOMException('No audio source set', 'NotSupportedError'));
    }

    this.playingPromise ??= this.start().finally(() => {
      this.playingPromise = null;
    });
    return this.playingPromise;
  }

  private async start(): Promise<void> {
    if (!avplayManager.prepared || avplayManager.openUrl !== this.source || !this.ownsPlayer) {
      await this.claim();
    }

    avplayManager.api.play();
    if (this.rate !== 1) {
      this.playbackRate = this.rate;
    }
    this.isPaused = false;
    this.isEnded = false;
    this.dispatchEvent(new Event('play'));
    this.dispatchEvent(new Event('playing'));
    this.setScreenSaverState(false);
  }

  private async claim(): Promise<void> {
    const currentOwner = avplayManager.owner;
    if (currentOwner && currentOwner !== this) {
      currentOwner.yield();
    }

    avplayManager.ensureObject();
    avplayManager.close();
    avplayManager.owner = this;

    const api = avplayManager.api;
    api.open(this.source!);
    avplayManager.openUrl = this.source;
    api.setDisplayRect(0, 0, 1, 1);

    api.setListener({
      onbufferingstart: () => this.ownsPlayer && this.dispatchEvent(new Event('waiting')),
      onbufferingcomplete: () => this.ownsPlayer && !this.isPaused && this.dispatchEvent(new Event('playing')),
      oncurrentplaytime: () => {
        if (!this.ownsPlayer) return;
        const now = performance.now();
        if (now - this.lastTimeUpdate >= 250) {
          this.lastTimeUpdate = now;
          this.dispatchEvent(new Event('timeupdate'));
        }
      },
      onstreamcompleted: () => {
        if (!this.ownsPlayer) return;
        this.isEnded = true;
        this.isPaused = true;
        this.dispatchEvent(new Event('pause'));
        this.dispatchEvent(new Event('ended'));
        this.setScreenSaverState(true);
      },
      onerror: (err) => {
        if (!this.ownsPlayer) return;
        console.error('[avplay] Playback error', err);
        this.dispatchEvent(new Event('error'));
        this.setScreenSaverState(true);
      },
    });

    await new Promise<void>((resolve, reject) => {
      api.prepareAsync(resolve, (err) => reject(new Error(`AVPlay prepare failed: ${String(err)}`)));
    });

    avplayManager.prepared = true;
    if (this.startSec > 0) {
      await new Promise<void>((resolve) => {
        api.seekTo(Math.round(this.startSec * 1000), resolve, () => resolve());
      });
    }

    this.dispatchEvent(new Event('durationchange'));
    this.dispatchEvent(new Event('canplay'));
  }

  yield() {
    this.startSec = this.currentTime;
    this.isPaused = true;
    this.dispatchEvent(new Event('pause'));
    this.setScreenSaverState(true);
  }

  pause() {
    if (this.fallbackAudio) {
      this.fallbackAudio.pause();
      return;
    }
    if (this.live) {
      try {
        avplayManager.api.pause();
      } catch {
        // Ignore
      }
    }
    if (!this.isPaused) {
      this.isPaused = true;
      this.dispatchEvent(new Event('pause'));
      this.setScreenSaverState(true);
    }
  }

  release() {
    if (this.fallbackAudio) {
      this.fallbackAudio.pause();
      this.fallbackAudio.src = '';
      return;
    }
    if (this.ownsPlayer) {
      avplayManager.close();
      avplayManager.owner = null;
    }
    this.source = null;
    this.isPaused = true;
    this.setScreenSaverState(true);
  }

  private setScreenSaverState(enabled: boolean) {
    try {
      const appcommon = window.webapis?.appcommon;
      if (appcommon) {
        const state = enabled
          ? appcommon.AppCommonScreenSaverState.SCREEN_SAVER_ON
          : appcommon.AppCommonScreenSaverState.SCREEN_SAVER_OFF;
        appcommon.setScreenSaver(state);
      }
    } catch {
      // Ignore
    }
  }

  load() {
    // No-op for AVPlay
  }

  canPlayType(_mime: string): CanPlayTypeResult {
    return 'maybe';
  }
}

