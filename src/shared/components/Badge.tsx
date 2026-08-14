/**
 * Badge - Atomic Component
 * 
 * Variants: default, success, warning, error, info
 * Sizes: sm, md
 */

import { forwardRef } from 'react';

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info' | 'prime' | 'start';
  size?: 'sm' | 'md';
}

const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      children,
      variant = 'default',
      size = 'sm',
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      inline-flex items-center justify-center
      font-medium rounded-full
      transition-colors
    `;

    const variantStyles = {
      default: 'bg-slate-700 text-slate-200',
      success: 'bg-green-500/20 text-green-400 border border-green-500/30',
      warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
      error: 'bg-red-500/20 text-red-400 border border-red-500/30',
      info: 'bg-sky-500/20 text-sky-400 border border-sky-500/30',
      prime: 'bg-gradient-to-r from-green-600 to-green-500 text-white',
      start: 'bg-slate-600 text-slate-200',
    };

    const sizeStyles = {
      sm: 'px-2.5 py-0.5 text-xs',
      md: 'px-3 py-1 text-sm',
    };

    return (
      <span
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className}
        `}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

export default Badge;
