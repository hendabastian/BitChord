import type { PlayableTrack, DetailPayload } from '../tv/pages/TvHomePage';
import type { LyricLine } from '../tv/player/TvLyricsView';

const API_BASE = typeof window !== 'undefined' && window.location.protocol === 'file:' ? 'http://127.0.0.1:8766' : '';

// ---------------------------------------------------------------------------
// Authentication & Google Account Sync
// ---------------------------------------------------------------------------

export interface UserProfile {
  name: string;
  handle?: string;
  avatarUrl?: string;
}

export interface AuthStatusResponse {
  isSignedIn: boolean;
  flowStatus: 'idle' | 'pending' | 'success' | 'error';
  userCode?: string;
  verificationUrl?: string;
  user?: UserProfile | null;
  error?: string;
}

export interface DeviceCodeResponse {
  status: 'pending' | 'success' | 'already_signed_in' | 'error';
  userCode?: string;
  verificationUrl?: string;
  expiresIn?: number;
  error?: string;
}

export async function fetchAuthStatus(): Promise<AuthStatusResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/yt/auth/status`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[musicApi] fetchAuthStatus error:', err);
  }
  return { isSignedIn: false, flowStatus: 'idle', user: null };
}

export async function fetchDeviceCodeAuth(): Promise<DeviceCodeResponse> {
  try {
    const res = await fetch(`${API_BASE}/api/yt/auth/device-code`);
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[musicApi] fetchDeviceCodeAuth error:', err);
  }
  return { status: 'error', error: 'Failed to initiate device authentication' };
}

export async function submitAuthCookie(cookie: string): Promise<{ success: boolean; isSignedIn: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/api/yt/auth/cookie`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cookie }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.warn('[musicApi] submitAuthCookie error:', err);
  }
  return { success: false, isSignedIn: false, error: 'Network failure' };
}

export async function logoutAuthUser(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/api/yt/auth/logout`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      return !!data.success;
    }
  } catch (err) {
    console.warn('[musicApi] logoutAuthUser error:', err);
  }
  return false;
}

// ---------------------------------------------------------------------------
// Personal Library, Liked Songs & History
// ---------------------------------------------------------------------------

export interface UserLibraryResult {
  likedSongsCount: number;
  likedArtworkUrl?: string;
  playlists: DetailPayload[];
  albums: DetailPayload[];
  artists: DetailPayload[];
}

export async function fetchUserLibrary(): Promise<UserLibraryResult> {
  try {
    const res = await fetch(`${API_BASE}/api/yt/library`);
    if (res.ok) {
      const data = await res.json();
      return {
        likedSongsCount: typeof data.likedSongsCount === 'number' ? data.likedSongsCount : 0,
        likedArtworkUrl: data.likedArtworkUrl,
        playlists: Array.isArray(data.playlists) ? data.playlists : [],
        albums: Array.isArray(data.albums) ? data.albums : [],
        artists: Array.isArray(data.artists) ? data.artists : [],
      };
    }
  } catch (err) {
    console.warn('[musicApi] fetchUserLibrary error:', err);
  }

  return {
    likedSongsCount: 0,
    playlists: [],
    albums: [],
    artists: [],
  };
}

export async function fetchUserHistory(): Promise<PlayableTrack[]> {
  try {
    const res = await fetch(`${API_BASE}/api/yt/history`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks)) {
        return data.tracks;
      }
    }
  } catch (err) {
    console.warn('[musicApi] fetchUserHistory error:', err);
  }
  return [];
}

export async function fetchDetailTracks(
  browseId: string,
  type?: string,
): Promise<{
  title: string;
  subtitle: string;
  artworkUrl?: string;
  tracks: PlayableTrack[];
}> {
  try {
    const params = new URLSearchParams({ id: browseId });
    if (type) params.set('type', type);

    const res = await fetch(`${API_BASE}/api/yt/detail?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      return {
        title: data.title || browseId,
        subtitle: data.subtitle || 'Playlist',
        artworkUrl: data.artworkUrl,
        tracks: Array.isArray(data.tracks) ? data.tracks : [],
      };
    }
  } catch (err) {
    console.warn('[musicApi] fetchDetailTracks error:', err);
  }

  return {
    title: browseId,
    subtitle: 'Playlist',
    tracks: [],
  };
}

// ---------------------------------------------------------------------------
// Music Feeds & Recommendations
// ---------------------------------------------------------------------------

/**
 * Fetch Home feed from live YouTube Music backend (Personalized when signed in)
 */
