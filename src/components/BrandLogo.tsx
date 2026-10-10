import React from 'react';

interface BrandLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'dark' | 'light';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  variant = 'dark',
}) => {
  // Dimension presets optimized for mobile and desktop
  const dimensions = {
    sm: { icon: 28, fontSizeTitle: 'text-base', fontSizeSub: 'text-[8px]', tricolorW: 14 },
    md: { icon: 34, fontSizeTitle: 'text-lg sm:text-xl', fontSizeSub: 'text-[9px] sm:text-[10px]', tricolorW: 18 },
    lg: { icon: 44, fontSizeTitle: 'text-xl sm:text-2xl', fontSizeSub: 'text-xs', tricolorW: 24 },
    xl: { icon: 58, fontSizeTitle: 'text-3xl sm:text-4xl', fontSizeSub: 'text-sm', tricolorW: 32 },
  }[size];

  return (
    <div className={`flex items-center gap-1.5 sm:gap-2.5 select-none shrink-0 max-w-full box-border ${className}`}>
      {/* Brand Icon Mark */}
      <div 
        className="relative shrink-0 flex items-center justify-center transition-transform duration-200 group-hover:scale-105"
        style={{ width: dimensions.icon, height: dimensions.icon }}
      >
        <img
          src="/logo-mark.svg"
          alt="AniDub India Official Logo Mark"
          width={dimensions.icon}
          height={dimensions.icon}
          className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(245,78,0,0.35)]"
        />
      </div>

      {/* Brand Typography */}
      {showText && (
        <div className="flex flex-col leading-none shrink-0">
          <div className="flex items-baseline">
            <span className={`font-heading font-black tracking-tight text-[#ff5722] ${dimensions.fontSizeTitle} group-hover:text-[#ff6b00] transition-colors leading-tight`}>
              anidub
            </span>
          </div>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`font-black tracking-[0.22em] uppercase ${dimensions.fontSizeSub} ${variant === 'dark' ? 'text-neutral-100' : 'text-slate-900'} leading-none`}>
              INDIA
            </span>
            {/* Tricolor India Flag Bar */}
            <div className="flex items-center gap-0.5">
              <span className="w-1.5 h-1 rounded-sm bg-[#ff9933]" />
              <span className="w-1.5 h-1 rounded-sm bg-neutral-200" />
              <span className="w-1.5 h-1 rounded-sm bg-[#138808]" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
