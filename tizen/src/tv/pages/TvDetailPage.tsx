import React, { useState, useEffect } from 'react';
import { Play, Shuffle, ArrowLeft, Heart } from 'lucide-react';
import { TvArtwork } from '../components/TvArtwork';
import { TvTracklistSkeleton } from '../components/TvSkeleton';
import { searchMusic, fetchDetailTracks } from '../../api/musicApi';
import type { DetailPayload, PlayableTrack } from './TvHomePage';

interface TvDetailPageProps {
  detail: DetailPayload;
  onBack: () => void;
  onPlayTrack: (track: PlayableTrack) => void;
  onPlayAll: (tracks: PlayableTrack[], shuffle?: boolean) => void;
}

export const TvDetailPage: React.FC<TvDetailPageProps> = ({
  detail,
  onBack,
  onPlayTrack,
  onPlayAll,
}) => {
  const [tracks, setTracks] = useState<PlayableTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setIsLoading(true);

    fetchDetailTracks(detail.browseId, detail.type)
      .then((data) => {
        if (!active) return;
        if (data.tracks && data.tracks.length > 0) {
          setTracks(data.tracks);
        } else if (detail.type === 'artist') {
          return searchMusic(`${detail.title} songs`).then((items) => {
            if (!active) return;
            setTracks(items || []);
          });
        } else {
          setTracks([]);
        }
      })
      .catch((e) => {
        console.warn('[TvDetailPage] fetchDetailTracks fallback:', e);
        if (detail.type === 'artist') {
          searchMusic(`${detail.title} songs`).then((items) => {
            if (!active) return;
            setTracks(items || []);
          });
        } else {
          setTracks([]);
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [detail]);

  const formatDuration = (sec?: number) => {
    if (!sec) return '3:45';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="pt-6 pb-24 px-[56px] overflow-y-auto h-full">
      {/* Back button */}
      <button
        tabIndex={0}
        onClick={onBack}
        className="tv-pill-focusable flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white/80 hover:text-white mb-6"
      >
        <ArrowLeft size={18} />
        <span className="text-sm font-semibold">Back</span>
      </button>

      {/* Hero Header */}
      <div className="flex gap-10 items-end mb-10">
        <div className="w-56 h-56 rounded-3xl overflow-hidden shadow-2xl shrink-0 border border-white/10">
          <TvArtwork
            src={detail.artworkUrl}
            alt={detail.title}
            fallbackVideoId={tracks[0]?.videoId}
            className="w-full h-full rounded-3xl"
            eager
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-xs uppercase tracking-widest font-bold text-[#FA2D48]">
            {detail.type}
          </span>
          <h1 className="text-4xl font-black text-white tracking-tight">{detail.title}</h1>
          <p className="text-lg text-white/60 font-medium">
            {detail.subtitle} • {isLoading ? 'Loading tracks...' : `${tracks.length} Songs`}
          </p>

          <div className="flex gap-4 mt-4">
            <button
              tabIndex={0}
              disabled={tracks.length === 0}
              onClick={() => tracks.length > 0 && onPlayAll(tracks, false)}
              className={`tv-pill-focusable px-8 py-3.5 rounded-full bg-[#FA2D48] text-white font-bold flex items-center gap-2.5 shadow-xl shadow-red-500/30 ${
                tracks.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              <Play size={20} className="fill-white" />
              <span>Play All</span>
            </button>

            <button
              tabIndex={0}
              disabled={tracks.length === 0}
              onClick={() => tracks.length > 0 && onPlayAll(tracks, true)}
              className={`tv-pill-focusable px-6 py-3.5 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold flex items-center gap-2.5 backdrop-blur-md ${
                tracks.length === 0 ? 'opacity-40 cursor-not-allowed' : ''
              }`}
            >
              <Shuffle size={18} />
              <span>Shuffle</span>
            </button>

            <button
              tabIndex={0}
              className="tv-pill-focusable w-12 h-12 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center backdrop-blur-md"
            >
              <Heart size={20} />
            </button>
          </div>
        </div>
      </div>

      {/* Tracklist */}
      <div className="flex flex-col gap-2 max-w-[1200px]">
        {isLoading ? (
          <TvTracklistSkeleton count={8} />
        ) : tracks.length === 0 ? (
          <div className="p-12 text-center text-white/50 bg-white/5 rounded-2xl border border-white/10">
            No playable tracks found for this selection.
          </div>
        ) : (
          tracks.map((t, idx) => (
            <button
              key={`${t.videoId}-${idx}`}
              tabIndex={0}
              onClick={() => onPlayTrack(t)}
              className="tv-focusable flex items-center justify-between p-4 rounded-2xl bg-white/5 hover:bg-white/15 border border-transparent hover:border-white/20 text-left group"
            >
              <div className="flex items-center gap-4">
                <span className="w-8 text-center text-sm font-semibold text-white/40 group-focus:text-white">
                  {idx + 1}
                </span>
                <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
                  <TvArtwork
                    src={t.artworkUrl}
                    alt={t.title}
                    fallbackVideoId={t.videoId}
                    className="w-full h-full rounded-xl"
                  />
                </div>
                <div className="flex flex-col">
                  <span className="text-lg font-bold text-white group-focus:text-[#FA2D48] transition-colors">
                    {t.title}
                  </span>
                  <span className="text-sm text-white/60">{t.artist}</span>
                </div>
              </div>

              <span className="text-sm font-medium text-white/40 pr-4">
                {formatDuration(t.durationSec)}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );
};
