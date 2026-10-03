'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface ParallaxCardProps {
  children: React.ReactNode;
  className?: string;
  enableGyroscope?: boolean;
  maxTilt?: number;
}

/**
 * 3D Tilt Anime Card Component with Framer Motion
 * 
 * Features:
 * - Fluid pointer & touch-based 3D tilt physics (responsive on mobile & desktop)
 * - Spring-damped return with zero jitter (mass: 0.5, stiffness: 220, damping: 20)
 * - Specular holographic glare / shimmer reflection tracking the light angle
 * - Reactive counter-shadow providing tangible elevation in 3D space
 * - Optional mobile DeviceOrientation (gyroscope) subtle tilt
 * - Multi-layer z-depth preservation (preserve-3d)
 */
export const ParallaxCard: React.FC<ParallaxCardProps> = ({ 
  children, 
  className = '',
  enableGyroscope = false,
  maxTilt = 16
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  // 1. Normalized motion coordinates (-0.5 to 0.5)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // 2. High-performance spring physics for ultra-smooth responsiveness
  const springConfig = { damping: 22, stiffness: 220, mass: 0.45 };
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);

  // 3. Transform values into 3D rotations
  const rotateX = useTransform(ySpring, [-0.5, 0.5], [maxTilt, -maxTilt]);
  const rotateY = useTransform(xSpring, [-0.5, 0.5], [-maxTilt, maxTilt]);

  // 4. Glare / Specular holographic highlight coordinate transforms
  const glareX = useTransform(xSpring, [-0.5, 0.5], ['0%', '100%']);
  const glareY = useTransform(ySpring, [-0.5, 0.5], ['0%', '100%']);
  const glareOpacity = useTransform(xSpring, [-0.5, 0, 0.5], [0.35, 0.08, 0.35]);

  // 5. Dynamic 3D depth shadow (moves in opposing direction to create lighting illusion)
  const shadowX = useTransform(xSpring, [-0.5, 0.5], [18, -18]);
  const shadowY = useTransform(ySpring, [-0.5, 0.5], [22, -22]);
  const shadowBlur = useTransform(ySpring, [-0.5, 0, 0.5], ['32px', '16px', '32px']);

  // Pointer & Touch Move handler
  const handlePointerMove = useCallback((event: React.PointerEvent) => {
    if (!containerRef.current) return;
    setIsHovered(true);

    const rect = containerRef.current.getBoundingClientRect();
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;

    // Clamp coordinates cleanly to prevent overshoot
    const clampedX = Math.max(0, Math.min(1, px));
    const clampedY = Math.max(0, Math.min(1, py));

    x.set(clampedX - 0.5);
    y.set(clampedY - 0.5);
  }, [x, y]);

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false);
    // Smooth reset via spring physics
    x.set(0);
    y.set(0);
  }, [x, y]);

  // Optional subtle mobile gyroscope tilt
  useEffect(() => {
    if (!enableGyroscope || typeof window === 'undefined') return;

    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (isHovered) return; // User touch/pointer takes precedence
      if (e.gamma !== null && e.beta !== null) {
        // gamma: left-to-right (-90 to 90), beta: front-to-back (-180 to 180)
        const normX = Math.max(-0.5, Math.min(0.5, e.gamma / 60));
        const normY = Math.max(-0.5, Math.min(0.5, (e.beta - 45) / 60));
        x.set(normX);
        y.set(normY);
      }
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, [enableGyroscope, isHovered, x, y]);

  return (
    <div 
      className={`relative select-none ${className}`}
      style={{ perspective: '1100px' }}
    >
      <motion.div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerCancel={handlePointerLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        whileTap={{ scale: 0.985 }}
        className="relative w-full h-full rounded-2xl cursor-pointer transform-gpu will-change-transform"
      >
        {/* Dynamic 3D Drop Shadow behind Card */}
        <motion.div 
          className="absolute inset-2 rounded-2xl bg-black/60 z-0 pointer-events-none transition-opacity duration-300"
          style={{
            x: shadowX,
            y: shadowY,
            filter: useTransform(shadowBlur, (b) => `blur(${b})`),
            translateZ: '-30px',
            opacity: isHovered ? 0.75 : 0.45,
          }}
        />

        {/* Ambient Color Glow Border Accent */}
        <motion.div
          className="absolute -inset-[1px] rounded-2xl bg-gradient-to-tr from-purple-500/20 via-sky-500/10 to-transparent pointer-events-none z-10"
          style={{
            opacity: isHovered ? 0.9 : 0.2,
            transition: 'opacity 0.25s ease',
          }}
        />

        {/* Card Content Outer Container */}
        <div 
          className="relative z-20 w-full h-full rounded-2xl overflow-hidden border border-white/10 bg-[#131926] shadow-xl"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {children}

          {/* Holographic Glare / Specular Sheen Layer */}
          <motion.div
            className="absolute inset-0 z-40 pointer-events-none transition-opacity duration-300"
            style={{
              background: useTransform(
                [glareX, glareY],
                ([gx, gy]) =>
                  `radial-gradient(circle 380px at ${gx} ${gy}, rgba(255,255,255,0.2) 0%, rgba(168,85,247,0.08) 35%, transparent 70%)`
              ),
              opacity: isHovered ? glareOpacity : 0,
            }}
          />

          {/* Premium Diagonal Sheen Angle */}
          <motion.div
            className="absolute inset-0 z-40 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-transparent"
            style={{
              translateX: useTransform(xSpring, [-0.5, 0.5], ['-80%', '80%']),
              translateY: useTransform(ySpring, [-0.5, 0.5], ['-80%', '80%']),
              opacity: isHovered ? 0.8 : 0,
            }}
          />
        </div>
      </motion.div>
    </div>
  );
};

export default ParallaxCard;
