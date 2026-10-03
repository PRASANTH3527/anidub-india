'use client';

import React, { useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';

interface ParallaxCardProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Apple TV Style 3D Parallax Card
 * 
 * Provides a premium 3D tilt effect with dynamic glare and parallax depth.
 */
export const ParallaxCard: React.FC<ParallaxCardProps> = ({ children, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // 1. Motion values to track pointer position (-0.5 to 0.5)
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // 2. Add springs for butter-smooth movement and automatic reset physics
  const springConfig = { damping: 20, stiffness: 150, mass: 0.5 };
  const xSpring = useSpring(x, springConfig);
  const ySpring = useSpring(y, springConfig);

  // 3. Transform values into rotation degrees (standard Apple TV tilt is ~10-15 deg)
  const rotateX = useTransform(ySpring, [-0.5, 0.5], [15, -15]);
  const rotateY = useTransform(xSpring, [-0.5, 0.5], [-15, 15]);

  // 4. Glare/Reflection movement logic
  // The glare follows the mouse but in a slightly different way to create "shimmer"
  const glareX = useTransform(xSpring, [-0.5, 0.5], ['0%', '100%']);
  const glareY = useTransform(ySpring, [-0.5, 0.5], ['0%', '100%']);
  const glareOpacity = useTransform(xSpring, [-0.5, 0, 0.5], [0.3, 0.1, 0.3]);

  // 5. Dynamic Shadow movement (moves opposite to tilt for depth)
  const shadowX = useTransform(xSpring, [-0.5, 0.5], [15, -15]);
  const shadowY = useTransform(ySpring, [-0.5, 0.5], [15, -15]);

  const handlePointerMove = (event: React.PointerEvent) => {
    if (!containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    
    // Calculate normalized position from -0.5 to 0.5
    const px = (event.clientX - rect.left) / rect.width;
    const py = (event.clientY - rect.top) / rect.height;
    
    x.set(px - 0.5);
    y.set(py - 0.5);
  };

  const handlePointerLeave = () => {
    // Reset to center smoothly thanks to useSpring
    x.set(0);
    y.set(0);
  };

  return (
    <div 
      className={`perspective-1000 ${className}`}
      style={{ perspective: '1200px' }}
    >
      <motion.div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerLeave}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
        }}
        className="relative w-full h-full rounded-2xl cursor-pointer"
      >
        {/* Dynamic Shadow Layer (Behind Content) */}
        <motion.div 
          className="absolute inset-4 rounded-2xl bg-black/60 blur-2xl z-0 pointer-events-none"
          style={{
            x: shadowX,
            y: shadowY,
            translateZ: '-20px',
          }}
        />

        {/* Main Content Container */}
        <div className="relative z-10 w-full h-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl bg-[#131926]">
          {children}

          {/* Apple Style Glare/Reflection Overlay */}
          <motion.div
            className="absolute inset-0 z-30 pointer-events-none"
            style={{
              background: useTransform(
                [glareX, glareY],
                ([gx, gy]) => `radial-gradient(circle at ${gx} ${gy}, rgba(255,255,255,0.15) 0%, transparent 60%)`
              ),
              opacity: glareOpacity,
            }}
          />
          
          {/* Edge Highlight (Linear glare for extra premium feel) */}
          <motion.div
            className="absolute inset-0 z-40 pointer-events-none bg-gradient-to-tr from-transparent via-white/5 to-transparent"
            style={{
              translateX: useTransform(xSpring, [-0.5, 0.5], ['-100%', '100%']),
              translateY: useTransform(ySpring, [-0.5, 0.5], ['-100%', '100%']),
            }}
          />
        </div>
      </motion.div>
    </div>
  );
};
