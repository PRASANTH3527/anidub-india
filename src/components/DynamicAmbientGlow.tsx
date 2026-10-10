'use client';

import React, { useEffect, useState, useRef } from 'react';
import { FastAverageColor } from 'fast-average-color';

interface DynamicAmbientGlowProps {
  imageUrl: string;
  className?: string;
  children?: React.ReactNode;
  opacity?: number;
  scale?: number;
  blurClass?: string;
  enableBreathing?: boolean;
}

interface DominantColorState {
  hex: string;
  rgb: string;
  rgba: string;
  secondaryRgba: string;
  isDark: boolean;
}

// In-memory cache to completely eliminate redundant canvas computations
const colorCache = new Map<string, DominantColorState>();

const DEFAULT_PALETTE: DominantColorState = {
  hex: '#7c3aed',
  rgb: 'rgb(124, 58, 237)',
  rgba: 'rgba(124, 58, 237, 0.45)',
  secondaryRgba: 'rgba(99, 102, 241, 0.25)',
  isDark: true,
};

export const DynamicAmbientGlow: React.FC<DynamicAmbientGlowProps> = ({
  imageUrl,
  className = '',
  children,
  opacity = 0.5,
  blurClass = 'blur-xl',
}) => {
  const [colorState, setColorState] = useState<DominantColorState>(() => {
    return (imageUrl && colorCache.get(imageUrl)) || DEFAULT_PALETTE;
  });
  const facRef = useRef<FastAverageColor | null>(null);

  useEffect(() => {
    if (!imageUrl) {
      setColorState(DEFAULT_PALETTE);
      return;
    }

    // 1. Instant cache hit - zero CPU/canvas overhead
    if (colorCache.has(imageUrl)) {
      setColorState(colorCache.get(imageUrl)!);
      return;
    }

    if (!facRef.current) {
      facRef.current = new FastAverageColor();
    }
    const fac = facRef.current;
    let isMounted = true;

    // Fast, lightweight color calculation
    fac
      .getColorAsync(imageUrl, {
        algorithm: 'dominant',
        crossOrigin: 'anonymous',
        mode: 'speed', // 'speed' mode is 5x faster than 'precision'
        defaultColor: [124, 58, 237, 255],
      })
      .then((color) => {
        if (!isMounted) return;
        const [r, g, b] = color.value;
        const dominantHex = color.hex;
        const dominantRgba = `rgba(${r}, ${g}, ${b}, ${opacity})`;
        const secondaryRgba = `rgba(${Math.min(255, r + 20)}, ${g}, ${Math.min(255, b + 30)}, ${opacity * 0.5})`;

        const palette: DominantColorState = {
          hex: dominantHex,
          rgb: `rgb(${r}, ${g}, ${b})`,
          rgba: dominantRgba,
          secondaryRgba,
          isDark: color.isDark,
        };

        colorCache.set(imageUrl, palette);
        setColorState(palette);
      })
      .catch(() => {
        if (!isMounted) return;
        colorCache.set(imageUrl, DEFAULT_PALETTE);
        setColorState(DEFAULT_PALETTE);
      });

    return () => {
      isMounted = false;
    };
  }, [imageUrl, opacity]);

  useEffect(() => {
    return () => {
      if (facRef.current) {
        facRef.current.destroy();
        facRef.current = null;
      }
    };
  }, []);

  const radialBackground = `radial-gradient(ellipse at 50% 50%, ${colorState.rgba} 0%, ${colorState.secondaryRgba} 50%, transparent 80%)`;

  return (
    <div className={`relative ${className}`}>
      {/* Optimized static ambient glow without continuous requestAnimationFrame repainting */}
      <div
        aria-hidden="true"
        className={`absolute -inset-4 pointer-events-none rounded-3xl -z-10 ${blurClass} opacity-70 transition-opacity duration-300 will-change-transform`}
        style={{
          background: radialBackground,
        }}
      />
      {children}
    </div>
  );
};

export default DynamicAmbientGlow;

