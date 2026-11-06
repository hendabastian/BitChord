import React from 'react';

interface TvCardSkeletonProps {
  width?: string;
  aspectRatio?: 'square' | 'wide' | 'circle';
}

export const TvCardSkeleton: React.FC<TvCardSkeletonProps> = ({
  width = 'w-[220px]',
  aspectRatio = 'square',
}) => {
  const shapeClass =
    aspectRatio === 'circle'
      ? 'rounded-full aspect-square'
      : aspectRatio === 'wide'
      ? 'rounded-[18px] aspect-[16/9]'
      : 'rounded-[18px] aspect-square';

  return (
    <div className={`flex flex-col text-left ${width} shrink-0 p-2.5 rounded-[22px] bg-white/[0.02]`}>
      <div className={`w-full overflow-hidden bg-white/5 animate-pulse ${shapeClass} shadow-md`} />
      <div className="mt-3 px-1 flex flex-col gap-2">
        <div className="h-4 w-4/5 bg-white/10 rounded-md animate-pulse" />
        <div className="h-3 w-1/2 bg-white/5 rounded-md animate-pulse" />
      </div>
    </div>
  );
};

interface TvShelfSkeletonProps {
  title?: string;
  subtitle?: string;
  count?: number;
  width?: string;
  aspectRatio?: 'square' | 'wide' | 'circle';
}

export const TvShelfSkeleton: React.FC<TvShelfSkeletonProps> = ({
  title,
  subtitle,
  count = 6,
  width = 'w-[220px]',
  aspectRatio = 'square',
}) => {
  return (
    <section className="mb-10 px-[56px] select-none">
      <div className="mb-4">
        {title ? (
          <h2 className="text-2xl font-bold tracking-tight text-white/90">{title}</h2>
        ) : (
          <div className="h-7 w-48 bg-white/10 rounded-lg animate-pulse mb-1" />
        )}
        {subtitle ? (
          <p className="text-sm text-white/40 font-medium mt-0.5">{subtitle}</p>
        ) : (
          <div className="h-4 w-72 bg-white/5 rounded-md animate-pulse mt-1" />
        )}
      </div>

      <div className="flex gap-5 overflow-hidden py-2">
        {Array.from({ length: count }).map((_, idx) => (
          <TvCardSkeleton key={idx} width={width} aspectRatio={aspectRatio} />
        ))}
      </div>
    </section>
  );
};

export const TvTracklistSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => {
  return (
    <div className="flex flex-col gap-2 max-w-[1200px]">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.03] animate-pulse"
        >
          <div className="flex items-center gap-4">
            <div className="w-8 h-4 bg-white/10 rounded text-center" />
            <div className="w-12 h-12 rounded-xl bg-white/5 shrink-0" />
            <div className="flex flex-col gap-2">
              <div className="h-4 w-52 bg-white/10 rounded" />
              <div className="h-3 w-32 bg-white/5 rounded" />
            </div>
          </div>
          <div className="w-10 h-3 bg-white/5 rounded mr-4" />
        </div>
      ))}
    </div>
  );
};

