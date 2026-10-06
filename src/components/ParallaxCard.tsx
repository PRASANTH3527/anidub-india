'use client';

import React, { useRef, useState } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'motion/react';

interface ParallaxCardProps {
  children: React.ReactNode;
  className?: string;
  glareOpacity?: number;
}

export const ParallaxCard: React.FC<ParallaxCardProps> = ({ 
  children, 
  className = '',
  glareOpacity = 0.4
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  
  // Motion values for tilt
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  // Smooth springs for fluid motion
  const mouseXSpring = useSpring(x, { stiffness: 150, damping: 20 });
  const mouseYSpring = useSpring(y, { stiffness: 150, damping: 20 });

  // Transforms for 3D tilt
  const rotateX = useTransform(mouseYSpring, [-0.5, 0.5], ["10deg", "-10deg"]);
  const rotateY = useTransform(mouseXSpring, [-0.5, 0.5], ["-10deg", "10deg"]);

  // Glare effect transforms
  const glareX = useTransform(mouseXSpring, [-0.5, 0.5], ["0%", "100%"]);
  const glareY = useTransform(mouseYSpring, [-0.5, 0.5], ["0%", "100%"]);

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;

    const rect = cardRef.current.getBoundingClientRect();
    const width = rect.width;
    const height = rect.height;
    
    // Calculate normalized mouse position from -0.5 to 0.5
    const mouseX = (event.clientX - rect.left) / width - 0.5;
    const mouseY = (event.clientY - rect.top) / height - 0.5;

    x.set(mouseX);
    y.set(mouseY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`perspective-1000 ${className}`}
      style={{ perspective: '1000px' }}
    >
      <motion.div
        style={{
          rotateX,
          rotateY,
          transformStyle: "preserve-3d",
        }}
        className="relative w-full h-full"
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Main Content */}
        <div className="w-full h-full relative z-10 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl">
          {children}
          
          {/* Dynamic Glare Effect */}
          <motion.div
            style={{
              background: `radial-gradient(circle at var(--glare-x) var(--glare-y), rgba(255, 255, 255, ${glareOpacity}) 0%, transparent 70%)`,
              "--glare-x": glareX,
              "--glare-y": glareY,
            } as any}
            className="absolute inset-0 pointer-events-none z-20 mix-blend-soft-light opacity-0 group-hover:opacity-100 transition-opacity duration-300"
          />
        </div>

        {/* 3D Reflection Highlight */}
        <div 
          className="absolute inset-0 z-0 rounded-2xl bg-gradient-to-br from-white/10 to-transparent pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500" 
          style={{ transform: "translateZ(-10px)" }}
        />
      </motion.div>
    </div>
  );
};
