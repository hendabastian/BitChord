import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Shuffle,
  Repeat,
  ListMusic,
  ArrowDown,
  Sparkles,
} from 'lucide-react';
import { TvScrubber } from '../components/TvScrubber';
import { TvArtwork } from '../components/TvArtwork';
import { TvLyricsView, type LyricLine } from './TvLyricsView';
import { TvQueueSheet } from './TvQueueSheet';
import { pushBackListener } from '../../platform/keys';
import { setFocusTrap, applyFocus } from '../../platform/spatialNav';
import { fetchLyrics } from '../../api/musicApi';
import type { PlayableTrack } from '../pages/TvHomePage';

interface TvNowPlayingProps {
  track: PlayableTrack;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  queue: PlayableTrack[];
  currentIndex: number;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (timeSec: number) => void;
  onSelectQueueTrack: (index: number) => void;
  onBack: () => void;
}

export const TvNowPlaying: React.FC<TvNowPlayingProps> = ({
  track,
  isPlaying,
  currentTime,
  duration,
  queue,
  currentIndex,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onSelectQueueTrack,
  onBack,
}) => {
  const [controlsVisible, setControlsVisible] = useState(true);
  const [showQueue, setShowQueue] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [isLyricsSynced, setIsLyricsSynced] = useState(true);
  const [syncOffsetSec, setSyncOffsetSec] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const playPauseRef = useRef<HTMLButtonElement>(null);
  const upNextButtonRef = useRef<HTMLButtonElement>(null);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);

  // Focus trap inside Now Playing overlay
  useEffect(() => {
    if (!showQueue && rootRef.current) {
      setFocusTrap(rootRef.current);
      if (playPauseRef.current) {
        applyFocus(playPauseRef.current);
      }
    }
    return () => {
      setFocusTrap(null);
    };
  }, [showQueue]);

  // Fetch real synced lyrics whenever the playing track changes
  useEffect(() => {
    let active = true;
    setSyncOffsetSec(0);

    fetchLyrics(track.artist, track.title, track.durationSec, track.videoId)
      .then((res) => {
        if (!active) return;
        setIsLyricsSynced(res.synced);
        if (res.lines.length > 0) {
          setLyrics(res.lines);
        } else {
          // Default intro if no lyrics found
          setIsLyricsSynced(true);
          setLyrics([
            { timeSec: 0, text: `♪ ${track.title} ♪` },
            { timeSec: 4, text: `${track.artist}` },
            { timeSec: 8, text: '♪ (Instrumental / Playing...) ♪' },
          ]);
        }
      })
      .catch((err) => {
        console.warn('[TvNowPlaying] Failed to load lyrics:', err);
      });

    return () => {
      active = false;
    };
  }, [track.videoId, track.title, track.artist, track.durationSec]);

  const resetHideTimer = () => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      setControlsVisible(false);
    }, 8000);
  };

  useEffect(() => {
    const handleActivity = (e: KeyboardEvent) => {
      resetHideTimer();
      // If controls were hidden, reveal them on first key press
      if (!controlsVisible && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        setControlsVisible(true);
      }
    };
    window.addEventListener('keydown', handleActivity);
    resetHideTimer();
    return () => {
      window.removeEventListener('keydown', handleActivity);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [controlsVisible]);

  // Back key handling: close queue sheet -> close player
  useEffect(() => {
    const removeBack = pushBackListener(() => {
      if (showQueue) {
        setShowQueue(false);
        if (upNextButtonRef.current) {
          applyFocus(upNextButtonRef.current);
        }
        return true;
      }
      onBack();
      return true;
    });
    return removeBack;
  }, [showQueue, onBack]);

  const effectiveCurrentTime = Math.max(0, currentTime + syncOffsetSec);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-50 bg-[#08080B] flex flex-col justify-between p-[56px] overflow-hidden select-none"
    >
      {/* Ambient Radial Gradient derived from artwork */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 blur-3xl scale-125"
        style={{
          background: track.artworkUrl
            ? `radial-gradient(circle at 30% 40%, rgba(250,45,72,0.45) 0%, rgba(18,18,24,0.95) 70%, #08080B 100%)`
            : undefined,
        }}
      />

      {/* Top Bar: Dismiss & Status Badges */}
      <div
        className={`relative z-10 flex items-center justify-between transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-20'
        }`}
      >
        <button
          tabIndex={0}
          onClick={onBack}
          className="tv-pill-focusable flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-semibold backdrop-blur-md"
        >
          <ArrowDown size={18} />
          <span>Minimize Player</span>
        </button>

        <div className="flex items-center gap-3">
          {/* Lyrics Sync Status Badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-bold text-white/80 backdrop-blur-md">
            <span
              className={`w-2 h-2 rounded-full ${
                isLyricsSynced ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span>{isLyricsSynced ? 'Synced Lyrics' : 'Plain Lyrics'}</span>
            {isLyricsSynced && syncOffsetSec !== 0 && (
              <span className="text-white/50 text-[10px]">
                ({syncOffsetSec > 0 ? `+${syncOffsetSec.toFixed(1)}s` : `${syncOffsetSec.toFixed(1)}s`})
              </span>
            )}
          </div>

          {/* Audio Quality Badge */}
          <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wider text-white/80 backdrop-blur-md">
            <Sparkles size={14} className="text-[#FA2D48]" />
            <span>24-bit / 96kHz Lossless</span>
          </div>
        </div>
      </div>

      {/* Main Stage: Artwork on Left, Karaoke Lyrics on Right */}
      <div className="relative z-10 flex gap-20 items-center flex-1 my-4">
        {/* Left Side: Artwork & Info */}
        <div className="w-[460px] flex flex-col shrink-0">
          <div className="w-[440px] h-[440px] rounded-[32px] overflow-hidden shadow-2xl bg-[#1a1a20] border border-white/10 mb-8">
            <TvArtwork
              src={track.artworkUrl}
              alt={track.title}
              fallbackVideoId={track.videoId}
              className="w-full h-full rounded-[32px]"
              eager
            />
          </div>

          <h2 className="text-3xl font-black text-white truncate tracking-tight">{track.title}</h2>
          <p className="text-xl text-white/60 font-semibold truncate mt-1">{track.artist}</p>
        </div>

        {/* Right Side: Lyrics Panel (not focusable, doesn't trap D-Pad) */}
        <div className="flex-1 h-full flex flex-col justify-center">
          <TvLyricsView
            lines={lyrics}
            currentTime={effectiveCurrentTime}
            isSynced={isLyricsSynced}
            onLineClick={(time) => onSeek(time)}
          />
        </div>
      </div>

      {/* Bottom Transport Bar */}
      <div
        className={`relative z-10 flex flex-col gap-2 transition-opacity duration-300 ${
          controlsVisible ? 'opacity-100' : 'opacity-20'
        }`}
      >
        <TvScrubber
          currentTime={currentTime}
          duration={duration}
          onSeek={onSeek}
        />

        <div className="flex items-center justify-between px-2">
          {/* Left Toggles: Shuffle & Repeat */}
          <div className="flex items-center gap-3">
            <button
              tabIndex={0}
              onClick={() => setIsShuffle((s) => !s)}
              className={`tv-pill-focusable p-3 rounded-full ${
                isShuffle ? 'bg-white text-black' : 'bg-white/10 text-white'
              }`}
            >
              <Shuffle size={20} />
            </button>
            <button
              tabIndex={0}
              onClick={() =>
                setRepeatMode((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'))
              }
              className={`tv-pill-focusable p-3 rounded-full ${
                repeatMode !== 'off' ? 'bg-white text-black' : 'bg-white/10 text-white'
              }`}
            >
              <Repeat size={20} />
            </button>
          </div>

          {/* Center Playback Controls */}
          <div className="flex items-center gap-6">
            <button
              tabIndex={0}
              onClick={onPrevious}
              className="tv-pill-focusable p-4 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <SkipBack size={26} className="fill-white" />
            </button>

            <button
              ref={playPauseRef}
              data-tv-autofocus="true"
              tabIndex={0}
              onClick={onPlayPause}
              className="tv-pill-focusable p-5 rounded-full bg-[#FA2D48] text-white shadow-xl shadow-red-500/40"
            >
              {isPlaying ? (
                <Pause size={32} className="fill-white" />
              ) : (
                <Play size={32} className="fill-white ml-0.5" />
              )}
            </button>

            <button
              tabIndex={0}
              onClick={onNext}
              className="tv-pill-focusable p-4 rounded-full bg-white/10 text-white hover:bg-white/20"
            >
              <SkipForward size={26} className="fill-white" />
            </button>
          </div>

          {/* Right Toggles: Up Next Queue Drawer */}
          <div className="flex items-center gap-3">
            <button
              ref={upNextButtonRef}
              tabIndex={0}
              onClick={() => setShowQueue(true)}
              className="tv-pill-focusable flex items-center gap-2 px-5 py-3 rounded-full bg-white/10 text-white font-bold"
            >
              <ListMusic size={20} />
              <span>Up Next</span>
            </button>
          </div>
        </div>
      </div>

      {/* Up Next Drawer */}
      {showQueue && (
        <TvQueueSheet
          queue={queue}
          currentIndex={currentIndex}
          onSelectTrack={(idx) => {
            onSelectQueueTrack(idx);
            setShowQueue(false);
          }}
          onClose={() => {
            setShowQueue(false);
            if (upNextButtonRef.current) {
              applyFocus(upNextButtonRef.current);
            }
          }}
        />
      )}
    </div>
  );
};
