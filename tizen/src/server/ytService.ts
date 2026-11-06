import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { Readable } from 'node:stream';

// ---------------------------------------------------------------------------
// Auth Storage & Innertube Session Management
// ---------------------------------------------------------------------------

function getAuthDir(): string {
  const tizenAuth = path.resolve(process.cwd(), 'tizen/.bitchord-auth');
  const localAuth = path.resolve(process.cwd(), '.bitchord-auth');

  if (fs.existsSync(path.dirname(tizenAuth))) {
    if (!fs.existsSync(tizenAuth)) {
      try {
        fs.mkdirSync(tizenAuth, { recursive: true });
      } catch {
        // ignore
      }
    }
    return tizenAuth;
  }

  if (!fs.existsSync(localAuth)) {
    try {
      fs.mkdirSync(localAuth, { recursive: true });
    } catch {
      // ignore
    }
  }
  return localAuth;
}

const COOKIE_FILE = path.join(getAuthDir(), 'cookie.txt');

function loadSavedCookie(): string | null {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      const data = fs.readFileSync(COOKIE_FILE, 'utf-8').trim();
      return data || null;
    }
  } catch (err) {
    console.warn('[ytService] Failed to read cookie file:', err);
  }
  return null;
}

export function saveCookie(cookieStr: string): void {
  try {
    const authDir = getAuthDir();
    if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
    fs.writeFileSync(COOKIE_FILE, cookieStr.trim(), 'utf-8');
  } catch (err) {
    console.warn('[ytService] Failed to save cookie file:', err);
  }
}

export function clearAuthStorage(): void {
  try {
    const authDir = getAuthDir();
    if (fs.existsSync(authDir)) {
      fs.rmSync(authDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.warn('[ytService] Failed to clear auth storage:', err);
  }
}

let ytPromise: Promise<any> | null = null;

let deviceAuthState: {
  status: 'idle' | 'pending' | 'success' | 'error';
  userCode?: string;
  deviceCode?: string;
  verificationUrl?: string;
  expiresAt?: number;
  interval?: number;
  error?: string;
} = { status: 'idle' };

export async function getYt(forceNew = false) {
  if (forceNew || !ytPromise) {
    ytPromise = (async () => {
      const { Innertube, UniversalCache } = await import('youtubei.js');
      const authDir = getAuthDir();
      const cache = new UniversalCache(true, authDir);
      const savedCookie = loadSavedCookie();

      // Custom fetch handler:
      // Google InnerTube returns 400 INVALID_ARGUMENT if a TV Bearer token is sent to
      // WEB_REMIX (client 67, YouTube Music) or VISIONOS (client 101, audio stream).
      // Stripping Authorization header for clients 67 and 101 ensures music catalog,
      // search, explore, and direct audio resolution ALWAYS work without 400 errors!
      const customFetch = async (input: any, init: any) => {
        const headers = init?.headers || (input?.headers ? input.headers : {});
        const clientName = headers.get
          ? headers.get('x-youtube-client-name')
          : headers['x-youtube-client-name'];

        if (clientName === '67' || clientName === '101') {
          if (headers.delete) {
            headers.delete('authorization');
          } else if (headers['authorization']) {
            delete headers['authorization'];
          }
        }
        return fetch(input, init);
      };

      let yt: any;
      if (savedCookie) {
        console.log('[ytService] Initializing Innertube with saved cookie...');
        yt = await Innertube.create({ cookie: savedCookie, cache, fetch: customFetch });
      } else {
        yt = await Innertube.create({ cache, fetch: customFetch });
      }

      // Persist credentials whenever tokens are updated
      yt.session.on('auth', async () => {
        console.log('[ytService] Innertube authenticated via OAuth2');
        yt.session.logged_in = true;
        try {
          await yt.session.oauth.cacheCredentials();
        } catch (e) {
          console.warn('[ytService] cacheCredentials failed:', e);
        }
      });

      yt.session.on('update-credentials', async () => {
        try {
          await yt.session.oauth.cacheCredentials();
        } catch (e) {
          console.warn('[ytService] update-credentials failed:', e);
        }
      });

      // Restore session from cache if not already logged in with cookie
      if (!savedCookie) {
        try {
          const cachedTokens = await yt.session.cache?.get('youtubei_oauth_credentials');
          if (cachedTokens) {
            await yt.session.signIn();
            console.log('[ytService] Restored and signed into OAuth session from cache');
          }
        } catch (err) {
          console.warn('[ytService] Error reading cached OAuth tokens:', err);
        }
      }

      return yt;
    })();
  }
  return ytPromise;
}

// ---------------------------------------------------------------------------
// Account Profile & Authentication Flows
// ---------------------------------------------------------------------------

export async function getAccountProfile(): Promise<{
  name: string;
  handle?: string;
  avatarUrl?: string;
} | null> {
  try {
    const yt = await getYt();
    if (!yt.session.logged_in) return null;

    const info = await yt.account.getInfo();
    // info.contents is an AccountItemSection; its contents[0] is the AccountItem
    const item =
      info.contents?.contents?.[0] ||
      (Array.isArray(info.contents) ? info.contents[0] : info.contents);

    const name =
      item?.account_name?.text ||
      item?.account_name?.toString() ||
      'Google Account';

    const handle =
      item?.channel_handle?.text ||
      item?.account_byline?.text ||
      '';

    const avatarUrl =
      item?.account_photo?.[0]?.url ||
      extractThumbnail(item?.account_photo) ||
      '';

    return { name, handle, avatarUrl };
  } catch (err) {
    console.warn('[ytService] getAccountProfile error:', err);
    return { name: 'Signed In User', avatarUrl: '' };
  }
}

export async function startDeviceCodeAuth(): Promise<{
  status: 'pending' | 'success' | 'already_signed_in' | 'error';
  userCode?: string;
  verificationUrl?: string;
  expiresIn?: number;
  error?: string;
}> {
  try {
    const yt = await getYt();
    if (yt.session.logged_in) {
      return { status: 'already_signed_in' };
    }

    // Reuse existing valid pending code if still within validity window
    if (
      deviceAuthState.status === 'pending' &&
      deviceAuthState.expiresAt &&
      Date.now() < deviceAuthState.expiresAt - 60000 &&
      deviceAuthState.userCode
    ) {
      return {
        status: 'pending',
        userCode: deviceAuthState.userCode,
        verificationUrl: deviceAuthState.verificationUrl || 'https://www.google.com/device',
        expiresIn: Math.round((deviceAuthState.expiresAt - Date.now()) / 1000),
      };
    }

    if (!yt.session.oauth.client_id) {
      yt.session.oauth.client_id = await yt.session.oauth.getClientID();
    }

    const codeData = await yt.session.oauth.getDeviceAndUserCode();

    deviceAuthState = {
      status: 'pending',
      userCode: codeData.user_code,
      deviceCode: codeData.device_code,
      verificationUrl: codeData.verification_url || 'https://www.google.com/device',
      expiresAt: Date.now() + codeData.expires_in * 1000,
      interval: codeData.interval || 5,
    };

    // Begin background polling
    yt.session.oauth.pollForAccessToken(codeData);

    yt.session.once('auth', async () => {
      yt.session.logged_in = true;
      deviceAuthState.status = 'success';
      try {
        await yt.session.oauth.cacheCredentials();
      } catch {
        // ignore
      }
      cache.clear();
      console.log('[ytService] Device Code auth succeeded! User logged in.');
    });

    yt.session.once('auth-error', (err: any) => {
      deviceAuthState.status = 'error';
      deviceAuthState.error = err?.message || 'Device authentication failed';
      console.warn('[ytService] Device Code auth failed:', err);
    });

    return {
      status: 'pending',
      userCode: codeData.user_code,
      verificationUrl: codeData.verification_url || 'https://www.google.com/device',
      expiresIn: codeData.expires_in,
    };
  } catch (error: any) {
    console.error('[ytService] startDeviceCodeAuth error:', error);
    deviceAuthState = { status: 'error', error: error?.message || 'Failed to start device code flow' };
    return {
      status: 'error',
      error: error?.message || 'Failed to start device code flow',
    };
  }
}

export async function getAuthStatus(): Promise<{
  isSignedIn: boolean;
  flowStatus: 'idle' | 'pending' | 'success' | 'error';
  userCode?: string;
  verificationUrl?: string;
  user?: { name: string; handle?: string; avatarUrl?: string } | null;
  error?: string;
}> {
  try {
    const yt = await getYt();
    const isSignedIn = !!yt.session.logged_in;

    let user = null;
    if (isSignedIn) {
      user = await getAccountProfile();
    }

    return {
      isSignedIn,
      flowStatus: deviceAuthState.status,
      userCode: deviceAuthState.userCode,
      verificationUrl: deviceAuthState.verificationUrl,
      user,
      error: deviceAuthState.error,
    };
  } catch (err: any) {
    return {
      isSignedIn: false,
      flowStatus: 'error',
      error: err?.message,
    };
  }
}

export async function submitCookie(cookieStr: string): Promise<{ success: boolean; isSignedIn: boolean; error?: string }> {
  try {
    if (!cookieStr || !cookieStr.trim()) {
      return { success: false, isSignedIn: false, error: 'Empty cookie provided' };
    }
    saveCookie(cookieStr.trim());
    cache.clear();
    const yt = await getYt(true);
    return {
      success: true,
      isSignedIn: !!yt.session.logged_in,
    };
  } catch (err: any) {
    console.error('[ytService] submitCookie error:', err);
    return { success: false, isSignedIn: false, error: err?.message };
  }
}

export async function logoutUser(): Promise<{ success: boolean; isSignedIn: boolean }> {
  try {
    clearAuthStorage();
    const yt = await getYt();
    if (yt.session.logged_in) {
      await yt.session.signOut().catch(() => {});
    }
  } catch {
    // ignore
  }

  ytPromise = null;
  deviceAuthState = { status: 'idle' };
  cache.clear();
  return { success: true, isSignedIn: false };
}

// ---------------------------------------------------------------------------
// Data Models & Artwork Processing
// ---------------------------------------------------------------------------

export interface YtTrack {
  videoId: string;
  title: string;
  artist: string;
  artworkUrl?: string | null;
  durationSec?: number;
  album?: string;
}

export interface YtShelf {
  title: string;
  subtitle?: string;
  items: YtTrack[];
}

export interface YtDetailItem {
  browseId: string;
  title: string;
  subtitle: string;
  artworkUrl?: string | null;
  type: 'album' | 'playlist' | 'artist';
}

const RESIZABLE = /googleusercontent\.com|ggpht\.com/;

export function cleanArtwork(url?: string | null, fallbackVideoId?: string): string {
  if (!url) {
    return fallbackVideoId ? `https://i.ytimg.com/vi/${fallbackVideoId}/hqdefault.jpg` : '';
  }
  if (!RESIZABLE.test(url)) return url;
  // Snap to YouTube Music standard 544px square, preventing CDN 429 burst rate limits
  return `${url.replace(/=[^/=]*$/, '')}=w544-h544-l90-rj`;
}

export function extractThumbnail(node: any, fallbackVideoId?: string): string {
  if (!node) {
    return fallbackVideoId ? `https://i.ytimg.com/vi/${fallbackVideoId}/hqdefault.jpg` : '';
  }

  // 1. Direct url string
  if (typeof node.thumbnail === 'string') return cleanArtwork(node.thumbnail, fallbackVideoId);
  if (typeof node.thumbnails === 'string') return cleanArtwork(node.thumbnails, fallbackVideoId);

  // 2. Array of thumbnails
  const list = Array.isArray(node.thumbnail)
    ? node.thumbnail
    : Array.isArray(node.thumbnails)
    ? node.thumbnails
    : Array.isArray(node.thumbnail?.contents)
    ? node.thumbnail.contents
    : Array.isArray(node.thumbnails?.contents)
    ? node.thumbnails.contents
    : null;

  if (list && list.length > 0) {
    const sorted = [...list].sort((a: any, b: any) => (b.width || 0) - (a.width || 0));
    const url = sorted[0]?.url;
    if (url) return cleanArtwork(url, fallbackVideoId);
  }

  // 3. Single object with url
  if (node.thumbnail?.url) return cleanArtwork(node.thumbnail.url, fallbackVideoId);
  if (node.thumbnails?.url) return cleanArtwork(node.thumbnails.url, fallbackVideoId);

  // 4. Fallback to videoId thumbnail if available
  if (fallbackVideoId) {
    return `https://i.ytimg.com/vi/${fallbackVideoId}/hqdefault.jpg`;
  }

  return '';
}

export function parseDurationSec(durStr?: string, fallback = 210): number {
  if (!durStr || typeof durStr !== 'string' || !durStr.includes(':')) return fallback;
  const parts = durStr.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 3 && parts.every((n) => !isNaN(n))) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2 && parts.every((n) => !isNaN(n))) {
    return parts[0] * 60 + parts[1];
  }
  return fallback;
}

