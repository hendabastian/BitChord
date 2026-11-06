import React, { useState, useEffect, useRef } from 'react';

interface TvScrubberProps {
  currentTime: number; // in seconds
  duration: number; // in seconds
  onSeek: (targetTimeSec: number) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const TvScrubber: React.FC<TvScrubberProps> = ({
  currentTime,
  duration,
  onSeek,
}) => {
  const [scrubbingTime, setScrubbingTime] = useState<number | null>(null);
  const commitTimer = useRef<NodeJS.Timeout | null>(null);

  const displayTime = scrubbingTime !== null ? scrubbingTime : currentTime;
  const progressPercent = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;

  const handleStep = (deltaSec: number) => {
    const base = scrubbingTime !== null ? scrubbingTime : currentTime;
    const next = Math.max(0, Math.min(duration || 0, base + deltaSec));
    setScrubbingTime(next);

    if (commitTimer.current) clearTimeout(commitTimer.current);
    commitTimer.current = setTimeout(() => {
      onSeek(next);
      setScrubbingTime(null);
    }, 650);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleStep(-10);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleStep(10);
    }
  };

  useEffect(() => {
    return () => {
      if (commitTimer.current) clearTimeout(commitTimer.current);
    };
  }, []);

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        const targetSec = ratio * (duration || 1);
        onSeek(targetSec);
        setScrubbingTime(null);
      }}
      className="tv-focusable w-full py-4 px-2 flex flex-col gap-2 rounded-2xl group cursor-pointer focus:bg-white/5"
    >
      <div className="relative w-full h-2.5 bg-white/20 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 bottom-0 bg-[#FA2D48] transition-all rounded-full group-focus:bg-white"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex justify-between text-sm font-semibold text-white/70">
        <span>{formatTime(displayTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>
    </div>
  );
};

