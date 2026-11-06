import React, { useState, useEffect, useRef } from 'react';
import { TvVirtualKeyboard } from '../components/TvVirtualKeyboard';
import { TvCard } from '../components/TvCard';
import { TvCardSkeleton } from '../components/TvSkeleton';
import { Search, Loader2, Music2 } from 'lucide-react';
import { searchMusic } from '../../api/musicApi';
import type { DetailPayload, PlayableTrack } from './TvHomePage';

interface TvSearchPageProps {
  onPlayTrack: (track: PlayableTrack) => void;
  onOpenDetail: (detail: DetailPayload) => void;
}

export const TvSearchPage: React.FC<TvSearchPageProps> = ({ onPlayTrack }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayableTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  const performSearch = (q: string) => {
    if (!q || !q.trim()) {
      setResults([]);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setHasSearched(true);
    searchMusic(q)
      .then((tracks) => {
        setResults(tracks);
      })
      .catch((err) => {
        console.warn('[search] searchMusic failed:', err);
        setResults([]);
      })
      .finally(() => {
        setIsSearching(false);
      });
  };

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);

    if (query.trim().length > 1) {
      debounceTimer.current = setTimeout(() => {
        performSearch(query);
      }, 400);
    } else if (query.trim().length === 0) {
      setResults([]);
      setHasSearched(false);
      setIsSearching(false);
    }

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [query]);

  const handleKeyPress = (char: string) => {
    setQuery((prev) => prev + char);
  };

  const handleBackspace = () => {
    setQuery((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
  };

  const handleSubmit = () => {
    performSearch(query);
  };

  const sampleKeywords = ['Daft Punk', 'The Weeknd', 'Billie Eilish', 'Taylor Swift', 'Coldplay'];

  return (
    <div className="pt-6 pb-24 px-[56px] overflow-y-auto h-full">
      {/* Search Input Display */}
      <div className="flex items-center gap-4 bg-white/10 border border-white/15 px-6 py-4 rounded-2xl max-w-[680px] mb-6 shadow-xl">
        <Search size={24} className="text-[#FA2D48] shrink-0" />
        <span className="text-2xl font-bold tracking-wide text-white flex-1 truncate">
          {query || <span className="text-white/30 font-normal">Search songs, artists, albums...</span>}
        </span>
        {isSearching && <Loader2 size={22} className="animate-spin text-[#FA2D48] shrink-0" />}
      </div>

      <div className="flex gap-10 items-start">
        {/* Virtual Keyboard */}
        <div className="shrink-0">
          <TvVirtualKeyboard
            onKeyPress={handleKeyPress}
            onBackspace={handleBackspace}
            onClear={handleClear}
            onSubmit={handleSubmit}
          />
        </div>

        {/* Search Results Area */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-white">
              {query.trim().length > 0 ? `Results for "${query}"` : 'Quick Searches'}
            </h3>
            {results.length > 0 && (
              <span className="text-xs text-white/50">{results.length} tracks found</span>
            )}
          </div>

          {/* Quick Keywords when query is empty */}
          {!hasSearched && query.trim().length === 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-2.5">
                {sampleKeywords.map((kw) => (
                  <button
                    key={kw}
                    tabIndex={0}
                    onClick={() => {
                      setQuery(kw);
                      performSearch(kw);
                    }}
                    className="tv-pill-focusable px-4 py-2 rounded-full bg-white/5 hover:bg-white/15 text-white/80 hover:text-white text-sm font-semibold border border-white/10 transition-colors"
                  >
                    {kw}
                  </button>
                ))}
              </div>
              <div className="p-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl mt-4">
                <Music2 size={32} className="mx-auto text-white/20 mb-2" />
                <p className="text-sm text-white/40 font-medium">
                  Use the D-pad to enter search terms or pick a popular artist above.
                </p>
              </div>
            </div>
          )}

          {/* Loading Skeletons */}
          {isSearching && (
            <div className="grid grid-cols-3 gap-5">
              {Array.from({ length: 6 }).map((_, i) => (
                <TvCardSkeleton key={i} width="w-full" />
              ))}
            </div>
          )}

          {/* Actual Results */}
          {!isSearching && hasSearched && results.length > 0 && (
            <div className="grid grid-cols-3 gap-5">
              {results.map((track) => (
                <TvCard
                  key={track.videoId}
                  id={track.videoId}
                  title={track.title}
                  subtitle={track.artist}
                  artworkUrl={track.artworkUrl}
                  width="w-full"
                  onClick={() => onPlayTrack(track)}
                />
              ))}
            </div>
          )}

          {/* Empty State */}
          {!isSearching && hasSearched && results.length === 0 && (
            <div className="p-12 text-center text-white/50 font-semibold bg-white/5 rounded-2xl border border-white/10">
              No matching tracks found for "{query}". Try another search.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