// In-memory cache
const cache = new Map<string, { time: number; data: any }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

function getCached<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
}

function setCache(key: string, data: any) {
  if (cache.size > 200) cache.clear();
  cache.set(key, { time: Date.now(), data });
}

// ---------------------------------------------------------------------------
// Music Feeds (Personalized & Public)
// ---------------------------------------------------------------------------

/**
 * Fetch Home Feed from YouTube Music (Personalized with User's Playlists, Artists, and Radio when signed in)
 */
export async function getHomeFeed(): Promise<{
  quickPicks: YtTrack[];
  mixedForYou: YtDetailItem[];
  artists: YtDetailItem[];
}> {
  const yt = await getYt();
  const isLoggedIn = !!yt.session.logged_in;
  const cacheKey = `home_feed_${isLoggedIn ? 'user_v2' : 'guest'}`;

  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const quickPicks: YtTrack[] = [];
    const mixedForYou: YtDetailItem[] = [];
    const artists: YtDetailItem[] = [];

    // When signed in: build truly personalized feed from user's authentic music playlists & taste
    if (isLoggedIn) {
      try {
        const plRes = await yt.actions.execute('/browse', {
          browseId: 'FEplaylist_aggregation',
          client: 'TV',
        });
        const plItems =
          plRes.data?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.gridRenderer?.items || [];

        const ignoredKeywords = ['vlog', 'analisa', 'neural', 'watch later', 'watch_later'];
        const userMusicPlaylists: Array<{ browseId: string; title: string; subtitle: string; artworkUrl?: string }> = [];

        for (const item of plItems) {
          const tile = item?.tileRenderer;
          if (!tile) continue;
          const name =
            tile.metadata?.tileMetadataRenderer?.title?.simpleText ||
            tile.metadata?.tileMetadataRenderer?.title?.runs?.[0]?.text ||
            '';
          const bId = tile.onSelectCommand?.browseEndpoint?.browseId || tile.contentId;
          if (!bId || bId === 'VLWL') continue;

          const countText =
            tile.header?.tileHeaderRenderer?.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.runs
              ?.map((r: any) => r.text)
              .join('') || '';

          // Filter out empty playlists ("No videos", "0") and non-music video channels/topics
          if (countText.toLowerCase().includes('no video') || countText.startsWith('0')) continue;
          const lowerName = name.toLowerCase();
          if (ignoredKeywords.some((kw) => lowerName.includes(kw))) continue;

          const art =
            tile.header?.tileHeaderRenderer?.thumbnail?.thumbnails?.[0]?.url ||
            cleanArtwork(tile.thumbnail?.url, bId);

          const isLiked = bId === 'VLLL' || bId === 'LL' || lowerName.includes('liked');
          const sub = isLiked ? `Your Liked Songs • ${countText}` : `Your Playlist • ${countText}`;

          userMusicPlaylists.push({
            browseId: bId,
            title: name || 'Playlist',
            subtitle: sub,
            artworkUrl: art,
          });
        }

        // 1. Add user's real music playlists to Mixed for You
        for (const pl of userMusicPlaylists) {
          mixedForYou.push({
            browseId: pl.browseId,
            title: pl.title,
            subtitle: pl.subtitle,
            artworkUrl: pl.artworkUrl,
            type: 'playlist',
          });
        }

        // 2. Extract top tracks and artists from user's primary playlists
        const primaryPlaylists = userMusicPlaylists.filter(
          (p) => p.browseId.startsWith('VLPL') || p.browseId.startsWith('PL')
        );

        const userFavoriteTracks: YtTrack[] = [];
        const artistNamesSet = new Set<string>();

        // Fetch tracks from up to 2 primary playlists
        await Promise.all(
          primaryPlaylists.slice(0, 2).map(async (pl) => {
            try {
              const res = await yt.music.getPlaylist(pl.browseId);
              for (const item of (res.items || []).slice(0, 15)) {
                const vid = item.id;
                if (!vid) continue;
                const trackTitle = item.title?.text || item.title?.toString() || 'Track';
                const art = extractThumbnail(item, vid);
                const artName =
                  item.artists?.map((a: any) => a.name).join(', ') ||
                  item.authors?.map((a: any) => a.name).join(', ') ||
                  '';
                const firstArtist = item.artists?.[0]?.name || item.authors?.[0]?.name;
                if (firstArtist && firstArtist !== 'Various Artists') {
                  artistNamesSet.add(firstArtist);
                }
                userFavoriteTracks.push({
                  videoId: vid,
                  title: trackTitle,
                  artist: artName || 'Artist',
                  artworkUrl: art,
                  durationSec: item.duration?.seconds || 210,
                  album: item.album?.name,
                });
              }
            } catch (err) {
              console.warn(`[ytService] Could not fetch playlist ${pl.browseId}:`, err);
            }
          })
        );

        // 3. Generate YouTube Music algorithmic recommendations using the user's #1 seed track
        let radioRecs: YtTrack[] = [];
        if (userFavoriteTracks.length > 0) {
          try {
            const seed = userFavoriteTracks[0].videoId;
            radioRecs = await getRecommendations(seed);
          } catch (e) {
            console.warn('[ytService] Failed to seed radio recommendations:', e);
          }
        }

        // 4. Interleave user tracks with YouTube Music recommendations for Quick Picks
        const combinedTracks: YtTrack[] = [];
        const seenVideos = new Set<string>();

        for (let i = 0; i < Math.max(userFavoriteTracks.length, radioRecs.length); i++) {
          if (i < userFavoriteTracks.length) {
            const t = userFavoriteTracks[i];
            if (!seenVideos.has(t.videoId)) {
              seenVideos.add(t.videoId);
              combinedTracks.push(t);
            }
          }
          if (i < radioRecs.length) {
            const r = radioRecs[i];
            if (!seenVideos.has(r.videoId)) {
              seenVideos.add(r.videoId);
              combinedTracks.push(r);
            }
          }
          if (combinedTracks.length >= 24) break;
        }

        quickPicks.push(...combinedTracks);

        // 5. Build Featured Artists from user's favorite artists
        const topArtists = Array.from(artistNamesSet).slice(0, 8);
        const resolvedArtists = await Promise.all(
          topArtists.map(async (artName) => {
            try {
              const sRes = await yt.music.search(artName, { type: 'artist' });
              const item = sRes.artists?.contents?.[0];
              const artPhoto =
                item?.thumbnail?.contents?.[0]?.url ||
                item?.thumbnail?.[0]?.url ||
                extractThumbnail(item);
              return {
                browseId: item?.id || `UC_${artName}`,
                title: item?.name || artName,
                subtitle: 'Artist',
                artworkUrl: cleanArtwork(artPhoto),
                type: 'artist' as const,
              };
            } catch {
              return {
                browseId: `UC_${artName}`,
                title: artName,
                subtitle: 'Artist',
                artworkUrl: '',
                type: 'artist' as const,
              };
            }
          })
        );

        for (const a of resolvedArtists) {
          if (a && a.artworkUrl) artists.push(a);
        }

        // 6. Add personalized Radio Mixes for top user tracks/artists to Mixed for You
        if (userFavoriteTracks.length > 0) {
          const seed1 = userFavoriteTracks[0];
          mixedForYou.push({
            browseId: `RDAMVM${seed1.videoId}`,
            title: `${seed1.artist} Radio`,
            subtitle: 'Endless station inspired by this artist',
            artworkUrl: seed1.artworkUrl,
            type: 'playlist',
          });

          if (userFavoriteTracks.length > 1) {
            const seed2 = userFavoriteTracks[1];
            mixedForYou.push({
              browseId: `RDAMVM${seed2.videoId}`,
              title: `${seed2.artist} Radio`,
              subtitle: 'Endless station inspired by this artist',
              artworkUrl: seed2.artworkUrl,
              type: 'playlist',
            });
          }
        }
      } catch (e) {
        console.warn('[ytService] Personalized feed generation error:', e);
      }
    }

    // Fallback to public YouTube Music sections if guest or personalized feed is empty
    if (quickPicks.length === 0 || mixedForYou.length === 0) {
      const home = await yt.music.getHomeFeed();
      const sections = home.sections || [];

      for (const section of sections) {
        const title = (section.header?.title?.text || section.title?.text || '').toLowerCase();
        const contents = section.contents || [];

        for (const item of contents) {
          const id = item.id || item.video_id || item.endpoint?.payload?.browseId;
          if (!id) continue;

          const isBrowseContainer =
            id.startsWith('VL') ||
            id.startsWith('PL') ||
            id.startsWith('RD') ||
            id.startsWith('MPRE') ||
            id.startsWith('UC') ||
            title.includes('mix') ||
            title.includes('playlist') ||
            title.includes('album') ||
            title.includes('library');

          if (isBrowseContainer) {
            const name = item.title?.text || item.title?.toString() || 'Playlist';
            const sub =
              item.subtitle?.text ||
              item.subtitle?.toString() ||
              item.author?.name ||
              'YouTube Music';
            const art = extractThumbnail(item, id);

            if (id.startsWith('UC') || title.includes('artist')) {
              if (artists.length < 12) {
                artists.push({
                  browseId: id,
                  title: name,
                  subtitle: 'Artist',
                  artworkUrl: art,
                  type: 'artist',
                });
              }
            } else if (mixedForYou.length < 16) {
              mixedForYou.push({
                browseId: id,
                title: name,
                subtitle: sub,
                artworkUrl: art,
                type: id.startsWith('MPRE') ? 'album' : 'playlist',
              });
            }
          } else if (quickPicks.length < 24) {
            const trackTitle =
              typeof item.title === 'string'
                ? item.title
                : item.title?.text || item.title?.toString() || 'Unknown Track';

            const artistName =
              item.artists?.map((a: any) => a.name).join(', ') ||
              item.authors?.map((a: any) => a.name).join(', ') ||
              item.author?.name ||
              'Various Artists';
            const art = extractThumbnail(item, id);
            const dur = item.duration?.seconds || (typeof item.duration === 'number' ? item.duration : 210);

            quickPicks.push({
              videoId: id,
              title: trackTitle,
              artist: artistName,
              artworkUrl: art,
              durationSec: dur,
            });
          }
        }
      }
    }

    // Final safety fallback
    if (mixedForYou.length === 0) {
      try {
        const exp = await getExploreFeed();
        if (exp.newReleases.length > 0) {
          mixedForYou.push(...exp.newReleases);
        }
      } catch {
        // ignore
      }
    }

    const finalQuickPicks = quickPicks.slice(0, 24);
    const finalMixed = mixedForYou.slice(0, 16);
    const finalArtists = artists.slice(0, 12);

    const result = {
      quickPicks: finalQuickPicks,
      mixedForYou: finalMixed,
      artists: finalArtists,
    };

    setCache(cacheKey, result);
    return result;
  } catch (error) {
    console.warn('[ytService] getHomeFeed error:', error);
    return {
      quickPicks: [],
      mixedForYou: [],
      artists: [],
    };
  }
}

