import React, { useEffect, useRef } from 'react';

export interface LyricLine {
  timeSec: number;
  text: string;
}

interface TvLyricsViewProps {
  lines: LyricLine[];
  currentTime: number;
  isSynced?: boolean;
  onLineClick?: (timeSec: number) => void;
}

export const TvLyricsView: React.FC<TvLyricsViewProps> = ({
  lines,
  currentTime,
  isSynced = true,
  onLineClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const activeLineRef = useRef<HTMLDivElement>(null);

  // Determine current active line index for synced lyrics
  let activeIndex = -1;
  let isLineStillSinging = true;

  if (isSynced && lines.length > 0) {
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (l && l.timeSec >= 0 && l.timeSec <= currentTime) {
        activeIndex = i;
      } else {
        break;
      }
    }

    // Check if we are in an extended instrumental break (e.g. > 7 seconds after vocal)
    if (activeIndex >= 0) {
      const currentLine = lines[activeIndex];
      const nextLine = lines[activeIndex + 1];
      const lineStart = currentLine ? currentLine.timeSec : 0;
      const nextStart = nextLine ? nextLine.timeSec : lineStart + 999;
      const gap = nextStart - lineStart;

      // If gap is long and we've passed 6 seconds into it, gently fade singing state
      if (gap > 7 && currentTime - lineStart > 6) {
        isLineStillSinging = false;
      }
    }
  }

  // Smoothly center the active line inside the container
  useEffect(() => {
    if (isSynced && activeLineRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeLineRef.current;
      const targetScroll = el.offsetTop - container.offsetHeight / 2 + el.offsetHeight / 2;
      container.scrollTo({
        top: Math.max(0, targetScroll),
        behavior: 'smooth',
      });
    }
  }, [activeIndex, isSynced]);

  if (!lines || lines.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-8 text-white/40">
        <span className="text-4xl mb-3">♪</span>
        <span className="text-xl font-bold">Lyrics Not Available</span>
        <p className="text-sm text-white/30 mt-1 max-w-[320px]">
          No synchronized or plain lyrics found for this track.
        </p>
      </div>
    );
  }

  // Plain / Unsynced Mode
  if (!isSynced) {
    return (
      <div className="h-full flex flex-col justify-start">
        <div className="mb-4">
          <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-white/60 text-xs font-semibold uppercase tracking-wider">
            Plain Lyrics (Unsynced)
          </span>
        </div>
        <div
          ref={containerRef}
          className="h-[580px] overflow-y-auto pr-6 space-y-4 py-8 no-scrollbar scroll-smooth"
        >
          {lines.map((line, idx) => (
            <p
              key={idx}
              className="text-2xl font-bold text-white/70 leading-relaxed select-text"
            >
              {line.text}
            </p>
          ))}
        </div>
      </div>
    );
  }

  // Synced Karaoke Mode
  return (
    <div
      ref={containerRef}
      className="h-[620px] overflow-y-auto pr-6 flex flex-col gap-8 py-52 no-scrollbar scroll-smooth"
    >
      {lines.map((line, idx) => {
        const isActive = idx === activeIndex;
        const isPast = idx < activeIndex;

        return (
          <div
            key={idx}
            ref={isActive ? activeLineRef : null}
            tabIndex={-1}
            onClick={() => onLineClick && line.timeSec >= 0 && onLineClick(line.timeSec)}
            className={`text-left transition-all duration-300 rounded-xl px-4 py-2 cursor-pointer select-none ${
              isActive
                ? isLineStillSinging
                  ? 'text-4xl font-black text-white scale-105 origin-left [text-shadow:0_0_24px_rgba(255,255,255,0.6)]'
                  : 'text-3xl font-extrabold text-white/80 origin-left'
                : isPast
                ? 'text-3xl font-bold text-white/25 blur-[0.3px]'
                : 'text-3xl font-bold text-white/40'
            }`}
          >
            {line.text}
          </div>
        );
      })}
    </div>
  );
};
