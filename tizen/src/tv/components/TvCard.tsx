import React from 'react';
import { Play } from 'lucide-react';
import { TvArtwork } from './TvArtwork';

interface TvCardProps {
  id: string;
  title: string;
  subtitle?: string;
  artworkUrl?: string | null;
  aspectRatio?: 'square' | 'wide' | 'circle';
  onClick: () => void;
  width?: string;
}

export const TvCard: React.FC<TvCardProps> = ({
  id,
  title,
  subtitle,
  artworkUrl,
  aspectRatio = 'square',
  onClick,
  width = 'w-[220px]',
}) => {
  return (
    <button
      tabIndex={0}
      onClick={onClick}
      className={`tv-focusable flex flex-col text-left ${width} group shrink-0 p-2.5 rounded-[22px] bg-white/5 border border-transparent hover:border-white/20`}
    >
      <div className="w-full relative shadow-md">
        <TvArtwork
          src={artworkUrl}
          alt={title}
          fallbackVideoId={id}
          aspectRatio={aspectRatio}
          className="w-full transition-transform duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity flex items-center justify-center rounded-[18px]">
          <div className="w-12 h-12 rounded-full bg-[#FA2D48] text-white flex items-center justify-center shadow-lg shadow-black/50">
            <Play size={22} className="ml-1 fill-white" />
          </div>
        </div>
      </div>

      <div className="mt-3 px-1">
        <h4 className="text-base font-bold text-white truncate leading-snug">{title}</h4>
        {subtitle && (
          <p className="text-xs text-white/60 truncate mt-0.5 font-medium">{subtitle}</p>
        )}
      </div>
    </button>
  );
};
