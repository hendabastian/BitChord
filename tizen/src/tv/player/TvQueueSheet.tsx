import React, { useEffect, useRef } from 'react';
import { X, Play } from 'lucide-react';
import { TvArtwork } from '../components/TvArtwork';
import { setFocusTrap, applyFocus } from '../../platform/spatialNav';
import type { PlayableTrack } from '../pages/TvHomePage';

interface TvQueueSheetProps {
  queue: PlayableTrack[];
  currentIndex: number;
  onSelectTrack: (index: number) => void;
  onClose: () => void;
}

export const TvQueueSheet: React.FC<TvQueueSheetProps> = ({
  queue,
  currentIndex,
  onSelectTrack,
  onClose,
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const currentButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (sheetRef.current) {
      setFocusTrap(sheetRef.current);
      if (currentButtonRef.current) {
        applyFocus(currentButtonRef.current);
      }
    }
    return () => {
      setFocusTrap(null);
    };
  }, []);

  return (
    <div
      ref={sheetRef}
      className="fixed inset-y-0 right-0 w-[560px] bg-[#121216]/98 border-l border-white/10 backdrop-blur-2xl z-50 p-8 flex flex-col shadow-2xl animate-in slide-in-from-right duration-250"
    >
      <div className="flex items-center justify-between pb-6 border-b border-white/10 mb-4">
        <div>
          <h2 className="text-2xl font-black text-white">Up Next</h2>
          <p className="text-sm text-white/50">{queue.length} Tracks in Queue</p>
        </div>
        <button
          tabIndex={0}
          onClick={onClose}
          className="tv-pill-focusable w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2.5 pr-2 no-scrollbar">
        {queue.map((track, idx) => {
          const isCurrent = idx === currentIndex;
          return (
            <button
              key={`${track.videoId}-${idx}`}
              ref={isCurrent ? currentButtonRef : null}
              tabIndex={0}
              onClick={() => onSelectTrack(idx)}
              className={`tv-focusable w-full flex items-center gap-4 p-3 rounded-2xl text-left border ${
                isCurrent
                  ? 'bg-red-500/15 border-red-500/40'
                  : 'bg-white/5 border-transparent hover:border-white/15'
              }`}
            >
              <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0 relative">
                <TvArtwork
                  src={track.artworkUrl}
                  alt={track.title}
                  fallbackVideoId={track.videoId}
                  className="w-full h-full rounded-xl"
                />
                {isCurrent && (
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-[#FA2D48] rounded-xl">
                    <Play size={18} className="fill-[#FA2D48]" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <h4 className={`text-base font-bold truncate ${isCurrent ? 'text-[#FA2D48]' : 'text-white'}`}>
                  {track.title}
                </h4>
                <p className="text-xs text-white/60 truncate mt-0.5">{track.artist}</p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};
