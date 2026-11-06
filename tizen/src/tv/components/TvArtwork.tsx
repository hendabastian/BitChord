import React, { useState, useEffect } from 'react';
import { Music } from 'lucide-react';

interface TvArtworkProps {
  src?: string | null;
  alt?: string;
  fallbackVideoId?: string;
  className?: string;
  aspectRatio?: 'square' | 'wide' | 'circle';
  eager?: boolean;
}

export const TvArtwork: React.FC<TvArtworkProps> = ({
  src,
  alt = '',
  fallbackVideoId,
  className = '',
  aspectRatio = 'square',
  eager = false,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // Compute current image URL based on attempt
  const getUrl = (): string | null => {
    if (!src && !fallbackVideoId) return null;

    if (attempt === 0) {
      return src || (fallbackVideoId ? `https://i.ytimg.com/vi/${fallbackVideoId}/hqdefault.jpg` : null);
    }

    if (attempt === 1) {
      // If primary had size params, try original base, or try i.ytimg.com
      if (src && src.includes('=')) {
        return src.replace(/=[^/=]*$/, '=w226-h226-l90-rj');
      }
      if (fallbackVideoId) {
        return `https://i.ytimg.com/vi/${fallbackVideoId}/hqdefault.jpg`;
      }
    }

    if (attempt === 2) {
      if (fallbackVideoId) {
        return `https://i.ytimg.com/vi/${fallbackVideoId}/hqdefault.jpg`;
      }
    }

    return null;
  };

  const currentUrl = getUrl();

  useEffect(() => {
    setLoaded(false);
    setAttempt(0);
  }, [src, fallbackVideoId]);

  const shapeClass =
    aspectRatio === 'circle'
      ? 'rounded-full aspect-square'
      : aspectRatio === 'wide'
      ? 'rounded-[18px] aspect-[16/9]'
      : 'rounded-[18px] aspect-square';

  return (
    <div className={`relative overflow-hidden bg-[#16161a] ${shapeClass} ${className} select-none`}>
      {/* Background elegant placeholder */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-white/10 to-white/5 text-white/30">
        <Music size={aspectRatio === 'wide' ? 32 : 28} className="opacity-40" />
      </div>

      {currentUrl && attempt < 3 && (
        <img
          key={`${currentUrl}#${attempt}`}
          src={currentUrl}
          alt={alt}
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${
            loaded ? 'opacity-100' : 'opacity-0'
          }`}
          referrerPolicy="no-referrer"
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => {
            // Step to next attempt on failure
            setAttempt((prev) => prev + 1);
          }}
        />
      )}
    </div>
  );
};

