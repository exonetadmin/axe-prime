/**
 * Card - Atomic Component
 * 
 * Glassmorphism card with customizable variants
 * Variants: default, elevated, outlined
 * Padding: sm, md, lg
 */

import { forwardRef } from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'md' | 'lg' | 'none';
  hover?: boolean;
}

const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'default',
      padding = 'md',
      hover = false,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = 'rounded-xl overflow-hidden';

    const variantStyles = {
      default: `
        bg-slate-900/60 backdrop-blur-xl
        border border-sky-500/10
      `,
      elevated: `
        bg-slate-900/80 backdrop-blur-xl
        border border-sky-500/20
        shadow-xl shadow-black/20
      `,
      outlined: `
        bg-transparent
        border border-sky-500/30
      `,
    };

    const paddingStyles = {
      none: '',
      sm: 'p-4',
      md: 'p-6',
      lg: 'p-8',
    };

    const hoverStyles = hover
      ? 'transition-all duration-300 hover:border-sky-500/30 hover:shadow-lg hover:shadow-sky-500/5'
      : '';

    return (
      <div
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${paddingStyles[padding]}
          ${hoverStyles}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export default Card;
