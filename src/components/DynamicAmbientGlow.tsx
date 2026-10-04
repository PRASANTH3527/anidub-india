'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FastAverageColor, FastAverageColorResult } from 'fast-average-color';

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

// Default luxury anime aesthetic fallback palette (vibrant purple-indigo)
const DEFAULT_PALETTE: DominantColorState = {
  hex: '#7c3aed',
  rgb: 'rgb(124, 58, 237)',
  rgba: 'rgba(124, 58, 237, 0.65)',
  secondaryRgba: 'rgba(99, 102, 241, 0.35)',
  isDark: true,
};

export const DynamicAmbientGlow: React.FC<DynamicAmbientGlowProps> = ({
  imageUrl,
  className = '',
  children,
  opacity = 0.7,
  scale = 1.18,
  blurClass = 'blur-3xl',
  enableBreathing = true,
}) => {
  const [colorState, setColorState] = useState<DominantColorState>(DEFAULT_PALETTE);
  const [isColorReady, setIsColorReady] = useState(false);
  const facRef = useRef<FastAverageColor | null>(null);

  useEffect(() => {
    if (!facRef.current) {
      facRef.current = new FastAverageColor();
    }
    const fac = facRef.current;

    let isMounted = true;
    setIsColorReady(false);

    if (!imageUrl) {
      setColorState(DEFAULT_PALETTE);
      setIsColorReady(true);
      return;
    }

    // Extract dominant color safely
    fac
      .getColorAsync(imageUrl, {
        algorithm: 'dominant',
        crossOrigin: 'anonymous',
        mode: 'precision',
        defaultColor: [124, 58, 237, 255], // AniDub primary purple
      })
      .then((color: FastAverageColorResult) => {
        if (!isMounted) return;

        const [r, g, b] = color.value;
        // Boost vibrance slightly if too dark/muddy for Spotify/Apple TV neon glow feel
        const maxVal = Math.max(r, g, b);
        const boostFactor = maxVal < 100 ? 1.6 : maxVal < 160 ? 1.25 : 1.0;
        const adjR = Math.min(255, Math.round(r * boostFactor));
        const adjG = Math.min(255, Math.round(g * boostFactor));
        const adjB = Math.min(255, Math.round(b * boostFactor));

        const dominantHex = color.hex;
        const dominantRgba = `rgba(${adjR}, ${adjG}, ${adjB}, ${opacity})`;
        // Secondary harmonic glow with slight hue offset
        const secondaryRgba = `rgba(${Math.min(255, adjR + 30)}, ${Math.max(0, adjG - 20)}, ${Math.min(255, adjB + 50)}, ${opacity * 0.55})`;

        setColorState({
          hex: dominantHex,
          rgb: `rgb(${adjR}, ${adjG}, ${adjB})`,
          rgba: dominantRgba,
          secondaryRgba,
          isDark: color.isDark,
        });
        setIsColorReady(true);
      })
      .catch((err) => {
        // Graceful fallback on CORS restriction or network error
        if (!isMounted) return;
        console.warn('[DynamicAmbientGlow] Fallback to default palette:', err?.message || err);
        setColorState(DEFAULT_PALETTE);
        setIsColorReady(true);
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

  // Ambient radial gradient matching Spotify / Apple TV glow architecture
  const radialBackground = `radial-gradient(ellipse at 50% 50%, ${colorState.rgba} 0%, ${colorState.secondaryRgba} 42%, rgba(11, 15, 23, 0) 72%)`;

  return (
    <div className={`relative ${className}`}>
      {/* Dynamic Animated Ambient Radial Glow Behind Poster */}
      <AnimatePresence mode="wait">
        <motion.div
          key={`ambient-glow-${colorState.hex}-${imageUrl}`}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={
            enableBreathing
              ? {
                  opacity: [opacity * 0.85, opacity * 1.08, opacity * 0.85],
                  scale: [scale * 0.97, scale * 1.03, scale * 0.97],
                }
              : { opacity, scale }
          }
          exit={{ opacity: 0, scale: 0.9 }}
          transition={
            enableBreathing
              ? {
                  duration: 5.5,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }
              : { duration: 0.6, ease: 'easeOut' }
          }
          aria-hidden="true"
          className={`absolute -inset-4 sm:-inset-8 pointer-events-none rounded-[36px] -z-10 ${blurClass} overflow-hidden`}
          style={{
            background: radialBackground,
            filter: 'contrast(125%) saturate(140%)',
          }}
        >
          {/* Subtle secondary light ray highlight for cinematic depth */}
          <div
            className="absolute inset-0 opacity-40 mix-blend-screen"
            style={{
              background: `conic-gradient(from 180deg at 50% 50%, transparent 0deg, ${colorState.hex} 120deg, transparent 240deg, ${colorState.secondaryRgba} 360deg)`,
            }}
          />
        </motion.div>
      </AnimatePresence>

      {/* Render children (e.g. Poster Card or details) */}
      {children}
    </div>
  );
};

export default DynamicAmbientGlow;
