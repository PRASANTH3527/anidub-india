import React from 'react';
import { Tv, Play, Youtube, Film } from 'lucide-react';

export interface PlatformIconProps {
  platform: string;
  className?: string;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({ platform, className = 'w-4 h-4' }) => {
  const lower = (platform || '').toLowerCase();

  if (lower.includes('youtube') || lower.includes('muse') || lower.includes('ani-one')) {
    return <Youtube className={className} />;
  }
  if (lower.includes('netflix') || lower.includes('prime') || lower.includes('sony')) {
    return <Film className={className} />;
  }
  if (lower.includes('crunchyroll') || lower.includes('hotstar') || lower.includes('jio')) {
    return <Play className={className} />;
  }
  return <Tv className={className} />;
};

export default PlatformIcon;
