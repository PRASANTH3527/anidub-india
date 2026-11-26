import React from 'react';

export interface AniDubLogoProps {
  variant?: 'horizontal' | 'stacked' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
  showText?: boolean;
  animated?: boolean;
  hideTrailingLine?: boolean;
}

export const AniDubLogo: React.FC<AniDubLogoProps> = ({
  className = '',
}) => {
  return (
    <img
      src="/logo.png?v=2"
      alt="AniDub India"
      loading="eager"
      style={{ objectFit: 'contain' }}
      className={`w-auto select-none shrink-0 h-[36px] max-w-[140px] md:h-[40px] md:max-w-[160px] lg:h-[44px] lg:max-w-[180px] ${className}`}
    />
  );
};
