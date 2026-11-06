import React from 'react';
import { Delete, CornerDownLeft, Space } from 'lucide-react';

interface TvVirtualKeyboardProps {
  onKeyPress: (char: string) => void;
  onBackspace: () => void;
  onClear: () => void;
  onSubmit: () => void;
}

export const TvVirtualKeyboard: React.FC<TvVirtualKeyboardProps> = ({
  onKeyPress,
  onBackspace,
  onClear,
  onSubmit,
}) => {
  const rows = [
    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
    ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
    ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', '-'],
    ['Z', 'X', 'C', 'V', 'B', 'N', 'M', '.', '_', '/'],
  ];

  return (
    <div className="flex flex-col gap-2.5 bg-white/5 border border-white/10 p-5 rounded-[24px] max-w-[680px]">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex gap-2 justify-center">
          {row.map((key) => (
            <button
              key={key}
              data-tv-autofocus={key === 'Q' ? 'true' : undefined}
              tabIndex={0}
              onClick={() => onKeyPress(key.toLowerCase())}
              className="tv-pill-focusable w-12 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-lg font-bold flex items-center justify-center select-none"
            >
              {key}
            </button>
          ))}
        </div>
      ))}

      {/* Action Row: Space, Backspace, Clear, Done */}
      <div className="flex gap-3 justify-center mt-2">
        <button
          tabIndex={0}
          onClick={() => onKeyPress(' ')}
          className="tv-pill-focusable px-8 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold flex items-center gap-2 select-none"
        >
          <Space size={18} />
          <span>Space</span>
        </button>

        <button
          tabIndex={0}
          onClick={onBackspace}
          className="tv-pill-focusable px-6 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold flex items-center gap-2 select-none"
        >
          <Delete size={18} />
          <span>Delete</span>
        </button>

        <button
          tabIndex={0}
          onClick={onClear}
          className="tv-pill-focusable px-5 h-12 rounded-xl bg-white/10 hover:bg-white/20 text-sm font-bold text-white/70 select-none"
        >
          Clear
        </button>

        <button
          tabIndex={0}
          onClick={onSubmit}
          className="tv-pill-focusable px-7 h-12 rounded-xl bg-[#FA2D48] text-white text-sm font-bold flex items-center gap-2 shadow-lg shadow-red-500/30 select-none"
        >
          <CornerDownLeft size={18} />
          <span>Search</span>
        </button>
      </div>
    </div>
  );
};
