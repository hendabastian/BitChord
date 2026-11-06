import React, { useState } from 'react';
import { getTvProductInfo } from '../../platform/display';
import { QrCode, Lock, Check } from 'lucide-react';

interface TvSettingsPageProps {
  isSignedIn: boolean;
  onOpenSignIn: () => void;
  onOpenPinModal: () => void;
  onRunSetupAgain: () => void;
}

export const TvSettingsPage: React.FC<TvSettingsPageProps> = ({
  isSignedIn,
  onOpenSignIn,
  onOpenPinModal,
  onRunSetupAgain,
}) => {
  const [blurb, setBlurb] = useState('Playback, sound and display preferences for BitChord on this TV.');
  const [audioQuality, setAudioQuality] = useState<'lossless' | 'high' | 'normal'>('high');
  const [spatialAudio, setSpatialAudio] = useState(true);
  const [ambientTint, setAmbientTint] = useState(true);

  const productInfo = getTvProductInfo();

  return (
    <div className="pt-6 pb-24 px-[56px] flex gap-16 h-full overflow-hidden">
      {/* Left Pane: Branding & Dynamic Description */}
      <div className="w-[420px] flex flex-col justify-between shrink-0">
        <div>
          <div className="w-16 h-16 rounded-2xl bg-[#FA2D48] flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-red-500/20 mb-6">
            ♪
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-4">Settings</h1>
          <p className="text-xl text-white/70 font-medium leading-relaxed bg-white/5 p-6 rounded-3xl border border-white/10 min-h-[160px]">
            {blurb}
          </p>
        </div>

        <div className="text-xs text-white/40 space-y-1">
          <p>Model: {productInfo.model}</p>
          <p>Firmware: {productInfo.firmware}</p>
          <p>Resolution: {productInfo.resolution} (Full HD UI coordinate space)</p>
        </div>
      </div>

      {/* Right Pane: Grouped Settings Rows */}
      <div className="flex-1 overflow-y-auto pr-4 space-y-8">
        {/* Account Section */}
        <section>
          <h3 className="text-sm uppercase font-bold text-white/40 tracking-wider mb-3 px-2">Account & Profiles</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/10 overflow-hidden">
            <button
              tabIndex={0}
              onFocus={() => setBlurb('Connect your phone to sync YouTube Music playlists, liked songs, and history.')}
              onClick={onOpenSignIn}
              className="tv-focusable w-full p-4 flex items-center justify-between text-left hover:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <QrCode size={20} className="text-[#FA2D48]" />
                <span className="text-base font-bold text-white">Sign In with Phone (QR)</span>
              </div>
              <span className="text-sm text-white/60 font-semibold">{isSignedIn ? 'Connected' : 'Not Signed In'}</span>
            </button>

            <button
              tabIndex={0}
              onFocus={() => setBlurb('Protect your profile with a 4-digit PIN code to require authorization when switching profiles.')}
              onClick={onOpenPinModal}
              className="tv-focusable w-full p-4 flex items-center justify-between text-left hover:bg-white/10"
            >
              <div className="flex items-center gap-3">
                <Lock size={20} className="text-[#FA2D48]" />
                <span className="text-base font-bold text-white">Profile PIN Lock</span>
              </div>
              <span className="text-sm text-white/60 font-semibold">Configure</span>
            </button>
          </div>
        </section>

        {/* Playback & Sound */}
        <section>
          <h3 className="text-sm uppercase font-bold text-white/40 tracking-wider mb-3 px-2">Playback & Audio</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/10 overflow-hidden">
            <button
              tabIndex={0}
              onFocus={() => setBlurb('Audio Quality: Lossless FLAC asks addon servers for bit-exact audio; High uses 256k AAC; Normal uses 128k Opus.')}
              onClick={() => {
                const next = audioQuality === 'lossless' ? 'high' : audioQuality === 'high' ? 'normal' : 'lossless';
                setAudioQuality(next);
              }}
              className="tv-focusable w-full p-4 flex items-center justify-between text-left hover:bg-white/10"
            >
              <span className="text-base font-bold text-white">Streaming Audio Quality</span>
              <span className="text-sm text-[#FA2D48] font-bold uppercase">{audioQuality}</span>
            </button>

            <button
              tabIndex={0}
              onFocus={() => setBlurb('Spatial Audio: 3D surround soundstage expansion for TV speakers, soundbars, and home theaters.')}
              onClick={() => setSpatialAudio((p) => !p)}
              className="tv-focusable w-full p-4 flex items-center justify-between text-left hover:bg-white/10"
            >
              <span className="text-base font-bold text-white">3D Spatial Audio Virtualizer</span>
              <span className="text-sm font-bold flex items-center gap-1.5 text-white/80">
                {spatialAudio ? <Check size={16} className="text-[#FA2D48]" /> : null}
                {spatialAudio ? 'Enabled' : 'Off'}
              </span>
            </button>
          </div>
        </section>

        {/* Display & Appearance */}
        <section>
          <h3 className="text-sm uppercase font-bold text-white/40 tracking-wider mb-3 px-2">Display & Appearance</h3>
          <div className="bg-white/5 border border-white/10 rounded-2xl divide-y divide-white/10 overflow-hidden">
            <button
              tabIndex={0}
              onFocus={() => setBlurb('Dynamic Ambient Canvas Tint: paints a soft, animated ambient gradient behind the app using colors from the current album art.')}
              onClick={() => setAmbientTint((p) => !p)}
              className="tv-focusable w-full p-4 flex items-center justify-between text-left hover:bg-white/10"
            >
              <span className="text-base font-bold text-white">Dynamic Canvas Background Tint</span>
              <span className="text-sm font-bold text-white/80">{ambientTint ? 'On' : 'Off'}</span>
            </button>

            <button
              tabIndex={0}
              onFocus={() => setBlurb('Re-run the first-time onboarding tutorial to review remote shortcuts and setup.')}
              onClick={onRunSetupAgain}
              className="tv-focusable w-full p-4 flex items-center justify-between text-left hover:bg-white/10"
            >
              <span className="text-base font-bold text-white">Run First-Time Setup Again</span>
              <span className="text-sm text-white/50">Launch</span>
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

