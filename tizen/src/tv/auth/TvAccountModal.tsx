import React, { useState, useEffect, useRef } from 'react';
import { TvQrCode } from './TvQrCode';
import { X, Lock, User, LogOut, CheckCircle2, RefreshCw, KeyRound, Smartphone } from 'lucide-react';
import { setFocusTrap, applyFocus } from '../../platform/spatialNav';
import {
  fetchAuthStatus,
  fetchDeviceCodeAuth,
  submitAuthCookie,
  logoutAuthUser,
  type UserProfile,
} from '../../api/musicApi';

interface TvAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  pairingUrl?: string;
  isSignedIn: boolean;
  userProfile?: UserProfile | null;
  onSignInSuccess?: (user?: UserProfile) => void;
  onSignOut: () => void;
}

export const TvAccountModal: React.FC<TvAccountModalProps> = ({
  isOpen,
  onClose,
  pairingUrl = 'http://127.0.0.1:8765/',
  isSignedIn,
  userProfile,
  onSignInSuccess,
  onSignOut,
}) => {
  const [activeMode, setActiveMode] = useState<'device' | 'cookie' | 'pin'>('device');
  const [deviceCode, setDeviceCode] = useState<string>('');
  const [verificationUrl, setVerificationUrl] = useState<string>('https://www.google.com/device');
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);
  const [cookieInput, setCookieInput] = useState<string>('');
  const [cookieError, setCookieError] = useState<string | null>(null);
  const [isSubmittingCookie, setIsSubmittingCookie] = useState<boolean>(false);
  const [pin, setPin] = useState('');

  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Focus trap on modal open
  useEffect(() => {
    if (isOpen && modalRef.current) {
      setFocusTrap(modalRef.current);
      if (closeButtonRef.current) {
        applyFocus(closeButtonRef.current);
      }
    }
    return () => {
      setFocusTrap(null);
    };
  }, [isOpen]);

  // Request new Device Code
  const loadDeviceCode = async () => {
    if (isSignedIn) return;
    setIsLoadingCode(true);
    try {
      const data = await fetchDeviceCodeAuth();
      if (data.status === 'pending' && data.userCode) {
        setDeviceCode(data.userCode);
        if (data.verificationUrl) setVerificationUrl(data.verificationUrl);
      } else if (data.status === 'already_signed_in') {
        const status = await fetchAuthStatus();
        if (status.isSignedIn && onSignInSuccess) {
          onSignInSuccess(status.user || undefined);
        }
      }
    } catch (e) {
      console.warn('[TvAccountModal] Failed to get device code:', e);
    } finally {
      setIsLoadingCode(false);
    }
  };

  // Initial code fetch & polling loop
  useEffect(() => {
    if (!isOpen || isSignedIn) return;

    loadDeviceCode();

    const interval = setInterval(async () => {
      try {
        const status = await fetchAuthStatus();
        if (status.isSignedIn) {
          clearInterval(interval);
          if (onSignInSuccess) {
            onSignInSuccess(status.user || undefined);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [isOpen, isSignedIn]);

  // Handle Cookie Submit
  const handleCookieSubmit = async () => {
    if (!cookieInput.trim()) return;
    setIsSubmittingCookie(true);
    setCookieError(null);
    try {
      const res = await submitAuthCookie(cookieInput.trim());
      if (res.isSignedIn) {
        const status = await fetchAuthStatus();
        if (onSignInSuccess) {
          onSignInSuccess(status.user || undefined);
        }
      } else {
        setCookieError('Invalid session cookie. Please check and try again.');
      }
    } catch {
      setCookieError('Connection error while submitting cookie');
    } finally {
      setIsSubmittingCookie(false);
    }
  };

  // Handle Sign Out
  const handleSignOut = async () => {
    await logoutAuthUser();
    onSignOut();
    setActiveMode('device');
    loadDeviceCode();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-8 select-none">
      <div
        ref={modalRef}
        className="bg-[#141418] border border-white/15 rounded-[32px] p-8 max-w-[760px] w-full shadow-2xl flex flex-col gap-6 relative"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-[#FA2D48] flex items-center justify-center font-bold text-white shadow-lg shadow-red-500/20 overflow-hidden">
              {userProfile?.avatarUrl ? (
                <img src={userProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <User size={22} />
              )}
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {isSignedIn ? (userProfile?.name || 'Google Account') : 'Google Account Sign-In'}
              </h2>
              <p className="text-xs text-white/50">
                {isSignedIn
                  ? userProfile?.handle || 'YouTube Music Library Linked'
                  : 'Link your YouTube Music library, playlists, & listening history'}
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            tabIndex={0}
            onClick={onClose}
            aria-label="Close"
            className="tv-pill-focusable w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>

        {/* ----------------- SIGNED IN STATE ----------------- */}
        {isSignedIn ? (
          <div className="flex flex-col gap-6">
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-center gap-6">
              <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white/10 shrink-0 border border-white/10 flex items-center justify-center">
                {userProfile?.avatarUrl ? (
                  <img src={userProfile.avatarUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <User size={36} className="text-white/40" />
                )}
              </div>

              <div className="flex-1 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-white">{userProfile?.name || 'Google Account'}</h3>
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">
                    <CheckCircle2 size={13} />
                    Connected
                  </span>
                </div>
                <p className="text-sm text-white/60">{userProfile?.handle || 'Personalized YouTube Music feed active'}</p>
                <p className="text-xs text-white/40 mt-1">
                  Your Liked Songs, personalized mixes, playlists, and history are synchronized with this TV.
                </p>
              </div>
            </div>

            <div className="flex gap-4 justify-end">
              <button
                tabIndex={0}
                onClick={() => setActiveMode('pin')}
                className="tv-pill-focusable px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold flex items-center gap-2"
              >
                <Lock size={16} />
                <span>Configure Profile PIN</span>
              </button>

              <button
                tabIndex={0}
                onClick={handleSignOut}
                className="tv-pill-focusable px-5 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm font-bold flex items-center gap-2"
              >
                <LogOut size={16} />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        ) : activeMode === 'pin' ? (
          /* Profile PIN Configuration */
          <div className="flex flex-col gap-4 p-4">
            <h3 className="text-lg font-bold text-white">Enter 4-Digit Profile PIN</h3>
            <p className="text-xs text-white/60">This PIN will be requested when switching to this profile on TV.</p>
            <div className="flex gap-3 justify-center my-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-14 h-16 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-3xl font-black text-white"
                >
                  {pin[i] ? '•' : ''}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-5 gap-2 max-w-[400px] mx-auto">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].map((digit) => (
                <button
                  key={digit}
                  tabIndex={0}
                  onClick={() => pin.length < 4 && setPin((p) => p + digit)}
                  className="tv-pill-focusable w-14 h-14 rounded-2xl bg-white/10 hover:bg-white/20 text-xl font-bold flex items-center justify-center text-white"
                >
                  {digit}
                </button>
              ))}
            </div>

            <div className="flex gap-3 justify-center mt-4">
              <button
                tabIndex={0}
                onClick={() => setPin('')}
                className="tv-pill-focusable px-6 py-2.5 rounded-xl bg-white/10 text-white text-sm font-bold"
              >
                Clear
              </button>
              <button
                tabIndex={0}
                onClick={() => setActiveMode('device')}
                className="tv-pill-focusable px-6 py-2.5 rounded-xl bg-[#FA2D48] text-white text-sm font-bold"
              >
                Save PIN
              </button>
            </div>
          </div>
        ) : (
          /* ----------------- SIGN IN OPTIONS (NOT SIGNED IN) ----------------- */
          <div className="flex flex-col gap-6">
            {/* Mode Selector Tabs */}
            <div className="flex gap-2 p-1 bg-white/5 rounded-2xl border border-white/10 w-fit">
              <button
                tabIndex={0}
                onClick={() => setActiveMode('device')}
                className={`tv-pill-focusable px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                  activeMode === 'device' ? 'bg-[#FA2D48] text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <KeyRound size={15} />
                <span>Google TV Code (Quick)</span>
              </button>

              <button
                tabIndex={0}
                onClick={() => setActiveMode('cookie')}
                className={`tv-pill-focusable px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
                  activeMode === 'cookie' ? 'bg-[#FA2D48] text-white' : 'text-white/60 hover:text-white'
                }`}
              >
                <Smartphone size={15} />
                <span>Cookie / Phone Pairing</span>
              </button>
            </div>

            {/* Mode 1: Google Device Code */}
            {activeMode === 'device' && (
              <div className="flex gap-8 items-center bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="shrink-0 flex flex-col items-center gap-2">
                  <div className="p-3 bg-white rounded-2xl shadow-xl">
                    <TvQrCode url={verificationUrl} size={150} />
                  </div>
                  <span className="text-[11px] font-medium text-white/50">Scan with Phone Camera</span>
                </div>

                <div className="flex-1 flex flex-col gap-3">
                  <h3 className="text-xl font-bold text-white">Log In with Google</h3>

                  <div className="space-y-1.5 text-xs text-white/70">
                    <p>1. Open <span className="text-[#FA2D48] font-bold underline">google.com/device</span> on your phone or PC</p>
                    <p>2. Enter this 8-character code:</p>
                  </div>

                  {/* High Visibility TV User Code Box */}
                  <div className="bg-black/50 border-2 border-red-500/40 rounded-2xl py-3 px-5 flex items-center justify-center tracking-[0.25em] text-2xl font-black text-white shadow-inner font-mono">
                    {isLoadingCode ? (
                      <span className="text-sm font-normal tracking-normal text-white/50 animate-pulse">
                        Generating code...
                      </span>
                    ) : (
                      deviceCode || 'LOADING...'
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-1 text-xs text-white/60">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                      <span>Waiting for approval on Google...</span>
                    </div>

                    <button
                      tabIndex={0}
                      onClick={loadDeviceCode}
                      className="tv-pill-focusable flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium"
                    >
                      <RefreshCw size={13} className={isLoadingCode ? 'animate-spin' : ''} />
                      <span>Refresh Code</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mode 2: Phone Pairing or Cookie Paste */}
            {activeMode === 'cookie' && (
              <div className="flex flex-col gap-5 bg-white/5 p-6 rounded-2xl border border-white/10">
                <div className="flex gap-6 items-center">
                  <div className="shrink-0 flex flex-col items-center gap-2">
                    <div className="p-2 bg-white rounded-2xl">
                      <TvQrCode url={pairingUrl} size={120} />
                    </div>
                    <span className="text-[10px] text-white/50">Mobile Pairing</span>
                  </div>

                  <div className="flex-1 flex flex-col gap-2">
                    <h4 className="text-base font-bold text-white">Option A: BitChord Remote Web App</h4>
                    <p className="text-xs text-white/60">
                      Connect to your local Wi-Fi and open <span className="text-[#FA2D48] font-bold">{pairingUrl}</span>.
                      Use the web remote to send your active session cookie with one tap.
                    </p>
                  </div>
                </div>

                <div className="border-t border-white/10 pt-4 flex flex-col gap-2">
                  <h4 className="text-sm font-bold text-white">Option B: Direct Cookie Paste</h4>
                  <p className="text-xs text-white/50">
                    Paste your YouTube Music session cookie (<code className="text-red-400">SAPISID</code> / <code className="text-red-400">__Secure-3PAPISID</code> / full cookie header).
                  </p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      tabIndex={0}
                      value={cookieInput}
                      onChange={(e) => setCookieInput(e.target.value)}
                      placeholder="Paste cookie string here..."
                      className="tv-focusable flex-1 bg-black/40 border border-white/20 rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/30 focus:border-[#FA2D48] outline-none"
                    />
                    <button
                      tabIndex={0}
                      disabled={isSubmittingCookie || !cookieInput.trim()}
                      onClick={handleCookieSubmit}
                      className={`tv-pill-focusable px-6 py-2.5 rounded-xl bg-[#FA2D48] text-white text-sm font-bold shadow-lg shadow-red-500/20 ${
                        isSubmittingCookie || !cookieInput.trim() ? 'opacity-40 cursor-not-allowed' : ''
                      }`}
                    >
                      {isSubmittingCookie ? 'Verifying...' : 'Submit'}
                    </button>
                  </div>
                  {cookieError && <p className="text-xs text-red-400 mt-1">{cookieError}</p>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