/**
 * Fetch YouTube Music Recommendations (Up Next Radio) for a video
 */
export async function getRecommendations(videoId: string): Promise<YtTrack[]> {
  if (!videoId) return [];
  const cacheKey = `rec_${videoId}`;
  const cached = getCached<YtTrack[]>(cacheKey);
  if (cached) return cached;

  try {
    const yt = await getYt();
    const upNext = await yt.music.getUpNext(videoId, true);
    const contents = upNext.contents || [];
    const tracks: YtTrack[] = [];

    for (const item of contents) {
      const vid = item.id || item.video_id;
      if (!vid) continue;
      // Skip the seed song itself if it matches videoId and we want recommendations
      if (vid === videoId && tracks.length === 0) continue;

      const title =
        typeof item.title === 'string'
          ? item.title
          : item.title?.text || item.title?.toString() || 'Unknown Track';

      const artist =
        item.artists?.map((a: any) => a.name).join(', ') ||
        item.authors?.map((a: any) => a.name).join(', ') ||
        item.author?.name ||
        'Various Artists';
      const art = extractThumbnail(item, vid);
      const dur =
        item.duration?.seconds ||
        (typeof item.duration === 'number' ? item.duration : 210);

      tracks.push({
        videoId: vid,
        title,
        artist,
        artworkUrl: art,
        durationSec: dur,
        album: item.album?.name,
      });
    }

    setCache(cacheKey, tracks);
    return tracks;
  } catch (err) {
    console.warn(`[ytService] getRecommendations failed for ${videoId}:`, err);
    return [];
  }
}

