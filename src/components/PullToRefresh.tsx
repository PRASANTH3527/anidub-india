import React, { useState, useEffect, useRef } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'motion/react';
import { RefreshCw, Sparkles } from 'lucide-react';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: React.ReactNode;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({ onRefresh, children }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<number | null>(null);
  
  const MAX_PULL = 120;
  const THRESHOLD = 80;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (window.scrollY > 0 || isRefreshing) return;
    touchStartRef.current = e.touches[0].clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartRef.current === null || isRefreshing) return;
    
    const touchY = e.touches[0].clientY;
    const diff = touchY - touchStartRef.current;
    
    if (diff > 0 && window.scrollY <= 0) {
      // Apply resistance
      const distance = Math.min(MAX_PULL, diff * 0.5);
      setPullDistance(distance);
      
      // Prevent scrolling while pulling
      if (distance > 5 && e.cancelable) {
        e.preventDefault();
      }
    } else {
      setPullDistance(0);
    }
  };

  const handleTouchEnd = async () => {
    if (touchStartRef.current === null || isRefreshing) return;
    
    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true);
      setPullDistance(THRESHOLD); // Snap to threshold
      
      try {
        await onRefresh();
      } finally {
        setTimeout(() => {
          setIsRefreshing(false);
          setPullDistance(0);
        }, 600);
      }
    } else {
      setPullDistance(0);
    }
    
    touchStartRef.current = null;
  };

  return (
    <div 
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="relative w-full h-full"
    >
      {/* Anime Loader (Shuriken Style) */}
      <div 
        className="absolute top-0 left-0 right-0 flex justify-center pointer-events-none overflow-hidden"
        style={{ height: pullDistance }}
      >
        <motion.div
          animate={isRefreshing ? { rotate: 360 } : { rotate: (pullDistance / THRESHOLD) * 270 }}
          transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
          className="flex flex-col items-center justify-center pt-4"
          style={{ opacity: Math.min(1, pullDistance / (THRESHOLD * 0.8)) }}
        >
          <div className="relative flex items-center justify-center">
            {/* Outer Glowing Ring */}
            <div className={`absolute inset-0 w-10 h-10 -m-1 rounded-full border-2 border-dashed border-purple-500/30 ${isRefreshing ? 'animate-spin' : ''}`} />
            
            {/* Center Shuriken-like Icon */}
            <RefreshCw className={`w-8 h-8 ${pullDistance >= THRESHOLD ? 'text-purple-400 drop-shadow-[0_0_8px_rgba(167,139,250,0.6)]' : 'text-neutral-600'}`} />
            
            <Sparkles className="absolute -top-1 -right-1 w-4 h-4 text-amber-400 animate-pulse" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.2em] text-neutral-500 mt-2">
            {pullDistance >= THRESHOLD ? 'Release to Sync' : 'Sync Catalog'}
          </span>
        </motion.div>
      </div>

      {/* Main Content */}
      <motion.div
        animate={{ y: pullDistance }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </div>
  );
};
