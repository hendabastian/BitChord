import React, { useEffect, useRef } from 'react';
import { Tv, Sparkles, CheckCircle, ArrowRight } from 'lucide-react';
import { setFocusTrap, applyFocus } from '../../platform/spatialNav';

interface TvSetupModalProps {
  isOpen: boolean;
  onComplete: () => void;
  onOpenPlayer?: () => void;
}

export const TvSetupModal: React.FC<TvSetupModalProps> = ({ isOpen, onComplete }) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (isOpen && modalRef.current) {
      setFocusTrap(modalRef.current);
      if (startButtonRef.current) {
        applyFocus(startButtonRef.current);
      }
    }
    return () => {
      setFocusTrap(null);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#08080B]/95 backdrop-blur-2xl flex items-center justify-center p-12 select-none animate-in fade-in duration-300">
      <div
        ref={modalRef}
        className="max-w-[760px] w-full flex flex-col items-center text-center gap-8"
      >
        <div className="w-20 h-20 rounded-3xl bg-[#FA2D48] flex items-center justify-center text-white text-4xl font-black shadow-2xl shadow-red-500/40">
          ♪
        </div>

        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Welcome to BitChord for Samsung TV</h1>
          <p className="text-lg text-white/60 font-medium mt-2 max-w-[580px] mx-auto">
            Experience your music library, losslessly streamed with synchronized lyrics and remote-first navigation.
          </p>
        </div>

        {/* Remote Guide Cards */}
        <div className="grid grid-cols-3 gap-5 w-full text-left">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#FA2D48]">
              <Tv size={20} />
            </div>
            <h4 className="text-base font-bold text-white">5-Way D-Pad</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              Use Up, Down, Left, and Right to navigate between cards and tabs. Press OK / Enter to select.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#FA2D48]">
              <CheckCircle size={20} />
            </div>
            <h4 className="text-base font-bold text-white">Return / Back</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              Press Back to close players and dialogs, or return up to the top tab bar.
            </p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-[#FA2D48]">
              <Sparkles size={20} />
            </div>
            <h4 className="text-base font-bold text-white">Media Controls</h4>
            <p className="text-xs text-white/60 leading-relaxed">
              Use Play/Pause and Next/Prev buttons on your Samsung Smart Remote directly anytime.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            ref={startButtonRef}
            data-tv-autofocus="true"
            tabIndex={0}
            onClick={onComplete}
            className="tv-pill-focusable px-10 py-4 rounded-full bg-[#FA2D48] text-white text-lg font-bold shadow-2xl shadow-red-500/40 hover:scale-105 flex items-center gap-3"
          >
            <span>Start Listening</span>
            <ArrowRight size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};