/**
 * Fetch Explore Feed from YouTube Music (Trending, New Releases, Music Videos)
 */
export async function getExploreFeed(): Promise<{
  trending: YtTrack[];
  newReleases: YtDetailItem[];
  musicVideos: YtTrack[];
}> {
  const cacheKey = 'explore_feed';
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const yt = await getYt();
    const explore = await yt.music.getExplore();
    const sections = explore.sections || [];

    const trending: YtTrack[] = [];
    const newReleases: YtDetailItem[] = [];
    const musicVideos: YtTrack[] = [];

    for (const section of sections) {
      const title = (section.header?.title?.text || section.title?.text || '').toLowerCase();
      const contents = section.contents || [];

      if (title.includes('trending')) {
        for (const item of contents) {
          const vid = item.id || item.video_id;
          if (!vid) continue;
          const trackTitle =
            typeof item.title === 'string'
              ? item.title
              : item.title?.text || item.title?.toString() || 'Trending Track';

          const artistName =
            item.artists?.map((a: any) => a.name).join(', ') ||
            item.authors?.map((a: any) => a.name).join(', ') ||
            item.author?.name ||
            'Trending Artist';
          const art = extractThumbnail(item, vid);
          const dur = item.duration?.seconds || (typeof item.duration === 'number' ? item.duration : 210);

          trending.push({
            videoId: vid,
            title: trackTitle,
            artist: artistName,
            artworkUrl: art,
            durationSec: dur,
          });
        }
      } else if (title.includes('new album') || title.includes('singles') || title.includes('release')) {
        for (const item of contents) {
          const browseId = item.id || item.endpoint?.payload?.browseId;
          if (!browseId) continue;
          const albumTitle =
            typeof item.title === 'string'
              ? item.title
              : item.title?.text || item.title?.toString() || 'New Album';

          const sub =
            item.author?.name ||
            item.subtitle?.text ||
            item.subtitle?.toString() ||
            'New Release';
          const art = extractThumbnail(item, browseId);

          newReleases.push({
            browseId,
            title: albumTitle,
            subtitle: sub,
            artworkUrl: art,
            type: 'album',
          });
        }
      } else if (title.includes('video')) {
        for (const item of contents) {
          const vid = item.id || item.video_id;
          if (!vid) continue;
          const videoTitle =
            typeof item.title === 'string'
              ? item.title
              : item.title?.text || item.title?.toString() || 'Music Video';

          const artistName =
            item.artists?.map((a: any) => a.name).join(', ') ||
            item.authors?.map((a: any) => a.name).join(', ') ||
            item.author?.name ||
            'Music Video';
          const art = extractThumbnail(item, vid);
          const dur = item.duration?.seconds || (typeof item.duration === 'number' ? item.duration : 230);

          musicVideos.push({
            videoId: vid,
            title: videoTitle,
            artist: artistName,
            artworkUrl: art,
            durationSec: dur,
          });
        }
      }
    }

    const result = {
      trending: trending.slice(0, 24),
      newReleases: newReleases.slice(0, 20),
      musicVideos: musicVideos.slice(0, 20),
    };

    setCache(cacheKey, result);
    return result;
  } catch (err) {
    console.warn('[ytService] getExploreFeed error:', err);
    return {
      trending: [],
      newReleases: [],
      musicVideos: [],
    };
  }
}

/**
 * Search Songs on YouTube Music
 */
