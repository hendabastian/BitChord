import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TvTopBar, type TvTab } from './tv/components/TvTopBar';
import { TvHomePage, type PlayableTrack, type DetailPayload } from './tv/pages/TvHomePage';
import { TvExplorePage } from './tv/pages/TvExplorePage';
import { TvLibraryPage } from './tv/pages/TvLibraryPage';
import { TvSearchPage } from './tv/pages/TvSearchPage';
import { TvDetailPage } from './tv/pages/TvDetailPage';
import { TvSettingsPage } from './tv/pages/TvSettingsPage';
import { TvNowPlaying } from './tv/player/TvNowPlaying';
import { TvAccountModal } from './tv/auth/TvAccountModal';
import { TvSetupModal } from './tv/onboarding/TvSetupModal';
import { AvplayAudio } from './platform/avplay';
import { pushBackListener } from './platform/keys';
import { syncRemoteStatus, onRemoteAction } from './platform/bridge';
import { resolveStreamUrl, fetchRecommendations, saveRecentTrack, fetchAuthStatus, type UserProfile } from './api/musicApi';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TvTab>('home');
  const [activeDetail, setActiveDetail] = useState<DetailPayload | null>(null);
  const [isNowPlayingOpen, setIsNowPlayingOpen] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isSetupOpen, setIsSetupOpen] = useState(() => {
    return typeof localStorage !== 'undefined' ? localStorage.getItem('bitchord_tv_setup') !== '1' : false;
  });

  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);

  useEffect(() => {
    fetchAuthStatus().then((status) => {
      if (status.isSignedIn) {
        setIsSignedIn(true);
        setUserProfile(status.user || null);
      }
    });
  }, []);

  // Playback State
  const [currentTrack, setCurrentTrack] = useState<PlayableTrack | null>(null);
  const [queue, setQueue] = useState<PlayableTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const playerRef = useRef<AvplayAudio | null>(null);
  const handleNextRef = useRef<() => void>(() => {});
  const handlePreviousRef = useRef<() => void>(() => {});

  // Play a track and optionally set a queue or fetch YouTube recommendations
  const playTrack = useCallback(
    async (track: PlayableTrack, newQueue?: PlayableTrack[], openNowPlaying = true) => {
      setCurrentTrack(track);
      saveRecentTrack(track);

      if (newQueue && newQueue.length > 0) {
        setQueue(newQueue);
        const idx = newQueue.findIndex((t) => t.videoId === track.videoId);
        setCurrentIndex(idx >= 0 ? idx : 0);
      } else {
        // Single track clicked: set as current, and fetch YouTube recommendations for infinite autoplay queue
        setQueue([track]);
        setCurrentIndex(0);
        fetchRecommendations(track.videoId)
          .then((recs) => {
            if (recs && recs.length > 0) {
              setQueue((prev) => {
                if (prev[0]?.videoId === track.videoId) {
                  return [track, ...recs];
                }
                return prev;
              });
            }
          })
          .catch((e) => console.warn('[App] fetchRecommendations failed:', e));
      }

      if (openNowPlaying) {
        setIsNowPlayingOpen(true);
      }

      const player = playerRef.current;
      if (player) {
        try {
          const { streamUrl, durationSec } = await resolveStreamUrl(track);
          player.setSource(streamUrl, 0, durationSec || track.durationSec || 230);
          player.play().catch((err) => {
            console.warn('[Player] User gesture required before autoplay:', err);
          });
        } catch (err) {
          console.error('[App] Playback error:', err);
        }
      }
    },
    [],
  );

  const handleNext = useCallback(async () => {
    if (queue.length === 0) return;

    const nextIdx = currentIndex + 1;
    if (nextIdx < queue.length) {
      // If nearing end of queue (3 tracks left), fetch more recommendations and append
      if (nextIdx >= queue.length - 3) {
        const last = queue[queue.length - 1];
        if (last) {
          fetchRecommendations(last.videoId).then((moreRecs) => {
            if (moreRecs.length > 0) {
              setQueue((prev) => {
                const existing = new Set(prev.map((t) => t.videoId));
                const fresh = moreRecs.filter((t) => !existing.has(t.videoId));
                return [...prev, ...fresh];
              });
            }
          });
        }
      }

      setCurrentIndex(nextIdx);
      const nextTrack = queue[nextIdx];
      if (nextTrack) {
        playTrack(nextTrack, queue, false);
      }
    } else if (currentTrack) {
      // At the end of queue: fetch fresh recommendations for currentTrack to keep playing
      try {
        const moreRecs = await fetchRecommendations(currentTrack.videoId);
        if (moreRecs && moreRecs.length > 0) {
          const nextTrack = moreRecs[0];
          if (nextTrack) {
            const updatedQueue = [...queue, ...moreRecs];
            setQueue(updatedQueue);
            setCurrentIndex(nextIdx);
            playTrack(nextTrack, updatedQueue, false);
          }
        }
      } catch (e) {
        console.warn('[App] Autoplay recommendation fetch failed:', e);
      }
    }
  }, [queue, currentIndex, currentTrack, playTrack]);

  const handlePrevious = useCallback(() => {
    if (queue.length > 0 && currentIndex > 0) {
      const prevIdx = currentIndex - 1;
      setCurrentIndex(prevIdx);
      const prevTrack = queue[prevIdx];
      if (prevTrack) playTrack(prevTrack, queue, false);
    }
  }, [queue, currentIndex, playTrack]);

  // Keep refs up-to-date for hardware player event callbacks
  useEffect(() => {
    handleNextRef.current = handleNext;
  }, [handleNext]);

  useEffect(() => {
    handlePreviousRef.current = handlePrevious;
  }, [handlePrevious]);

  // Initialize Hardware Audio Engine
  useEffect(() => {
    const player = new AvplayAudio();
    playerRef.current = player;

    player.addEventListener('play', () => setIsPlaying(true));
    player.addEventListener('playing', () => setIsPlaying(true));
    player.addEventListener('pause', () => setIsPlaying(false));
    player.addEventListener('timeupdate', () => setCurrentTime(player.currentTime));
    player.addEventListener('durationchange', () => setDuration(player.duration || 0));
    player.addEventListener('ended', () => {
      handleNextRef.current();
    });

    // Connect remote actions from phone web remote
    const removeRemote = onRemoteAction((action, payload) => {
      switch (action) {
        case 'play':
        case 'play_pause':
          if (player.paused) player.play().catch(() => {});
          else player.pause();
          break;
        case 'pause':
          player.pause();
          break;
        case 'next':
          handleNextRef.current();
          break;
        case 'prev':
        case 'previous':
          handlePreviousRef.current();
          break;
        case 'cookie_received':
          if (payload?.cookie) {
            setIsSignedIn(true);
          }
          break;
      }
    });

    return () => {
      removeRemote();
      player.release();
    };
  }, []);

  // Sync state to phone remote
  useEffect(() => {
    if (currentTrack) {
      syncRemoteStatus({
        isPlaying,
        title: currentTrack.title,
        artist: currentTrack.artist,
        artworkUrl: currentTrack.artworkUrl,
        currentPositionMs: Math.round(currentTime * 1000),
        durationMs: Math.round(duration * 1000),
      });
    }
  }, [currentTrack, isPlaying, currentTime, duration]);

  // Back Button Navigation
  useEffect(() => {
    const removeBack = pushBackListener(() => {
      if (isAccountOpen) {
        setIsAccountOpen(false);
        return true;
      }
      if (isNowPlayingOpen) {
        setIsNowPlayingOpen(false);
        return true;
      }
      if (activeDetail) {
        setActiveDetail(null);
        return true;
      }
      if (activeTab !== 'home') {
        setActiveTab('home');
        return true;
      }
      return false; // Exit app
    });
    return removeBack;
  }, [isAccountOpen, isNowPlayingOpen, activeDetail, activeTab]);

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-[#08080B] text-white">
      {/* Ambient Canvas Tint */}
      <div
        className="tv-canvas-ambient"
        style={{
          ['--ambient-color' as string]: currentTrack?.artworkUrl
            ? 'rgba(250, 45, 72, 0.35)'
            : 'rgba(80, 80, 100, 0.2)',
        }}
      />

      {/* Top Bar */}
      <TvTopBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveDetail(null);
          setActiveTab(tab);
        }}
        nowPlaying={
          currentTrack
            ? {
                title: currentTrack.title,
                artist: currentTrack.artist,
                artworkUrl: currentTrack.artworkUrl,
                isPlaying,
              }
            : null
        }
        userAvatar={userProfile?.avatarUrl}
        onOpenNowPlaying={() => setIsNowPlayingOpen(true)}
        onOpenAccount={() => setIsAccountOpen(true)}
      />

      {/* Main Pages */}
      <main data-tv-zone="content" className="flex-1 overflow-hidden relative">
        {activeDetail ? (
          <TvDetailPage
            detail={activeDetail}
            onBack={() => setActiveDetail(null)}
            onPlayTrack={(track) => playTrack(track)}
            onPlayAll={(tracks, shuffle) => {
              const list = shuffle ? [...tracks].sort(() => Math.random() - 0.5) : tracks;
              const first = list[0];
              if (first) playTrack(first, list);
            }}
          />
        ) : activeTab === 'home' ? (
          <TvHomePage
            key={isSignedIn ? 'home_auth' : 'home_guest'}
            onPlayTrack={(track) => playTrack(track)}
            onOpenDetail={(detail) => setActiveDetail(detail)}
          />
        ) : activeTab === 'explore' ? (
          <TvExplorePage
            onPlayTrack={(track) => playTrack(track)}
            onOpenDetail={(detail) => setActiveDetail(detail)}
          />
        ) : activeTab === 'library' ? (
          <TvLibraryPage
            isSignedIn={isSignedIn}
            onOpenSignIn={() => setIsAccountOpen(true)}
            onPlayTrack={(track) => playTrack(track)}
            onOpenDetail={(detail) => setActiveDetail(detail)}
          />
        ) : activeTab === 'search' ? (
          <TvSearchPage
            onPlayTrack={(track) => playTrack(track)}
            onOpenDetail={(detail) => setActiveDetail(detail)}
          />
        ) : (
          <TvSettingsPage
            isSignedIn={isSignedIn}
            onOpenSignIn={() => setIsAccountOpen(true)}
            onOpenPinModal={() => setIsAccountOpen(true)}
            onRunSetupAgain={() => setIsSetupOpen(true)}
          />
        )}
      </main>

      {/* Fullscreen Now Playing Overlay */}
      {isNowPlayingOpen && currentTrack && (
        <TvNowPlaying
          track={currentTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          queue={queue}
          currentIndex={currentIndex}
          onPlayPause={() => {
            const player = playerRef.current;
            if (!player) return;
            if (player.paused) player.play().catch(() => {});
            else player.pause();
          }}
          onNext={handleNext}
          onPrevious={handlePrevious}
          onSeek={(time) => {
            if (playerRef.current) playerRef.current.currentTime = time;
          }}
          onSelectQueueTrack={(idx) => {
            const t = queue[idx];
            if (t) playTrack(t, queue, false);
          }}
          onBack={() => {
            setIsNowPlayingOpen(false);
            setTimeout(() => {
              const activeTabEl = document.querySelector<HTMLElement>('[data-active-tab="true"]');
              if (activeTabEl) applyFocus(activeTabEl);
            }, 50);
          }}
        />
      )}

      {/* Account & Phone QR Sign-In Modal */}
      <TvAccountModal
        isOpen={isAccountOpen}
        onClose={() => setIsAccountOpen(false)}
        isSignedIn={isSignedIn}
        userProfile={userProfile}
        onSignInSuccess={(user) => {
          setIsSignedIn(true);
          setUserProfile(user || null);
        }}
        onSignOut={() => {
          setIsSignedIn(false);
          setUserProfile(null);
        }}
      />

      {/* First-Time Onboarding Modal */}
      <TvSetupModal
        isOpen={isSetupOpen}
        onComplete={() => {
          localStorage.setItem('bitchord_tv_setup', '1');
          setIsSetupOpen(false);
        }}
      />
    </div>
  );
};
