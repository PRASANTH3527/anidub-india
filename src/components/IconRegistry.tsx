import React from 'react';

export type NavTabIconName = 'explore' | 'schedule' | 'library' | 'profile';

export interface SignatureIconProps {
  name: NavTabIconName;
  active?: boolean;
  className?: string;
  size?: number;
}

/**
 * AniDub Eclipse — Custom Signature SVG Icons
 * - 24x24 viewBox, 1.8px rounded strokes, optical alignment
 * - Outline variant when inactive (#A1A5B5 / currentColor)
 * - Duotone fill + crisp accent stroke variant when active (#B49AF8 / #CBB6FF)
 */
export const ExploreIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-5 h-5',
  size = 24,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Outer Compass Bezel */}
    <circle
      cx="12"
      cy="12"
      r="9"
      fill={active ? '#B49AF8' : 'none'}
      fillOpacity={active ? 0.18 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Cardinal Optical Ticks */}
    <path
      d="M12 3V4.5M12 19.5V21M3 12H4.5M19.5 12H21"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    {/* Discovery Diamond Needle */}
    <polygon
      points="15.8,8.2 13.7,13.7 8.2,15.8 10.3,10.3"
      fill={active ? '#B49AF8' : 'none'}
      fillOpacity={active ? 0.42 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Center Pivot */}
    <circle
      cx="12"
      cy="12"
      r="1.15"
      fill="currentColor"
    />
  </svg>
);

export const ScheduleIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-5 h-5',
  size = 24,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Calendar Body */}
    <rect
      x="3.5"
      y="5"
      width="17"
      height="15.5"
      rx="3"
      fill={active ? '#B49AF8' : 'none'}
      fillOpacity={active ? 0.16 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Top Header Band Fill (Duotone) */}
    {active && (
      <path
        d="M3.5 8C3.5 6.34315 4.84315 5 6.5 5H17.5C19.1569 5 20.5 6.34315 20.5 8V9.2H3.5V8Z"
        fill="#B49AF8"
        fillOpacity="0.28"
      />
    )}
    {/* Binding Rings & Header Divider */}
    <path
      d="M8 3.2V6.2M16 3.2V6.2M3.5 9.2H20.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Broadcast Play Triangle */}
    <polygon
      points="10.2,12.1 15.2,14.9 10.2,17.7"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const LibraryIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-5 h-5',
  size = 24,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Book 1 (Vertical Left) */}
    <rect
      x="3.5"
      y="4.5"
      width="4.2"
      height="15"
      rx="1.2"
      fill={active ? '#B49AF8' : 'none'}
      fillOpacity={active ? 0.24 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Book 2 (Vertical Middle) */}
    <rect
      x="9.3"
      y="4.5"
      width="4.2"
      height="15"
      rx="1.2"
      fill={active ? '#B49AF8' : 'none'}
      fillOpacity={active ? 0.36 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Book 3 (Tilted Right) */}
    <path
      d="M15.3 5.2L19.2 4.3C19.85 4.15 20.5 4.56 20.65 5.21L21.95 18.1C22.1 18.75 21.69 19.4 21.04 19.55L17.14 20.45C16.49 20.6 15.84 20.19 15.69 19.54L14.39 6.65C14.24 6 14.65 5.35 15.3 5.2Z"
      fill={active ? '#B49AF8' : 'none'}
      fillOpacity={active ? 0.2 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* Spine detail marks */}
    <path
      d="M5.6 8H5.61M11.4 8H11.41"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

export const ProfileIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-5 h-5',
  size = 24,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Outer Guardian Shield */}
    <path
      d="M12 3L19 6V11.6C19 16.15 16.02 19.98 12 21.2C7.98 19.98 5 16.15 5 11.6V6L12 3Z"
      fill={active ? '#B49AF8' : 'none'}
      fillOpacity={active ? 0.2 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* User Head Silhouette */}
    <circle
      cx="12"
      cy="10"
      r="2.4"
      fill={active ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {/* User Shoulders Arc */}
    <path
      d="M8.3 16.6C9.1 14.95 10.45 14.2 12 14.2C13.55 14.2 14.9 14.95 15.7 16.6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const SignatureNavIcon: React.FC<SignatureIconProps> = ({
  name,
  active = false,
  className = 'w-5 h-5',
  size = 24,
}) => {
  switch (name) {
    case 'explore':
      return <ExploreIcon active={active} className={className} size={size} />;
    case 'schedule':
      return <ScheduleIcon active={active} className={className} size={size} />;
    case 'library':
      return <LibraryIcon active={active} className={className} size={size} />;
    case 'profile':
      return <ProfileIcon active={active} className={className} size={size} />;
  }
};