export async function searchTracks(query: string): Promise<YtTrack[]> {
  if (!query || !query.trim()) return [];
  const key = `search_${query.trim().toLowerCase()}`;
  const cached = getCached<YtTrack[]>(key);
  if (cached) return cached;

  try {
    const yt = await getYt();
    const search = await yt.music.search(query, { type: 'song' });
    const items = search.songs?.contents || search.contents || [];

    const tracks: YtTrack[] = [];
    for (const item of items) {
      const videoId = item.id || item.video_id;
      if (!videoId) continue;
      const title =
        typeof item.title === 'string'
          ? item.title
          : item.title?.text || item.title?.toString() || 'Unknown Track';

      const artist =
        item.artists?.map((a: any) => a.name).join(', ') ||
        item.authors?.map((a: any) => a.name).join(', ') ||
        item.author?.name ||
        'Various Artists';
      const art = extractThumbnail(item, videoId);
      const dur = item.duration?.seconds || (typeof item.duration === 'number' ? item.duration : 210);

      tracks.push({
        videoId,
        title,
        artist,
        artworkUrl: art,
        durationSec: dur,
        album: item.album?.name,
      });
    }

    setCache(key, tracks);
    return tracks;
  } catch (err) {
    console.warn('[ytService] Search error:', err);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Personal Library, Playlists, Liked Songs & History
// ---------------------------------------------------------------------------

export interface UserLibraryData {
  likedSongsCount: number;
  likedArtworkUrl?: string;
  playlists: YtDetailItem[];
  albums: YtDetailItem[];
  artists: YtDetailItem[];
}

export async function getUserLibrary(): Promise<UserLibraryData> {
  const empty: UserLibraryData = {
    likedSongsCount: 0,
    playlists: [],
    albums: [],
    artists: [],
  };

  try {
    const yt = await getYt();
    if (!yt.session.logged_in) return empty;

    let likedSongsCount = 0;
    let likedArtworkUrl: string | undefined = undefined;
    const playlists: YtDetailItem[] = [];
    const albums: YtDetailItem[] = [];
    const artists: YtDetailItem[] = [];

    // 1. Fetch user's authentic playlists via TV endpoint FEplaylist_aggregation
    try {
      const res = await yt.actions.execute('/browse', {
        browseId: 'FEplaylist_aggregation',
        client: 'TV',
      });
      const items =
        res.data?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.gridRenderer?.items || [];

      const ignoredKeywords = ['vlog', 'analisa', 'neural', 'watch later', 'watch_later'];

      for (const item of items) {
        const tile = item?.tileRenderer;
        if (!tile) continue;
        const title =
          tile.metadata?.tileMetadataRenderer?.title?.simpleText ||
          tile.metadata?.tileMetadataRenderer?.title?.runs?.[0]?.text ||
          'Playlist';
        const browseId =
          tile.onSelectCommand?.browseEndpoint?.browseId ||
          tile.contentId ||
          '';
        if (!browseId || browseId === 'VLWL') continue;

        const countText =
          tile.header?.tileHeaderRenderer?.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.runs
            ?.map((r: any) => r.text)
            .join('') || 'Playlist';

        const artworkUrl =
          tile.header?.tileHeaderRenderer?.thumbnail?.thumbnails?.[0]?.url ||
          cleanArtwork(tile.thumbnail?.url, browseId);

        const lowerTitle = title.toLowerCase();
        const isIgnored =
          countText.toLowerCase().includes('no video') ||
          countText.startsWith('0') ||
          ignoredKeywords.some((kw) => lowerTitle.includes(kw));

        if (browseId === 'VLLL' || browseId === 'LL' || lowerTitle.includes('liked')) {
          const countMatch = countText.match(/\d+/);
          likedSongsCount = countMatch ? parseInt(countMatch[0], 10) : 43;
          likedArtworkUrl = artworkUrl;
          continue;
        }

        if (isIgnored) continue;

        playlists.push({
          browseId,
          title,
          subtitle: countText,
          artworkUrl,
          type: 'playlist',
        });
      }
    } catch (e) {
      console.warn('[ytService] FEplaylist_aggregation query failed:', e);
    }

    // Populate artists from user taste / home feed if not present
    if (artists.length === 0) {
      try {
        const homeFeed = await getHomeFeed();
        if (homeFeed.artists && homeFeed.artists.length > 0) {
          artists.push(...homeFeed.artists);
        }
      } catch {
        // ignore
      }
    }

    // 2. Fallback / addition from yt.music.getLibrary() if cookie is present
    if (playlists.length === 0) {
      try {
        const lib = await yt.music.getLibrary();
        const sections = lib.contents || [];
        for (const section of sections) {
          const title = (section.header?.title?.text || section.title?.text || '').toLowerCase();
          const items = section.contents || (section as any).items || [];
          for (const item of items) {
            const browseId = item.id || item.endpoint?.payload?.browseId;
            if (!browseId) continue;
            const itemTitle = item.title?.text || item.title?.toString() || 'Playlist';
            const sub = item.subtitle?.text || item.subtitle?.toString() || 'YouTube Music';
            const art = extractThumbnail(item, browseId);

            if (browseId.startsWith('UC')) {
              artists.push({
                browseId,
                title: itemTitle,
                subtitle: 'Artist',
                artworkUrl: art,
                type: 'artist',
              });
            } else if (browseId.startsWith('MPRE') || title.includes('album')) {
              albums.push({
                browseId,
                title: itemTitle,
                subtitle: sub,
                artworkUrl: art,
                type: 'album',
              });
            } else {
              playlists.push({
                browseId,
                title: itemTitle,
                subtitle: sub,
                artworkUrl: art,
                type: 'playlist',
              });
            }
          }
        }
      } catch (e) {
        console.warn('[ytService] yt.music.getLibrary error:', e);
      }
    }

    return {
      likedSongsCount,
      likedArtworkUrl,
      playlists: playlists.slice(0, 30),
      albums: albums.slice(0, 20),
      artists: artists.slice(0, 20),
    };
  } catch (err) {
    console.error('[ytService] getUserLibrary error:', err);
    return empty;
  }
}

/**
 * Fetch Account Listening History from YouTube via TV endpoint
 */
export async function getUserHistory(): Promise<YtTrack[]> {
  try {
    const yt = await getYt();
    if (!yt.session.logged_in) return [];

    const tracks: YtTrack[] = [];

    // Query FEhistory with TV client
    try {
      const res = await yt.actions.execute('/browse', {
        browseId: 'FEhistory',
        client: 'TV',
      });
      const items =
        res.data?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content?.gridRenderer?.items || [];

      for (const item of items) {
        const tile = item?.tileRenderer;
        if (!tile) continue;
        const videoId =
          tile.contentId ||
          tile.onSelectCommand?.watchEndpoint?.videoId;
        if (!videoId) continue;

        const title =
          tile.metadata?.tileMetadataRenderer?.title?.simpleText ||
          tile.metadata?.tileMetadataRenderer?.title?.runs?.[0]?.text ||
          'Unknown Track';

        const artist =
          tile.metadata?.tileMetadataRenderer?.lines?.[0]?.lineRenderer?.items?.[0]?.lineItemRenderer?.text?.runs?.[0]?.text ||
          tile.metadata?.tileMetadataRenderer?.lines?.[0]?.lineRenderer?.items?.[0]?.lineItemRenderer?.text?.simpleText ||
          'YouTube';

        const artworkUrl =
          tile.header?.tileHeaderRenderer?.thumbnail?.thumbnails?.[0]?.url ||
          `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        const durStr =
          tile.header?.tileHeaderRenderer?.thumbnailOverlays?.[1]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
          tile.header?.tileHeaderRenderer?.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText;

        const durationSec = parseDurationSec(durStr, 210);

        tracks.push({
          videoId,
          title,
          artist,
          artworkUrl,
          durationSec,
        });
      }
    } catch (e) {
      console.warn('[ytService] FEhistory query failed:', e);
    }

    return tracks.slice(0, 40);
  } catch (err) {
    console.warn('[ytService] getUserHistory error:', err);
    return [];
  }
}

/**
 * Fetch Full Tracks for a Playlist, Album, or Liked Songs
 */
export async function getDetailTracks(browseId: string, type?: string): Promise<{
  title: string;
  subtitle: string;
  artworkUrl?: string;
  tracks: YtTrack[];
}> {
  const key = `detail_${browseId}`;
  const cached = getCached<any>(key);
  if (cached) return cached;

  try {
    const yt = await getYt();

    // Case 1: Liked Songs / Liked Videos
    if (browseId === 'liked' || browseId === 'LM' || browseId === 'VLLM' || browseId === 'VLLL' || browseId === 'LL') {
      if (yt.session.logged_in) {
        try {
          const res = await yt.actions.execute('/browse', { browseId: 'VLLL', client: 'TV' });
          const content = res.data?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content;
          const left = content?.twoColumnRenderer?.leftColumn?.entityMetadataRenderer;
          const pvl = content?.twoColumnRenderer?.rightColumn?.playlistVideoListRenderer;
          let items = [...(pvl?.contents || content?.gridRenderer?.items || [])];
          let contToken = pvl?.continuations?.[0]?.nextContinuationData?.continuation;

          // Fetch all pages of liked videos
          while (contToken && items.length < 100) {
            try {
              const nextRes = await yt.actions.execute('/browse', { continuation: contToken, client: 'TV' });
              const nextCont = nextRes.data?.continuationContents?.playlistVideoListContinuation;
              if (!nextCont?.contents || nextCont.contents.length === 0) break;
              items.push(...nextCont.contents);
              contToken = nextCont.continuations?.[0]?.nextContinuationData?.continuation;
            } catch {
              break;
            }
          }

          const tracks: YtTrack[] = [];
          for (const item of items) {
            const tile = item?.tileRenderer;
            if (!tile) continue;
            const vid = tile.contentId || tile.onSelectCommand?.watchEndpoint?.videoId;
            if (!vid) continue;
            const title =
              tile.metadata?.tileMetadataRenderer?.title?.simpleText ||
              tile.metadata?.tileMetadataRenderer?.title?.runs?.[0]?.text ||
              'Unknown Track';
            const artist =
              tile.metadata?.tileMetadataRenderer?.lines?.[0]?.lineRenderer?.items?.[0]?.lineItemRenderer?.text?.runs?.[0]?.text ||
              tile.metadata?.tileMetadataRenderer?.lines?.[0]?.lineRenderer?.items?.[0]?.lineItemRenderer?.text?.simpleText ||
              'YouTube';
            const art =
              tile.header?.tileHeaderRenderer?.thumbnail?.thumbnails?.[0]?.url ||
              `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

            const durStr =
              tile.header?.tileHeaderRenderer?.thumbnailOverlays?.[1]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
              tile.header?.tileHeaderRenderer?.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText;

            const durationSec = parseDurationSec(durStr, 210);

            tracks.push({
              videoId: vid,
              title,
              artist,
              artworkUrl: art,
              durationSec,
            });
          }

          if (tracks.length > 0) {
            const result = {
              title: left?.title?.simpleText || 'Liked Songs',
              subtitle: `${tracks.length} Songs in your Library`,
              artworkUrl: tracks[0]?.artworkUrl,
              tracks,
            };
            setCache(key, result);
            return result;
          }
        } catch (e) {
          console.warn('[ytService] VLLL query error:', e);
        }
      }

      // Try YouTube Music LM
      try {
        const pl = await yt.music.getPlaylist('LM');
        const tracks: YtTrack[] = [];
        for (const item of pl.items || []) {
          const vid = item.id;
          if (!vid) continue;
          const title =
            typeof item.title === 'string'
              ? item.title
              : item.title?.text || item.title?.toString() || 'Unknown Track';
          const artist =
            item.artists?.map((a: any) => a.name).join(', ') ||
            item.authors?.map((a: any) => a.name).join(', ') ||
            item.author?.name ||
            'Various Artists';
          const art = extractThumbnail(item, vid);
          const dur = item.duration?.seconds || 210;
          tracks.push({
            videoId: vid,
            title,
            artist,
            artworkUrl: art,
            durationSec: dur,
            album: item.album?.name,
          });
        }
        if (tracks.length > 0) {
          const result = {
            title: 'Liked Songs',
            subtitle: `${tracks.length} Songs in your Library`,
            artworkUrl: tracks[0]?.artworkUrl,
            tracks,
          };
          setCache(key, result);
          return result;
        }
      } catch (e) {
        console.warn('[ytService] LM query error:', e);
      }
    }

    // Case 2: Personalized Radio Mix (RDAMVM...)
    if (browseId.startsWith('RDAMVM')) {
      const seed = browseId.replace('RDAMVM', '');
      const recs = await getRecommendations(seed);
      const seedTitle = recs[0]?.artist || 'Personalized';
      return {
        title: `${seedTitle} Radio`,
        subtitle: `${recs.length} Recommended Songs • Endless Station`,
        artworkUrl: recs[0]?.artworkUrl,
        tracks: recs,
      };
    }

    // Case 3: Playlist (user or public)
    if (browseId.startsWith('VL') || browseId.startsWith('PL') || browseId.startsWith('RD')) {
      // 3A. Try YouTube Music getPlaylist first (returns all 100+ tracks with rich audio metadata)
      try {
        const pl = await yt.music.getPlaylist(browseId);
        const title =
          typeof pl.header?.title === 'string'
            ? pl.header?.title
            : pl.header?.title?.text || pl.header?.title?.toString() || 'Playlist';

        const subtitle =
          pl.header?.author?.name ||
          pl.header?.artists?.map((a: any) => a.name).join(', ') ||
          'YouTube Music';
        const artworkUrl = extractThumbnail(pl.header, browseId);
        const tracks: YtTrack[] = [];

        for (const item of pl.items || []) {
          const vid = item.id;
          if (!vid) continue;
          const tTitle =
            typeof item.title === 'string'
              ? item.title
              : item.title?.text || item.title?.toString() || 'Unknown Track';

          const artist =
            item.artists?.map((a: any) => a.name).join(', ') ||
            item.authors?.map((a: any) => a.name).join(', ') ||
            item.author?.name ||
            subtitle;
          const art = extractThumbnail(item, vid) || artworkUrl;
          const dur = item.duration?.seconds || 210;

          tracks.push({
            videoId: vid,
            title: tTitle,
            artist,
            artworkUrl: art,
            durationSec: dur,
            album: item.album?.name,
          });
        }

        if (tracks.length > 0) {
          const result = {
            title,
            subtitle: `${tracks.length} Songs • ${subtitle}`,
            artworkUrl: tracks[0]?.artworkUrl || artworkUrl,
            tracks,
          };
          setCache(key, result);
          return result;
        }
      } catch (e) {
        // Continue to TV client browse
      }

      // 3B. Try TV endpoint if signed in
      if (yt.session.logged_in) {
        try {
          const fullBrowseId = browseId.startsWith('VL') ? browseId : `VL${browseId}`;
          const tvRes = await yt.actions.execute('/browse', { browseId: fullBrowseId, client: 'TV' });
          const content = tvRes.data?.contents?.tvBrowseRenderer?.content?.tvSurfaceContentRenderer?.content;
          const left = content?.twoColumnRenderer?.leftColumn?.entityMetadataRenderer;
          const pvl = content?.twoColumnRenderer?.rightColumn?.playlistVideoListRenderer;
          let items = [...(pvl?.contents || content?.gridRenderer?.items || [])];
          let contToken = pvl?.continuations?.[0]?.nextContinuationData?.continuation;

          while (contToken && items.length < 150) {
            try {
              const nextRes = await yt.actions.execute('/browse', { continuation: contToken, client: 'TV' });
              const nextCont = nextRes.data?.continuationContents?.playlistVideoListContinuation;
              if (!nextCont?.contents || nextCont.contents.length === 0) break;
              items.push(...nextCont.contents);
              contToken = nextCont.continuations?.[0]?.nextContinuationData?.continuation;
            } catch {
              break;
            }
          }

          const tracks: YtTrack[] = [];
          for (const item of items) {
            const tile = item?.tileRenderer;
            if (!tile) continue;
            const vid = tile.contentId || tile.onSelectCommand?.watchEndpoint?.videoId;
            if (!vid) continue;
            const title =
              tile.metadata?.tileMetadataRenderer?.title?.simpleText ||
              tile.metadata?.tileMetadataRenderer?.title?.runs?.[0]?.text ||
              'Track';
            const artist =
              tile.metadata?.tileMetadataRenderer?.lines?.[0]?.lineRenderer?.items?.[0]?.lineItemRenderer?.text?.runs?.[0]?.text ||
              tile.metadata?.tileMetadataRenderer?.lines?.[0]?.lineRenderer?.items?.[0]?.lineItemRenderer?.text?.simpleText ||
              'Artist';
            const art =
              tile.header?.tileHeaderRenderer?.thumbnail?.thumbnails?.[0]?.url ||
              `https://i.ytimg.com/vi/${vid}/hqdefault.jpg`;

            const durStr =
              tile.header?.tileHeaderRenderer?.thumbnailOverlays?.[1]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
              tile.header?.tileHeaderRenderer?.thumbnailOverlays?.[0]?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText;

            const durationSec = parseDurationSec(durStr, 210);

            tracks.push({
              videoId: vid,
              title,
              artist,
              artworkUrl: art,
              durationSec,
            });
          }

          if (tracks.length > 0) {
            const result = {
              title: left?.title?.simpleText || 'Playlist',
              subtitle: `${tracks.length} Songs • YouTube Music`,
              artworkUrl: tracks[0]?.artworkUrl,
              tracks,
            };
            setCache(key, result);
            return result;
          }
        } catch (e) {
          console.warn('[ytService] TV playlist query error:', e);
        }
      }

      return {
        title: 'Playlist',
        subtitle: '0 Songs',
        tracks: [],
      };
    }

    // Case 4: Artist (starts with UC or explicit type)
    if (browseId.startsWith('UC') || type === 'artist') {
      try {
        const artist = await yt.music.getArtist(browseId);
        const title =
          artist.header?.title?.text || artist.header?.title?.toString() || 'Artist';
        const artworkUrl = extractThumbnail(artist.header, browseId);

        const songsSection = artist.sections?.find(
          (s: any) =>
            (s.header?.title?.text || s.type || '').toLowerCase().includes('song') ||
            s.type === 'MusicShelf'
        );

        const tracks: YtTrack[] = [];
        for (const item of songsSection?.contents || []) {
          const vid = item.id;
          if (!vid) continue;
          tracks.push({
            videoId: vid,
            title: item.title?.text || item.title?.toString() || 'Track',
            artist: item.artists?.map((a: any) => a.name).join(', ') || title,
            artworkUrl: extractThumbnail(item, vid) || artworkUrl,
            durationSec: item.duration?.seconds || 210,
            album: item.album?.name,
          });
        }

        if (tracks.length > 0) {
          const result = {
            title,
            subtitle: `${tracks.length} Top Songs`,
            artworkUrl,
            tracks,
          };
          setCache(key, result);
          return result;
        }
      } catch (e) {
        console.warn(`[ytService] yt.music.getArtist failed for ${browseId}:`, e);
      }

      const fallbackTracks = await searchTracks(
        browseId.startsWith('UC') ? 'rock songs' : `${browseId} songs`
      );
      return {
        title: type === 'artist' ? browseId : 'Artist',
        subtitle: 'Top Songs',
        tracks: fallbackTracks,
      };
    }

    // Case 5: Album (starts with MPRE or explicit type)
    if (browseId.startsWith('MPRE') || type === 'album') {
      try {
        const album = await yt.music.getAlbum(browseId);
        const title =
          typeof album.header?.title === 'string'
            ? album.header?.title
            : album.header?.title?.text || album.header?.title?.toString() || 'Album';

        const subtitle =
          album.header?.author?.name ||
          album.header?.artists?.map((a: any) => a.name).join(', ') ||
          'YouTube Music';
        const artworkUrl = extractThumbnail(album.header, browseId);
        const tracks: YtTrack[] = [];

        for (const item of album.contents || []) {
          const vid = item.id;
          if (!vid) continue;
          const tTitle =
            typeof item.title === 'string'
              ? item.title
              : item.title?.text || item.title?.toString() || 'Track';

          const artist =
            item.artists?.map((a: any) => a.name).join(', ') ||
            item.authors?.map((a: any) => a.name).join(', ') ||
            subtitle;
          const dur = item.duration?.seconds || 210;
          tracks.push({
            videoId: vid,
            title: tTitle,
            artist,
            artworkUrl: extractThumbnail(item, vid) || artworkUrl,
            durationSec: dur,
            album: title,
          });
        }
        if (tracks.length > 0) {
          const result = { title, subtitle, artworkUrl, tracks };
          setCache(key, result);
          return result;
        }
      } catch (e) {
        console.warn(`[ytService] yt.music.getAlbum failed for ${browseId}:`, e);
      }
    }

    // If browseId looks like an internal ID, don't search raw ID in YouTube search
    if (
      browseId.startsWith('VL') ||
      browseId.startsWith('PL') ||
      browseId.startsWith('UC') ||
      browseId.startsWith('MPRE') ||
      browseId.startsWith('RD')
    ) {
      return {
        title: 'Playlist',
        subtitle: '0 Songs',
        tracks: [],
      };
    }

    // Fallback: search tracks for this title/browseId
    const fallbackTracks = await searchTracks(browseId);
    return {
      title: browseId,
      subtitle: 'Tracks',
      tracks: fallbackTracks,
    };
  } catch (err) {
    console.warn(`[ytService] getDetailTracks failed for ${browseId}:`, err);
    return {
      title: browseId,
      subtitle: '0 Songs',
      tracks: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Audio Stream Resolution & Media Piping
// ---------------------------------------------------------------------------

/**
 * Resolve Direct YouTube Audio Stream URL via VISIONOS Client
 */
export async function resolveAudioStream(videoId: string): Promise<{
  success: boolean;
  streamUrl: string;
  directUrl: string;
  durationSec?: number;
  itag?: number;
  mimeType?: string;
}> {
  const cacheKey = `stream_${videoId}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  try {
    const yt = await getYt();
    const player = await yt.actions.execute('/player', {
      videoId,
      client: 'VISIONOS',
    });

    const formats = player.data?.streamingData?.adaptiveFormats || [];
    // Prioritize 140 (128kbps AAC/MP4 - universal TV & browser compatibility), then any audio format
    const audio =
      formats.find((f: any) => f.itag === 140 && f.url) ||
      formats.find((f: any) => f.itag === 139 && f.url) ||
      formats.find((f: any) => f.mimeType?.startsWith('audio/') && f.url);

    if (audio?.url) {
      const durationSec = audio.approxDurationMs ? Number(audio.approxDurationMs) / 1000 : 220;
      const directUrl = audio.url;
      // In web browser, pipe through local dev server to ensure byte-range scrubbing works cleanly without CORS/Referer blocks
      const pipeUrl = `/api/yt/pipe?url=${encodeURIComponent(directUrl)}`;

      const result = {
        success: true,
        streamUrl: pipeUrl,
        directUrl,
        durationSec,
        itag: audio.itag,
        mimeType: audio.mimeType,
      };

      setCache(cacheKey, result);
      return result;
    }

    throw new Error('No direct stream URL returned by VISIONOS client');
  } catch (error) {
    console.error(`[ytService] Stream resolve failed for ${videoId}:`, error);
    return {
      success: false,
      streamUrl: 'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3',
      directUrl: 'https://commondatastorage.googleapis.com/codeskulptor-demos/DDR_assets/Kangaroo_MusiQue_-_The_Neverwritten_Role_Playing_Game.mp3',
      durationSec: 230,
    };
  }
}

// ---------------------------------------------------------------------------
// Synced Lyrics Pipeline
// ---------------------------------------------------------------------------

export interface LyricLine {
  timeSec: number;
  text: string;
}

function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d{1,3})?)\]/g;
  const offsetRegex = /\[offset:\s*([+-]?\d+)\]/i;

  let offsetSec = 0;
  for (const line of lines) {
    const offsetMatch = line.match(offsetRegex);
    if (offsetMatch && offsetMatch[1]) {
      offsetSec = parseInt(offsetMatch[1], 10) / 1000;
    }
  }

  for (const line of lines) {
    const matches = [...line.matchAll(timeRegex)];
    if (!matches.length) continue;
    const text = line.replace(timeRegex, '').trim();
    if (!text) continue;

    for (const match of matches) {
      if (!match[1] || !match[2]) continue;
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      const timeSec = Math.max(0, min * 60 + sec + offsetSec);
      result.push({ timeSec, text });
    }
  }

  return result.sort((a, b) => a.timeSec - b.timeSec);
}

export async function fetchLyrics(
  artist: string,
  title: string,
  durationSec?: number,
  videoId?: string,
): Promise<{ synced: boolean; lines: LyricLine[] }> {
  let cleanTitle = title
    .replace(/\([^)]*(?:video|audio|remaster|live|version|edit|lyric|hd|4k)[^)]*\)/gi, '')
    .replace(/\[[^\]]*(?:video|audio|remaster|live|version|edit|lyric|hd|4k)[^\]]*\]/gi, '')
    .replace(/\([^)]*feat\.[^)]*\)/gi, '')
    .replace(/official (music )?video|official audio|lyric video/gi, '')
    .replace(/^\s*\d+\s*[-.]\s*/, '')
    .trim();

  let cleanArtist = (artist.split(',')[0] || '')
    .replace(/feat\..*/i, '')
    .replace(/ - Topic$/i, '')
    .trim();

  if ((cleanArtist === 'Trending Artist' || cleanArtist === 'Unknown' || !cleanArtist) && cleanTitle.includes(' - ')) {
    const parts = cleanTitle.split(' - ');
    cleanArtist = (parts[1] || '').trim();
    cleanTitle = (parts[0] || '').trim();
  }

  const cacheKey = `lyrics_${cleanArtist}_${cleanTitle}_${videoId || ''}`;
  const cached = getCached<any>(cacheKey);
  if (cached) return cached;

  const headers = { 'User-Agent': 'BitChord-TV/1.9.0 (https://github.com/bitchord)' };

  // Tier 1: LRCLIB exact get with duration
  try {
    const url = new URL('https://lrclib.net/api/get');
    url.searchParams.set('artist_name', cleanArtist);
    url.searchParams.set('track_name', cleanTitle);
    if (durationSec && durationSec > 0) {
      url.searchParams.set('duration', Math.round(durationSec).toString());
    }

    const res = await fetch(url.toString(), { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        const lines = parseLrc(data.syncedLyrics);
        if (lines.length > 0) {
          const result = { synced: true, lines };
          setCache(cacheKey, result);
          return result;
        }
      }
    }
  } catch (err) {
    console.warn('[ytService] LRCLIB tier-1 failed:', err);
  }

  // Tier 2: LRCLIB get without duration constraint
  try {
    const url = new URL('https://lrclib.net/api/get');
    url.searchParams.set('artist_name', cleanArtist);
    url.searchParams.set('track_name', cleanTitle);

    const res = await fetch(url.toString(), { headers });
    if (res.ok) {
      const data = await res.json();
      if (data.syncedLyrics) {
        const lines = parseLrc(data.syncedLyrics);
        if (lines.length > 0) {
          const result = { synced: true, lines };
          setCache(cacheKey, result);
          return result;
        }
      } else if (data.plainLyrics) {
        const plainLines: LyricLine[] = data.plainLyrics
          .split('\n')
          .filter((t: string) => t.trim().length > 0)
          .map((text: string) => ({ timeSec: -1, text: text.trim() }));
        const result = { synced: false, lines: plainLines };
        setCache(cacheKey, result);
        return result;
      }
    }
  } catch (err) {
    console.warn('[ytService] LRCLIB tier-2 failed:', err);
  }

  // Tier 3: LRCLIB search by query to find closest synced track
  try {
    const searchUrl = new URL('https://lrclib.net/api/search');
    searchUrl.searchParams.set('q', `${cleanArtist} ${cleanTitle}`);
    const sRes = await fetch(searchUrl.toString(), { headers });
    if (sRes.ok) {
      const list = await sRes.json();
      if (Array.isArray(list)) {
        const withSynced = list.filter((item) => !!item.syncedLyrics);
        if (withSynced.length > 0) {
          if (durationSec && durationSec > 0) {
            withSynced.sort(
              (a, b) => Math.abs((a.duration || 0) - durationSec) - Math.abs((b.duration || 0) - durationSec),
            );
          }
          const best = withSynced[0];
          const diff = durationSec ? Math.abs((best.duration || 0) - durationSec) : 0;
          if (diff <= 12 && best.syncedLyrics) {
            const lines = parseLrc(best.syncedLyrics);
            if (lines.length > 0) {
              const result = { synced: true, lines };
              setCache(cacheKey, result);
              return result;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[ytService] LRCLIB tier-3 failed:', err);
  }

  // Tier 4: YouTube Music official native lyrics fallback
  if (videoId) {
    try {
      const yt = await getYt();
      const ytLyrics = await yt.music.getLyrics(videoId);
      const text = ytLyrics?.description?.text;
      if (text) {
        const plainLines: LyricLine[] = text
          .split('\n')
          .filter((t: string) => t.trim().length > 0)
          .map((line: string) => ({ timeSec: -1, text: line.trim() }));
        const result = { synced: false, lines: plainLines };
        setCache(cacheKey, result);
        return result;
      }
    } catch (err) {
      console.warn('[ytService] YouTube Music native lyrics failed:', err);
    }
  }

  return { synced: false, lines: [] };
}

/**
 * Pipe media stream range requests directly to client with 206 Partial Content
 */
export async function pipeMedia(targetUrl: string, req: IncomingMessage, res: ServerResponse) {
  try {
    const headers: Record<string, string> = {};
    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    const upstream = await fetch(targetUrl, { headers });
    const responseHeaders: Record<string, string> = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range',
      'Accept-Ranges': 'bytes',
    };

    const contentType = upstream.headers.get('content-type');
    const contentRange = upstream.headers.get('content-range');
    const contentLength = upstream.headers.get('content-length');

    if (contentType) responseHeaders['Content-Type'] = contentType;
    if (contentRange) responseHeaders['Content-Range'] = contentRange;
    if (contentLength) responseHeaders['Content-Length'] = contentLength;

    res.writeHead(upstream.status, responseHeaders);

    if (upstream.body) {
      Readable.fromWeb(upstream.body as any).pipe(res);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('[ytService] Pipe stream error:', error);
    res.writeHead(500, { 'Content-Type': 'text/plain' });
    res.end('Failed to pipe media stream');
  }
}
