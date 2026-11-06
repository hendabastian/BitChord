import React, { useState, useEffect } from 'react';
import { TvShelf } from '../components/TvShelf';
import { TvCard } from '../components/TvCard';
import { TvShelfSkeleton } from '../components/TvSkeleton';
import { Heart, KeyRound, History, ListMusic, Disc, Mic2 } from 'lucide-react';
import {
  getRecentTracks,
  fetchUserLibrary,
  fetchUserHistory,
  type UserLibraryResult,
} from '../../api/musicApi';
import type { DetailPayload, PlayableTrack } from './TvHomePage';

interface TvLibraryPageProps {
  isSignedIn: boolean;
  onOpenSignIn: () => void;
  onPlayTrack: (track: PlayableTrack) => void;
  onOpenDetail: (detail: DetailPayload) => void;
}

export const TvLibraryPage: React.FC<TvLibraryPageProps> = ({
  isSignedIn,
  onOpenSignIn,
  onPlayTrack,
  onOpenDetail,
}) => {
  const [localHistory, setLocalHistory] = useState<PlayableTrack[]>([]);
  const [userHistory, setUserHistory] = useState<PlayableTrack[]>([]);
  const [libraryData, setLibraryData] = useState<UserLibraryResult>({
    likedSongsCount: 0,
    playlists: [],
    albums: [],
    artists: [],
  });
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    setLocalHistory(getRecentTracks());
  }, []);

  useEffect(() => {
    let active = true;
    if (isSignedIn) {
      setIsLoading(true);
      Promise.all([fetchUserLibrary(), fetchUserHistory()])
        .then(([lib, hist]) => {
          if (!active) return;
          setLibraryData(lib);
          setUserHistory(hist);
        })
        .catch((err) => {
          console.warn('[TvLibraryPage] Failed to fetch user library:', err);
        })
        .finally(() => {
          if (active) setIsLoading(false);
        });
    } else {
      setLibraryData({
        likedSongsCount: 0,
        playlists: [],
        albums: [],
        artists: [],
      });
      setUserHistory([]);
    }

    return () => {
      active = false;
    };
  }, [isSignedIn]);

  const displayHistory = isSignedIn && userHistory.length > 0 ? userHistory : localHistory;

  return (
    <div className="pt-6 pb-24 overflow-y-auto h-full">
      {/* Sign-In Hero Promo (when not signed in) */}
      {!isSignedIn && (
        <section className="mb-8 mx-[56px] p-6 rounded-3xl bg-gradient-to-r from-red-950/40 via-white/5 to-white/5 border border-red-500/20 flex items-center justify-between">
          <div className="max-w-[700px]">
            <h3 className="text-xl font-bold text-white">Sync Your YouTube Music Library</h3>
            <p className="text-sm text-white/60 mt-1">
              Sign in with your Google account using a quick TV code to bring your personal playlists, liked songs, and listening history to this TV.
            </p>
          </div>
          <button
            tabIndex={0}
            onClick={onOpenSignIn}
            className="tv-pill-focusable px-6 py-3 rounded-full bg-[#FA2D48] text-white font-bold flex items-center gap-2.5 shadow-lg shadow-red-500/30 shrink-0"
          >
            <KeyRound size={20} />
            <span>Sign In with Google</span>
          </button>
        </section>
      )}

      {/* Quick Liked Songs Hero Row */}
      <section className="mb-10 px-[56px] flex gap-6 items-center">
        <button
          tabIndex={0}
          onClick={() =>
            onOpenDetail({
              browseId: 'liked',
              title: 'Liked Songs',
              subtitle: 'All your favorite songs',
              type: 'playlist',
            })
          }
          className="tv-focusable h-40 w-88 rounded-3xl bg-gradient-to-br from-red-600 via-[#FA2D48] to-rose-800 p-6 flex flex-col justify-between text-left shadow-2xl relative overflow-hidden group"
        >
          <div className="flex items-center justify-between w-full">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center">
              <Heart size={26} className="fill-white text-white" />
            </div>
            {isSignedIn && libraryData.likedSongsCount > 0 && (
              <span className="text-xs font-bold uppercase tracking-wider bg-black/30 px-3 py-1 rounded-full text-white/90">
                {libraryData.likedSongsCount} Songs
              </span>
            )}
          </div>

          <div>
            <h3 className="text-2xl font-black text-white tracking-tight">Liked Songs</h3>
            <p className="text-xs text-white/80 mt-1">
              {isSignedIn && libraryData.likedSongsCount > 0
                ? `${libraryData.likedSongsCount} tracks in your personal library`
                : 'Quick access to all your favorite tracks'}
            </p>
          </div>
        </button>
      </section>

      {/* Skeletons while loading personal library */}
      {isLoading && (
        <>
          <TvShelfSkeleton
            title="Your Playlists"
            subtitle="Loading your YouTube Music playlists..."
            count={4}
            width="w-[260px]"
            aspectRatio="wide"
          />
          <TvShelfSkeleton
            title="Listening History"
            subtitle="Loading recently played tracks..."
            count={6}
          />
        </>
      )}

      {/* User's Google Playlists */}
      {!isLoading && libraryData.playlists.length > 0 && (
        <TvShelf
          index={0}
          title="Your Playlists"
          subtitle="Playlists from your YouTube Music account"
        >
          {libraryData.playlists.map((pl) => (
            <TvCard
              key={pl.browseId}
              id={pl.browseId}
              title={pl.title}
              subtitle={pl.subtitle}
              artworkUrl={pl.artworkUrl}
              width="w-[260px]"
              aspectRatio="wide"
              onClick={() => onOpenDetail(pl)}
            />
          ))}
        </TvShelf>
      )}

      {/* User's Saved Albums */}
      {!isLoading && libraryData.albums.length > 0 && (
        <TvShelf
          index={1}
          title="Saved Albums"
          subtitle="Albums saved in your library"
        >
          {libraryData.albums.map((album) => (
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

      {/* User's Subscribed Artists */}
      {!isLoading && libraryData.artists.length > 0 && (
        <TvShelf
          index={2}
          title="Subscribed Artists"
          subtitle="Artists you follow on YouTube Music"
        >
          {libraryData.artists.map((artist) => (
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

      {/* Listening History (Google Account or Local) */}
      {!isLoading && displayHistory.length > 0 ? (
        <TvShelf
          index={3}
          title={isSignedIn && userHistory.length > 0 ? 'Account History' : 'Recently Played'}
          subtitle={
            isSignedIn && userHistory.length > 0
              ? 'Synchronized from your YouTube Music listening history'
              : 'Tracks played on this TV'
          }
        >
          {displayHistory.map((track) => (
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
      ) : !isLoading ? (
        <section className="px-[56px] my-6">
          <div className="p-8 rounded-2xl bg-white/[0.02] border border-white/5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center text-white/40">
              <History size={24} />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">No Listening History Yet</h4>
              <p className="text-xs text-white/50 mt-0.5">
                Start playing songs from Home, Explore, or Search. They will automatically be recorded here.
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </div>
  );
};
