'use client';

import React from 'react';

interface ParallaxCardProps {
  children: React.ReactNode;
  className?: string;
  glareOpacity?: number;
}

export const ParallaxCard: React.FC<ParallaxCardProps> = ({ 
  children, 
  className = '',
}) => {
  return (
    <div className={`group transition-transform duration-200 ease-out sm:hover:-translate-y-1 ${className}`}>
      {/* Optimized GPU-composited container */}
      <div className="w-full h-full relative overflow-hidden rounded-2xl border border-white/10 bg-[#131926] shadow-xl transition-shadow duration-200 group-hover:shadow-2xl group-hover:border-primary-theme/40">
        {children}
      </div>
    </div>
  );
};

