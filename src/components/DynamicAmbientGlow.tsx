import React from 'react';

export interface DynamicAmbientGlowProps {
  className?: string;
  blurClass?: string;
  isLoaded?: boolean;
  radialBackground?: string;
  children: React.ReactNode;
}

export const DynamicAmbientGlow: React.FC<DynamicAmbientGlowProps> = ({
  className = '',
  blurClass = 'blur-2xl',
  isLoaded = true,
  radialBackground,
  children
}) => {
  return (
    <div className={`relative ${className}`}>
      {/* GLOW DIV */}
      <div 
        className={`absolute -inset-4 sm:-inset-6 pointer-events-none rounded-3xl -z-10 ${blurClass} transition-all duration-700 ease-out will-change-[filter,opacity] ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
        style={radialBackground ? { background: radialBackground } : undefined}
      />
      {children}
    </div>
  );
};
