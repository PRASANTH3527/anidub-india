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
    'bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-[var(--accent-on-primary)] border border-[var(--accent-primary)] font-bold',
  secondary:
    'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/45 font-semibold',
  elevated:
    'bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] hover:border-[var(--accent-primary)]/45 font-semibold',
  ghost:
    'bg-transparent hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent font-medium',
  danger:
    'bg-[#F87171]/15 hover:bg-[#F87171]/25 text-[#F87171] border border-[#F87171]/40 font-semibold',
};

const ACTIVE_OVERRIDE_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--accent-primary)] text-[var(--accent-on-primary)] border-[var(--accent-hover)]',
  secondary: 'bg-[var(--accent-primary)]/15 text-[var(--text-primary)] border-[var(--accent-primary)]/60',
  elevated: 'bg-[var(--accent-primary)]/15 text-[var(--text-primary)] border-[var(--accent-primary)]/60',
  ghost: 'bg-[var(--bg-elevated)] text-[var(--accent-primary)] border-[var(--border-subtle)]',
  danger: 'bg-[#F87171] text-[var(--accent-on-primary)] border-[#F87171]',
};

/**
 * Standardized heights & touch targets:
 * - sm: 44px on mobile (min-h-[44px]), 40px on desktop (sm:min-h-[40px])
 * - md: 44px (h-11, min-h-[44px])
 * - lg: 48px (h-12, min-h-[48px])
 * - icon: strict 44x44px touch target (w-11 h-11 min-w-[44px] min-h-[44px])
 */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-11 sm:h-10 min-h-[44px] sm:min-h-[40px] px-3.5 text-xs rounded-[var(--radius-control)] gap-1.5',
  md: 'h-11 min-h-[44px] px-4 text-xs sm:text-sm rounded-[var(--radius-control)] gap-2',
  lg: 'h-12 min-h-[48px] px-5 text-sm rounded-[var(--radius-control)] gap-2',
  icon: 'w-11 h-11 min-w-[44px] min-h-[44px] p-0 rounded-[var(--radius-control)] justify-center',
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
      'inline-flex items-center justify-center whitespace-nowrap shrink-0 select-none cursor-pointer transition-colors duration-180 motion-reduce:transition-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/70 disabled:opacity-45 disabled:pointer-events-none';
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

export interface IconButtonProps extends Omit<ButtonProps, 'size' | 'leftIcon' | 'rightIcon'> {
  'aria-label': string;
  icon?: React.ReactNode;
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, children, variant = 'secondary', className = '', ...rest }, ref) => (
    <Button
      ref={ref}
      variant={variant}
      size="icon"
      className={`w-11 h-11 min-w-[44px] min-h-[44px] rounded-[12px] ${className}`.trim()}
      {...rest}
    >
      {icon || children}
    </Button>
  )
);

IconButton.displayName = 'IconButton';
