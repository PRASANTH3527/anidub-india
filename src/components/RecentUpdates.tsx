import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Bell, Calendar } from 'lucide-react';
import { RECENT_NEWS } from '../data/newsData';

export const RecentUpdates: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (RECENT_NEWS.length === 0) {
    return null;
  }

  // Auto cycle every 6 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % RECENT_NEWS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  const currentNews = RECENT_NEWS[currentIndex];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + RECENT_NEWS.length) % RECENT_NEWS.length);
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % RECENT_NEWS.length);
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4 my-8">
      <div className="bg-[#131926] border border-neutral-800 rounded-2xl p-4 sm:p-5 relative overflow-hidden shadow-lg">
        
        {/* Header line */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300">
              Recent Updates
            </h3>
          </div>

          {/* Dots Indicator */}
          <div className="flex items-center gap-1.5">
            {RECENT_NEWS.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIndex(i)}
                className={`transition-all duration-300 rounded-full ${
                  i === currentIndex
                    ? 'w-5 h-1.5 bg-primary-theme'
                    : 'w-1.5 h-1.5 bg-neutral-700 hover:bg-neutral-600'
                }`}
                title={`Update ${i + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Current Active Item */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 min-h-[44px]">
          <div className="flex items-start sm:items-center gap-3">
            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded badge-primary-theme shrink-0">
              {currentNews.tag}
            </span>
            <p className="text-sm font-semibold text-neutral-200 line-clamp-2">
              {currentNews.title}
            </p>
          </div>

          <div className="flex items-center gap-4 shrink-0 text-xs text-neutral-400">
            <span className="text-[11px] font-medium text-neutral-400">
              {currentNews.date}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={handlePrev}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title="Previous update"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={handleNext}
                className="p-1 rounded hover:bg-neutral-800 text-neutral-400 hover:text-white transition-colors"
                title="Next update"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
