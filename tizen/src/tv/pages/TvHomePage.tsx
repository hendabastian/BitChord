import React, { useState, useEffect } from 'react';
import { TvShelf } from '../components/TvShelf';
import { TvCard } from '../components/TvCard';
import { TvShelfSkeleton } from '../components/TvSkeleton';
import { fetchHomeFeed } from '../../api/musicApi';
import { applyFocus } from '../../platform/spatialNav';
import { RefreshCw } from 'lucide-react';

export interface PlayableTrack {
  videoId: string;
  title: string;
  artist: string;
  artworkUrl?: string | null;
  durationSec?: number;
  streamUrl?: string;
  album?: string;
}

export interface DetailPayload {
  browseId: string;
  title: string;
  subtitle: string;
  artworkUrl?: string | null;
  type: 'album' | 'playlist' | 'artist';
}

interface TvHomePageProps {
  onPlayTrack: (track: PlayableTrack) => void;
  onOpenDetail: (detail: DetailPayload) => void;
}

export const TvHomePage: React.FC<TvHomePageProps> = ({ onPlayTrack, onOpenDetail }) => {
  const [quickPicks, setQuickPicks] = useState<PlayableTrack[]>([]);
  const [mixedForYou, setMixedForYou] = useState<DetailPayload[]>([]);
  const [artists, setArtists] = useState<DetailPayload[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFeed = () => {
    setIsLoading(true);
    fetchHomeFeed()
      .then((data) => {
        setQuickPicks(data.quickPicks || []);
        setMixedForYou(data.mixedForYou || []);
        setArtists(data.artists || []);
      })
      .catch((err) => {
        console.warn('[TvHomePage] Failed to fetch home feed:', err);
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  useEffect(() => {
    loadFeed();
  }, []);

  useEffect(() => {
    if (!isLoading && quickPicks.length > 0) {
      if (!document.activeElement || document.activeElement === document.body) {
        const timer = setTimeout(() => {
          const firstCard = document.querySelector<HTMLElement>('.tv-focusable');
          if (firstCard) applyFocus(firstCard);
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isLoading, quickPicks.length]);

  return (
    <div className="pt-6 pb-24 overflow-y-auto h-full">
      {isLoading ? (
        <>
          <TvShelfSkeleton
            title="Quick Picks"
            subtitle="Loading personalized recommendations..."
            count={6}
          />
          <TvShelfSkeleton
            title="Mixed for You"
            subtitle="Loading radio mixes and community playlists..."
            count={4}
            width="w-[260px]"
            aspectRatio="wide"
          />
          <TvShelfSkeleton
            title="Featured Artists"
            subtitle="Loading top artists..."
            count={6}
            aspectRatio="circle"
          />
        </>
      ) : quickPicks.length === 0 && mixedForYou.length === 0 && artists.length === 0 ? (
        <div className="px-[56px] py-16 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center text-white/50 mb-4">
            <RefreshCw size={28} />
          </div>
          <h3 className="text-xl font-bold text-white">Connecting to YouTube Music</h3>
          <p className="text-sm text-white/50 max-w-[420px] mt-1 mb-6">
            Unable to fetch home recommendations right now. Please check your network connection or retry.
          </p>
          <button
            tabIndex={0}
            onClick={loadFeed}
            className="tv-pill-focusable px-6 py-3 rounded-full bg-[#FA2D48] text-white font-bold text-sm shadow-lg shadow-red-500/30"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <>
          {/* Quick Picks */}
          {quickPicks.length > 0 && (
            <TvShelf
              index={0}
              title="Quick Picks"
              subtitle="Start a radio station or pick up where you left off"
            >
              {quickPicks.map((track) => (
                <TvCard
                  key={track.videoId}
                  id={track.videoId}
                  title={track.title}
                  subtitle={track.artist}
                  artworkUrl={track.artworkUrl}
                  onClick={() => onPlayTrack(track)}
                />
              ))}
            </TvShelf>
          )}

          {/* Mixed for You */}
          {mixedForYou.length > 0 && (
            <TvShelf
              index={1}
              title="Mixed for You"
              subtitle="Personalized radio stations and curated mixes"
            >
              {mixedForYou.map((mix) => (
                <TvCard
                  key={mix.browseId}
                  id={mix.browseId}
                  title={mix.title}
                  subtitle={mix.subtitle}
                  artworkUrl={mix.artworkUrl}
                  width="w-[260px]"
                  aspectRatio="wide"
                  onClick={() => onOpenDetail(mix)}
                />
              ))}
            </TvShelf>
          )}

          {/* Featured Artists */}
          {artists.length > 0 && (
            <TvShelf index={2} title="Featured Artists" subtitle="Popular and trending performers">
              {artists.map((artist) => (
                <TvCard
                  key={artist.browseId}
                  id={artist.browseId}
                  title={artist.title}
                  subtitle={artist.subtitle}
                  artworkUrl={artist.artworkUrl}
                  aspectRatio="circle"
                  onClick={() => onOpenDetail(artist)}
                />
              ))}
            </TvShelf>
          )}
        </>
      )}
    </div>
  );
};
