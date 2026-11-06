import React, { useRef } from 'react';

interface TvShelfProps {
  title: string;
  subtitle?: string;
  index?: number;
  children: React.ReactNode;
}

export const TvShelf: React.FC<TvShelfProps> = ({ title, subtitle, index, children }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // When a card inside this shelf receives focus, smoothly scroll the shelf horizontally
  // to ensure generous margin and prevent off-screen focus cutting
  const handleFocusCapture = (e: React.FocusEvent) => {
    const container = scrollRef.current;
    const target = e.target as HTMLElement;
    if (!container || !target) return;

    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();

    const padding = 56;
    if (targetRect.left < containerRect.left + padding) {
      container.scrollTo({
        left: container.scrollLeft + (targetRect.left - containerRect.left - padding),
        behavior: 'smooth',
      });
    } else if (targetRect.right > containerRect.right - padding) {
      container.scrollTo({
        left: container.scrollLeft + (targetRect.right - containerRect.right + padding),
        behavior: 'smooth',
      });
    }
  };

  return (
    <section data-shelf-index={index} className="mb-10 scroll-mt-[100px]">
      <div className="mb-3.5 px-[56px] flex items-baseline justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="text-sm text-white/50 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>

      <div
        ref={scrollRef}
        onFocusCapture={handleFocusCapture}
        className="flex items-start gap-5 overflow-x-auto scroll-smooth px-[56px] py-3 no-scrollbar"
      >
        {children}
      </div>
    </section>
  );
};