export async function fetchHomeFeed(): Promise<{
  quickPicks: PlayableTrack[];
  mixedForYou: DetailPayload[];
  artists: DetailPayload[];
}> {
  try {
    const res = await fetch(`${API_BASE}/api/yt/home`);
    if (res.ok) {
      const data = await res.json();
      return {
        quickPicks: Array.isArray(data.quickPicks) ? data.quickPicks : [],
        mixedForYou: Array.isArray(data.mixedForYou) ? data.mixedForYou : [],
        artists: Array.isArray(data.artists) ? data.artists : [],
      };
    }
  } catch (e) {
    console.warn('[musicApi] fetchHomeFeed network error:', e);
  }

  return {
    quickPicks: [],
    mixedForYou: [],
    artists: [],
  };
}

/**
 * Fetch YouTube recommendations / Up Next radio queue for a song
 */
export async function fetchRecommendations(videoId: string): Promise<PlayableTrack[]> {
  if (!videoId) return [];
  try {
    const res = await fetch(`${API_BASE}/api/yt/recommendations?videoId=${encodeURIComponent(videoId)}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.recommendations) && data.recommendations.length > 0) {
        return data.recommendations;
      }
    }
  } catch (e) {
    console.warn(`[musicApi] fetchRecommendations failed for ${videoId}:`, e);
  }

  return [];
}

/**
 * Fetch Explore feed (Trending, New Albums & Singles, Music Videos)
 */
export async function fetchExploreFeed(): Promise<{
  trending: PlayableTrack[];
  newReleases: DetailPayload[];
  musicVideos: PlayableTrack[];
}> {
  try {
    const res = await fetch(`${API_BASE}/api/yt/explore`);
    if (res.ok) {
      const data = await res.json();
      return {
        trending: Array.isArray(data.trending) ? data.trending : [],
        newReleases: Array.isArray(data.newReleases) ? data.newReleases : [],
        musicVideos: Array.isArray(data.musicVideos) ? data.musicVideos : [],
      };
    }
  } catch (e) {
    console.warn('[musicApi] fetchExploreFeed network error:', e);
  }

  return {
    trending: [],
    newReleases: [],
    musicVideos: [],
  };
}

/**
 * Live search songs on YouTube Music
 */
export async function searchMusic(query: string): Promise<PlayableTrack[]> {
  if (!query || !query.trim()) return [];
  try {
    const res = await fetch(`${API_BASE}/api/yt/search?q=${encodeURIComponent(query.trim())}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.tracks)) {
        return data.tracks;
      }
    }
  } catch (e) {
    console.warn('[musicApi] search error:', e);
  }

  return [];
}

/**
 * Resolve direct or piped audio stream for playback
 */
export async function resolveStreamUrl(track: PlayableTrack): Promise<{
  streamUrl: string;
  durationSec?: number;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/yt/stream?videoId=${encodeURIComponent(track.videoId)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.streamUrl) {
        const finalUrl =
          window.location.protocol === 'file:' && data.directUrl
            ? data.directUrl
            : `${API_BASE}${data.streamUrl}`;

        return {
          streamUrl: finalUrl,
          durationSec: data.durationSec || track.durationSec,
        };
      }
    }
  } catch (e) {
    console.warn(`[musicApi] Failed to resolve stream for ${track.videoId}:`, e);
  }

  return {
    streamUrl:
      track.streamUrl ||
      'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3',
    durationSec: track.durationSec || 230,
  };
}

/**
 * Fetch real synced lyrics for active track
 */
export async function fetchLyrics(
  artist: string,
  title: string,
  durationSec?: number,
  videoId?: string,
): Promise<{ synced: boolean; lines: LyricLine[] }> {
  try {
    const params = new URLSearchParams({
      artist,
      title,
      duration: durationSec ? Math.round(durationSec).toString() : '0',
    });
    if (videoId) {
      params.set('videoId', videoId);
    }
    const res = await fetch(`${API_BASE}/api/yt/lyrics?${params.toString()}`);
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.lines) && data.lines.length > 0) {
        return data;
      }
    }
  } catch (e) {
    console.warn('[musicApi] fetchLyrics error:', e);
  }

  return { synced: false, lines: [] };
}

/**
 * Manage locally played history in TV storage
 */
const STORAGE_RECENT_KEY = 'bitchord_tv_recent_tracks';

export function getRecentTracks(): PlayableTrack[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRecentTrack(track: PlayableTrack) {
  if (typeof localStorage === 'undefined' || !track || !track.videoId) return;
  try {
    const current = getRecentTracks();
    const filtered = current.filter((t) => t.videoId !== track.videoId);
    const updated = [track, ...filtered].slice(0, 30);
    localStorage.setItem(STORAGE_RECENT_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn('[musicApi] Failed to save recent track:', e);
  }
}
