import React from 'react';

export type FeatureBarIconName = 'foryou' | 'compare' | 'tierlist' | 'chat' | 'submit';
export type NavTabIconName =
  | 'explore'
  | 'schedule'
  | 'library'
  | 'profile'
  | FeatureBarIconName
  | 'search';

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
  className = 'w-6 h-6',
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
    <circle
      cx="12"
      cy="12"
      r="9"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.18 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 3V4.5M12 19.5V21M3 12H4.5M19.5 12H21"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
    <polygon
      points="15.8,8.2 13.7,13.7 8.2,15.8 10.3,10.3"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.42 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="12" cy="12" r="1.15" fill="currentColor" />
  </svg>
);

export const ScheduleIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-6 h-6',
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
    <rect
      x="3.5"
      y="5"
      width="17"
      height="15.5"
      rx="3"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.16 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    {active && (
      <path
        d="M3.5 8C3.5 6.34315 4.84315 5 6.5 5H17.5C19.1569 5 20.5 6.34315 20.5 8V9.2H3.5V8Z"
        fill="var(--accent-primary)"
        fillOpacity="0.28"
      />
    )}
    <path
      d="M8 3.2V6.2M16 3.2V6.2M3.5 9.2H20.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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
  className = 'w-6 h-6',
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
    <rect
      x="3.5"
      y="4.5"
      width="4.2"
      height="15"
      rx="1.2"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.24 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="9.3"
      y="4.5"
      width="4.2"
      height="15"
      rx="1.2"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.36 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M15.3 5.2L19.2 4.3C19.85 4.15 20.5 4.56 20.65 5.21L21.95 18.1C22.1 18.75 21.69 19.4 21.04 19.55L17.14 20.45C16.49 20.6 15.84 20.19 15.69 19.54L14.39 6.65C14.24 6 14.65 5.35 15.3 5.2Z"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.2 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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
  className = 'w-6 h-6',
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
    <path
      d="M12 3L19 6V11.6C19 16.15 16.02 19.98 12 21.2C7.98 19.98 5 16.15 5 11.6V6L12 3Z"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.2 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
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
    <path
      d="M8.3 16.6C9.1 14.95 10.45 14.2 12 14.2C13.55 14.2 14.9 14.95 15.7 16.6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 1. For You (Matchmaker) — Custom SVG Duotone Sparkle Icon
 */
export const ForYouIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-6 h-6',
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
    <path
      d="M12 3L14.2 8.8L20 11L14.2 13.2L12 19L9.8 13.2L4 11L9.8 8.8L12 3Z"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.28 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M19 3.5V6.5M17.5 5H20.5M5.5 17.5V20.5M4 19H7"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 2. Compare (Compare Anime) — Custom SVG Duotone Balance/Compare Icon
 */
export const CompareIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-6 h-6',
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
    <path
      d="M12 3V21M8 21H16M4 7H20"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M5.5 7L3 13.5H8L5.5 7Z"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.28 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M18.5 7L16 13.5H21L18.5 7Z"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.28 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M3 13.5C3 15 4.1 16 5.5 16C6.9 16 8 15 8 13.5M16 13.5C16 15 17.1 16 18.5 16C19.9 16 21 15 21 13.5"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.22 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 3. Tier List (Tier List Maker) — Custom SVG Duotone Trophy/Tier Icon
 */
export const TierListIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-6 h-6',
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
    <path
      d="M7 4H17V9C17 11.7614 14.7614 14 12 14C9.23858 14 7 11.7614 7 9V4Z"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.26 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M7 6H4.5C3.95 6 3.5 6.45 3.5 7V8C3.5 9.93 5.07 11.5 7 11.5M17 6H19.5C20.05 6 20.5 6.45 20.5 7V8C20.5 9.93 18.93 11.5 17 11.5"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 14V17.5M8 20.5H16"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect
      x="9"
      y="17.5"
      width="6"
      height="3"
      rx="1"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.35 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 4. Chat (Community Chat) — Custom SVG Duotone Chat Icon
 */
export const ChatIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-6 h-6',
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
    <path
      d="M5 5.5H19C20.1046 5.5 21 6.39543 21 7.5V14.5C21 15.6046 20.1046 16.5 19 16.5H9.5L4.5 20V16.5C3.67157 16.5 3 15.8284 3 15V7.5C3 6.39543 3.89543 5.5 5 5.5Z"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.24 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 10H16M8 13H13"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * 5. Submit (Submit Anime / Dub) — Custom SVG Duotone Upload/Plus Icon
 */
export const SubmitIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-6 h-6',
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
    <rect
      x="3.5"
      y="3.5"
      width="17"
      height="17"
      rx="4.5"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.24 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 8V16M8 12H16"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/**
 * Search Shortcut Icon — Custom SVG Duotone Search Icon
 */
export const SearchNavIcon: React.FC<{ active?: boolean; className?: string; size?: number }> = ({
  active = false,
  className = 'w-6 h-6',
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
    <circle
      cx="11"
      cy="11"
      r="6.5"
      fill={active ? 'var(--accent-primary)' : 'none'}
      fillOpacity={active ? 0.22 : 0}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M16 16L20.5 20.5"
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
  className = 'w-6 h-6',
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
    case 'foryou':
      return <ForYouIcon active={active} className={className} size={size} />;
    case 'compare':
      return <CompareIcon active={active} className={className} size={size} />;
    case 'tierlist':
      return <TierListIcon active={active} className={className} size={size} />;
    case 'chat':
      return <ChatIcon active={active} className={className} size={size} />;
    case 'submit':
      return <SubmitIcon active={active} className={className} size={size} />;
    case 'search':
      return <SearchNavIcon active={active} className={className} size={size} />;
  }
};
