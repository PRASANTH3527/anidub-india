import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'elevated' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  active?: boolean;
  fullWidth?: boolean;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#B49AF8] hover:bg-[#CBB6FF] text-[#0B0A10] border border-[#B49AF8] font-bold',
  secondary:
    'bg-[#12141E] hover:bg-[#191C29] text-[#F4F3FA] border border-[#292B39] hover:border-[#B49AF8]/45 font-semibold',
  elevated:
    'bg-[#191C29] hover:bg-[#222637] text-[#F4F3FA] border border-[#292B39] hover:border-[#B49AF8]/45 font-semibold',
  ghost:
    'bg-transparent hover:bg-[#191C29] text-[#A1A5B5] hover:text-[#F4F3FA] border border-transparent font-medium',
  danger:
    'bg-[#F87171]/15 hover:bg-[#F87171]/25 text-[#F87171] border border-[#F87171]/40 font-semibold',
};

const ACTIVE_OVERRIDE_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[#B49AF8] text-[#0B0A10] border-[#CBB6FF]',
  secondary: 'bg-[#B49AF8]/15 text-[#F4F3FA] border-[#B49AF8]/60',
  elevated: 'bg-[#B49AF8]/15 text-[#F4F3FA] border-[#B49AF8]/60',
  ghost: 'bg-[#191C29] text-[#B49AF8] border-[#292B39]',
  danger: 'bg-[#F87171] text-[#0B0A10] border-[#F87171]',
};

/**
 * Standardized heights:
 * - sm: 40px (h-10, with min-h-[44px] on mobile viewports for touch ergonomics)
 * - md: 44px (h-11, min-h-[44px])
 * - lg: 48px (h-12, min-h-[48px])
 * - icon: 44x44px touch target on mobile, 40x40px on desktop
 */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-11 sm:h-10 min-h-[44px] sm:min-h-[40px] px-3.5 text-xs rounded-xl gap-1.5',
  md: 'h-11 min-h-[44px] px-4 text-xs sm:text-sm rounded-xl gap-2',
  lg: 'h-12 min-h-[48px] px-5 text-sm rounded-xl gap-2',
  icon: 'w-11 h-11 sm:w-10 sm:h-10 min-w-[44px] min-h-[44px] sm:min-w-[40px] sm:min-h-[40px] p-0 rounded-xl justify-center',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'secondary',
      size = 'md',
      leftIcon,
      rightIcon,
      active = false,
      fullWidth = false,
      className = '',
      children,
      type = 'button',
      ...rest
    },
    ref
  ) => {
    const baseClasses =
      'inline-flex items-center justify-center whitespace-nowrap shrink-0 select-none cursor-pointer transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#B49AF8]/70 disabled:opacity-45 disabled:pointer-events-none';
    const variantClasses = active
      ? ACTIVE_OVERRIDE_CLASSES[variant]
      : VARIANT_CLASSES[variant];
    const sizeClasses = SIZE_CLASSES[size];
    const widthClass = fullWidth ? 'w-full' : '';

    return (
      <button
        ref={ref}
        type={type}
        className={`${baseClasses} ${variantClasses} ${sizeClasses} ${widthClass} ${className}`.trim()}
        {...rest}
      >
        {leftIcon && <span className="shrink-0 inline-flex items-center">{leftIcon}</span>}
        {children}
        {rightIcon && <span className="shrink-0 inline-flex items-center">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
