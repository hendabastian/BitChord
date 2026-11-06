import React from 'react';
import { Home, Compass, Library, Search, Settings, Music, User } from 'lucide-react';
import { TvArtwork } from './TvArtwork';

export type TvTab = 'home' | 'explore' | 'library' | 'search' | 'settings';

interface TvTopBarProps {
  activeTab: TvTab;
  onSelectTab: (tab: TvTab) => void;
  nowPlaying?: {
    title: string;
    artist: string;
    artworkUrl?: string | null;
    isPlaying: boolean;
  } | null;
  onOpenNowPlaying: () => void;
  onOpenAccount: () => void;
  userAvatar?: string | null;
}

export const TvTopBar: React.FC<TvTopBarProps> = ({
  activeTab,
  onSelectTab,
  nowPlaying,
  onOpenNowPlaying,
  onOpenAccount,
  userAvatar,
}) => {
  const tabs: { id: TvTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home size={20} /> },
    { id: 'explore', label: 'Explore', icon: <Compass size={20} /> },
    { id: 'library', label: 'Library', icon: <Library size={20} /> },
    { id: 'search', label: 'Search', icon: <Search size={20} /> },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  return (
    <header
      data-tv-zone="header"
      className="h-[76px] px-[56px] flex items-center justify-between z-30 select-none shrink-0 bg-[#08080B]/90 backdrop-blur-xl border-b border-white/5"
    >
      {/* Brand logo & Tabs */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3 pr-2">
          <div className="w-9 h-9 rounded-xl bg-[#FA2D48] flex items-center justify-center font-black text-xl text-white shadow-lg shadow-red-500/20">
            ♪
          </div>
          <span className="text-xl font-bold tracking-tight">BitChord</span>
        </div>

        <nav className="flex items-center gap-2 bg-white/10 backdrop-blur-md p-1.5 rounded-full border border-white/10">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                tabIndex={0}
                data-tab-id={tab.id}
                data-active-tab={isActive ? 'true' : undefined}
                onClick={() => onSelectTab(tab.id)}
                className={`tv-pill-focusable px-5 py-2 rounded-full flex items-center gap-2 text-base font-semibold transition-colors ${
                  isActive
                    ? 'bg-white text-black'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Right controls: Now Playing Pill & Profile */}
      <div className="flex items-center gap-4">
        {nowPlaying && (
          <button
            tabIndex={0}
            onClick={onOpenNowPlaying}
            className="tv-pill-focusable flex items-center gap-3 bg-white/10 hover:bg-white/20 border border-white/15 px-4 py-2 rounded-full backdrop-blur-md max-w-[340px]"
          >
            <TvArtwork
              src={nowPlaying.artworkUrl}
              alt=""
              className="w-7 h-7 rounded-lg shrink-0 shadow"
            />
            <div className="flex flex-col text-left truncate">
              <span className="text-sm font-semibold truncate leading-tight">
                {nowPlaying.title}
              </span>
              <span className="text-xs text-white/60 truncate leading-tight">
                {nowPlaying.artist}
              </span>
            </div>
            {nowPlaying.isPlaying && (
              <div className="flex items-end gap-0.5 h-4 ml-1">
                <span className="w-1 bg-[#FA2D48] rounded-full animate-bounce h-3" />
                <span className="w-1 bg-[#FA2D48] rounded-full animate-bounce delay-100 h-4" />
                <span className="w-1 bg-[#FA2D48] rounded-full animate-bounce delay-200 h-2" />
              </div>
            )}
          </button>
        )}

        {/* Profile Button */}
        <button
          tabIndex={0}
          onClick={onOpenAccount}
          aria-label="Account & Profiles"
          className="tv-pill-focusable w-11 h-11 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 flex items-center justify-center text-white/90 backdrop-blur-md overflow-hidden"
        >
          {userAvatar ? (
            <img src={userAvatar} alt="Profile" className="w-full h-full object-cover rounded-full" />
          ) : (
            <User size={20} />
          )}
        </button>
      </div>
    </header>
  );
};

