import React from 'react';

export interface AniDubLogoProps {
  variant?: 'horizontal' | 'stacked' | 'icon';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showSubtitle?: boolean;
  animated?: boolean;
  hideTrailingLine?: boolean;
}

export const AniDubLogo: React.FC<AniDubLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
  className = '',
  showSubtitle = true,
  animated = false,
  hideTrailingLine = false,
}) => {
  // Height sizing presets
  const heightClasses = {
    horizontal: {
      xs: 'h-6',
      sm: 'h-7 sm:h-8',
      md: 'h-8 sm:h-9',
      lg: 'h-10 sm:h-12',
      xl: 'h-14 sm:h-16',
    },
    stacked: {
      xs: 'h-16',
      sm: 'h-20',
      md: 'h-24 sm:h-28',
      lg: 'h-32 sm:h-36',
      xl: 'h-40 sm:h-48',
    },
    icon: {
      xs: 'h-5 w-6',
      sm: 'h-6 w-8',
      md: 'h-8 w-10',
      lg: 'h-10 w-13',
      xl: 'h-14 w-18',
    }
  };

  const selectedHeight = heightClasses[variant][size];

  // 1. ICON ONLY VARIANT
  if (variant === 'icon') {
    return (
      <svg
        viewBox="0 0 110 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={`${selectedHeight} w-auto object-contain select-none shrink-0 ${className}`}
        aria-label="AniDub India Icon"
        role="img"
      >
        <g transform="translate(6, 4)">
          {/* Orange Chat Bubble */}
          <path
            d="M 18,2 C 7,2 0,9 0,20 L 0,34 C 0,45 7,52 18,52 L 19,52 L 11,66 C 10,68 12,71 15,69 L 30,53 C 32,52 34,52 36,52 L 56,52 C 67,52 74,45 74,34 L 74,20 C 74,9 67,2 56,2 Z"
            fill="#FF6A00"
          />
          {/* Play Triangle */}
          <polygon points="30,17 30,39 49,28" fill="#0B0F17" />
          
          {/* Dual Voice / Dubbing Waves */}
          <path
            d="M 82,18 C 88,24 88,32 82,38"
            stroke="#FFFFFF"
            strokeWidth="5.5"
            strokeLinecap="round"
            className={animated ? 'animate-pulse' : ''}
          />
          <path
            d="M 93,10 C 104,20 104,36 93,46"
            stroke="#22C55E"
            strokeWidth="5.5"
            strokeLinecap="round"
            className={animated ? 'animate-pulse' : ''}
          />
        </g>
      </svg>
    );
  }

  // 2. STACKED VARIANT (Icon Centered on Top, ANIDUB in Middle, INDIA with Right Accent Line Below)
  // Perfectly matching the user's design reference
  if (variant === 'stacked') {
    return (
      <div className={`flex flex-col items-center justify-center select-none ${className}`}>
        <svg
          viewBox="0 0 320 280"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={`${selectedHeight} w-auto object-contain`}
          aria-label="ANIDUB INDIA Logo"
          role="img"
        >
          {/* Centered Speech Bubble + Waves */}
          <g transform="translate(108, 22)">
            <path
              d="M 18,2 C 7,2 0,9 0,20 L 0,34 C 0,45 7,52 18,52 L 19,52 L 11,66 C 10,68 12,71 15,69 L 30,53 C 32,52 34,52 36,52 L 56,52 C 67,52 74,45 74,34 L 74,20 C 74,9 67,2 56,2 Z"
              fill="#FF6A00"
            />
            <polygon points="30,17 30,39 49,28" fill="#0B0F17" />
            <path
              d="M 82,18 C 88,24 88,32 82,38"
              stroke="#FFFFFF"
              strokeWidth="5.5"
              strokeLinecap="round"
            />
            <path
              d="M 93,10 C 104,20 104,36 93,46"
              stroke="#22C55E"
              strokeWidth="5.5"
              strokeLinecap="round"
            />
          </g>

          {/* ANIDUB Title */}
          <g transform="translate(160, 182)">
            <text
              textAnchor="middle"
              fontFamily="'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontWeight="900"
              fontSize="52"
              letterSpacing="-1px"
            >
              <tspan fill="#FFFFFF">ANI</tspan>
              <tspan fill="#FF6A00">DUB</tspan>
            </text>

            {/* INDIA Subtitle + Modern Divider Line */}
            {showSubtitle && (
              <g transform="translate(-114, 28)">
                <text
                  x="0"
                  y="0"
                  fontFamily="'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                  fontWeight="800"
                  fontSize="13.5"
                  fill="#FFFFFF"
                  letterSpacing="6.5px"
                >
                  INDIA
                </text>
                <line
                  x1="80"
                  y1="-4.5"
                  x2="228"
                  y2="-4.5"
                  stroke="#4B5563"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            )}
          </g>
        </svg>
      </div>
    );
  }

  // 3. HORIZONTAL VARIANT (Icon on Left, ANIDUB & INDIA on Right)
  // Perfectly balanced for Navbars and compact headers
  return (
    <svg
      viewBox="0 0 320 72"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMinYMid meet"
      className={`${selectedHeight} w-auto object-contain select-none shrink-0 ${className}`}
      aria-label="ANIDUB INDIA Logo"
      role="img"
    >
      {/* Icon Lockup on Left */}
      <g transform="translate(6, 6)">
        <path
          d="M 18,2 C 7,2 0,9 0,20 L 0,32 C 0,43 7,50 18,50 L 19,50 L 12,62 C 11,64 13,66 15,65 L 28,51 C 29,50 31,50 33,50 L 52,50 C 63,50 70,43 70,32 L 70,20 C 70,9 63,2 52,2 Z"
          fill="#FF6A00"
        />
        <polygon points="28,16 28,36 46,26" fill="#0B0F17" />
        <path
          d="M 76,17 C 82,22 82,30 76,35"
          stroke="#FFFFFF"
          strokeWidth="5"
          strokeLinecap="round"
          className={animated ? 'animate-pulse' : ''}
        />
        <path
          d="M 86,10 C 96,19 96,33 86,42"
          stroke="#22C55E"
          strokeWidth="5"
          strokeLinecap="round"
          className={animated ? 'animate-pulse' : ''}
        />
      </g>

      {/* Typography Lockup on Right */}
      <g transform="translate(116, 0)">
        <text
          x="0"
          y="42"
          fontFamily="'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="900"
          fontSize="38"
          letterSpacing="-0.5px"
        >
          <tspan fill="#FFFFFF">ANI</tspan>
          <tspan fill="#FF6A00">DUB</tspan>
        </text>

        {showSubtitle && (
          <>
            <text
              x="2"
              y="60"
              fontFamily="'Space Grotesk', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
              fontWeight="800"
              fontSize="11"
              fill="#FFFFFF"
              letterSpacing="5.5px"
            >
              INDIA
            </text>
            {!hideTrailingLine && (
              <line
                x1="68"
                y1="56.5"
                x2="194"
                y2="56.5"
                stroke="#4B5563"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            )}
          </>
        )}
      </g>
    </svg>
  );
};
