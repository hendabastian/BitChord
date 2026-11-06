import React, { useState, useEffect } from 'react';
import { TvShelf } from '../components/TvShelf';
import { TvCard } from '../components/TvCard';
import { TvShelfSkeleton } from '../components/TvSkeleton';
import { fetchExploreFeed } from '../../api/musicApi';
import type { DetailPayload, PlayableTrack } from './TvHomePage';

interface TvExplorePageProps {
  onPlayTrack: (track: PlayableTrack) => void;
  onOpenDetail: (detail: DetailPayload) => void;
}

export const TvExplorePage: React.FC<TvExplorePageProps> = ({ onPlayTrack, onOpenDetail }) => {
  const [trending, setTrending] = useState<PlayableTrack[]>([]);
  const [newReleases, setNewReleases] = useState<DetailPayload[]>([]);
  const [musicVideos, setMusicVideos] = useState<PlayableTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const genres = [
    { id: 'pop', title: 'Pop', color: 'from-pink-500 to-rose-600' },
    { id: 'hiphop', title: 'Hip-Hop', color: 'from-orange-500 to-amber-600' },
    { id: 'electronic', title: 'Electronic / Dance', color: 'from-cyan-500 to-blue-600' },
    { id: 'rock', title: 'Rock & Alternative', color: 'from-purple-600 to-indigo-700' },
    { id: 'rnb', title: 'R&B / Soul', color: 'from-fuchsia-600 to-pink-700' },
    { id: 'indie', title: 'Indie', color: 'from-emerald-500 to-teal-700' },
    { id: 'classical', title: 'Classical & Ambient', color: 'from-slate-600 to-zinc-800' },
  ];

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);

    fetchExploreFeed()
      .then((data) => {
        if (!mounted) return;
        setTrending(data.trending || []);
        setNewReleases(data.newReleases || []);
        setMusicVideos(data.musicVideos || []);
      })
      .catch((err) => {
        console.warn('[TvExplorePage] fetchExploreFeed failed:', err);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="pt-6 pb-24 overflow-y-auto h-full">
      {/* Moods & Genres */}
      <section className="mb-10 px-[56px]">
        <h2 className="text-2xl font-bold tracking-tight text-white mb-4">Moods & Genres</h2>
        <div className="grid grid-cols-4 gap-5">
          {genres.map((g) => (
            <button
              key={g.id}
              tabIndex={0}
              onClick={() =>
                onOpenDetail({
                  browseId: `genre_${g.id}`,
                  title: g.title,
                  subtitle: 'Genre Station',
                  type: 'playlist',
                })
              }
              className={`tv-focusable h-28 rounded-2xl bg-gradient-to-br ${g.color} p-5 flex items-end justify-start text-left shadow-lg border border-white/10`}
            >
              <span className="text-xl font-black text-white tracking-tight">{g.title}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Loading Skeletons or Live Sections */}
      {isLoading ? (
        <>
          <TvShelfSkeleton
            title="Trending Hits"
            subtitle="Loading top tracks trending right now..."
            count={6}
          />
          <TvShelfSkeleton
            title="New Albums & Singles"
            subtitle="Loading fresh studio releases..."
            count={5}
          />
          <TvShelfSkeleton
            title="New Music Videos"
            subtitle="Loading trending music videos..."
            count={4}
            width="w-[260px]"
            aspectRatio="wide"
          />
        </>
      ) : (
        <>
          {/* Trending Hits */}
          {trending.length > 0 && (
            <TvShelf index={0} title="Trending Hits" subtitle="The most played songs right now">
              {trending.map((track) => (
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

          {/* New Releases */}
          {newReleases.length > 0 && (
            <TvShelf
              index={1}
              title="New Albums & Singles"
              subtitle="Latest releases from world-class artists"
            >
              {newReleases.map((album) => (
                <TvCard
                  key={album.browseId}
                  id={album.browseId}
                  title={album.title}
                  subtitle={album.subtitle}
                  artworkUrl={album.artworkUrl}
                  onClick={() => onOpenDetail(album)}
                />
              ))}
            </TvShelf>
          )}

          {/* Music Videos */}
          {musicVideos.length > 0 && (
            <TvShelf index={2} title="New Music Videos" subtitle="Popular official music videos">
              {musicVideos.map((video) => (
                <TvCard
                  key={video.videoId}
                  id={video.videoId}
                  title={video.title}
                  subtitle={video.artist}
                  artworkUrl={video.artworkUrl}
                  width="w-[260px]"
                  aspectRatio="wide"
                  onClick={() => onPlayTrack(video)}
                />
              ))}
            </TvShelf>
          )}
        </>
      )}
    </div>
  );
};
