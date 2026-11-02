import React from 'react';

interface AniDubLogoProps {
  className?: string;
  variant?: 'horizontal' | 'stacked' | 'icon';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const AniDubLogo: React.FC<AniDubLogoProps> = ({
  className = '',
  variant = 'horizontal',
  size = 'md'
}) => {
  // Height sizing presets for horizontal lockup
  const heightClasses = {
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-12',
    xl: 'h-16'
  }[size];

  if (variant === 'icon') {
    return (
      <svg 
        viewBox="0 0 96 66" 
        className={`${heightClasses} w-auto object-contain shrink-0 ${className}`}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        aria-label="ANIDUB Icon"
      >
        {/* Orange Chat Bubble */}
        <path 
          d="M 18,2 C 8,2 2,8 2,18 L 2,34 C 2,44 8,50 18,50 L 20,50 L 14,60 C 13,62 15,64 17,63 L 29,51 C 30,50 32,50 34,50 L 52,50 C 62,50 68,44 68,34 L 68,18 C 68,8 62,2 52,2 Z" 
          fill="#FF6A00" 
        />
        {/* Play Triangle Inside Bubble */}
        <polygon points="28,17 28,35 44,26" fill="#0B0F17" />
        
        {/* Inner Sound Wave Arc (White) */}
        <path 
          d="M 74,18 C 79,23 79,29 74,34" 
          stroke="#FFFFFF" 
          strokeWidth="4.5" 
          strokeLinecap="round" 
        />
        
        {/* Outer Sound Wave Arc (Vibrant Green) */}
        <path 
          d="M 83,11 C 92,20 92,32 83,41" 
          stroke="#22C55E" 
          strokeWidth="4.5" 
          strokeLinecap="round" 
        />
      </svg>
    );
  }

  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center select-none ${className}`}>
        {/* Centered Top Icon */}
        <svg 
          viewBox="0 0 96 66" 
          className="w-16 h-12 object-contain shrink-0 drop-shadow-[0_4px_16px_rgba(255,106,0,0.3)]"
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          <path 
            d="M 18,2 C 8,2 2,8 2,18 L 2,34 C 2,44 8,50 18,50 L 20,50 L 14,60 C 13,62 15,64 17,63 L 29,51 C 30,50 32,50 34,50 L 52,50 C 62,50 68,44 68,34 L 68,18 C 68,8 62,2 52,2 Z" 
            fill="#FF6A00" 
          />
          <polygon points="28,17 28,35 44,26" fill="#0B0F17" />
          <path d="M 74,18 C 79,23 79,29 74,34" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
          <path d="M 83,11 C 92,20 92,32 83,41" stroke="#22C55E" strokeWidth="4.5" strokeLinecap="round" />
        </svg>

        {/* Wordmark */}
        <div className="mt-2 text-center">
          <div className="font-heading font-black text-3xl sm:text-4xl tracking-tight leading-none">
            <span className="text-white">ANI</span>
            <span className="text-[#FF6A00]">DUB</span>
          </div>
          <div className="flex items-center justify-center gap-2 mt-1.5 w-full">
            <span className="text-[10px] sm:text-xs font-bold tracking-[0.3em] text-white uppercase ml-0.5">
              INDIA
            </span>
            <div className="flex-1 h-[1.5px] bg-neutral-600/80 rounded-full" />
          </div>
        </div>
      </div>
    );
  }

  // Default: Horizontal Lockup (Designed specifically for the Navbar & header)
  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Icon Mark */}
      <svg 
        viewBox="0 0 96 66" 
        className={`${heightClasses} w-auto object-contain shrink-0 transition-transform duration-300 group-hover:scale-105 drop-shadow-[0_2px_12px_rgba(255,106,0,0.25)]`}
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path 
          d="M 18,2 C 8,2 2,8 2,18 L 2,34 C 2,44 8,50 18,50 L 20,50 L 14,60 C 13,62 15,64 17,63 L 29,51 C 30,50 32,50 34,50 L 52,50 C 62,50 68,44 68,34 L 68,18 C 68,8 62,2 52,2 Z" 
          fill="#FF6A00" 
        />
        <polygon points="28,17 28,35 44,26" fill="#0B0F17" />
        <path d="M 74,18 C 79,23 79,29 74,34" stroke="#FFFFFF" strokeWidth="4.5" strokeLinecap="round" />
        <path d="M 83,11 C 92,20 92,32 83,41" stroke="#22C55E" strokeWidth="4.5" strokeLinecap="round" />
      </svg>

      {/* Typography Lockup */}
      <div className="flex flex-col justify-center leading-none">
        <div className="font-heading font-black text-xl sm:text-2xl tracking-tight flex items-center">
          <span className="text-white drop-shadow-[0_2px_8px_rgba(255,255,255,0.15)]">ANI</span>
          <span className="text-[#FF6A00] drop-shadow-[0_2px_8px_rgba(255,106,0,0.3)]">DUB</span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5 w-full">
          <span className="text-[8.5px] sm:text-[9.5px] font-extrabold tracking-[0.28em] text-white uppercase opacity-95">
            INDIA
          </span>
          <span className="flex-1 h-[1.5px] min-w-[20px] bg-neutral-600/90 rounded-full" />
        </div>
      </div>
    </div>
  );
};
