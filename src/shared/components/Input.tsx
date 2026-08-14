/**
 * Input - Atomic Component
 * 
 * States: default, focus, error, disabled
 * Types: text, email, password, number, etc.
 */

import { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      w-full rounded-lg border bg-slate-800 px-3 py-2 text-white
      placeholder:text-slate-500
      transition-colors duration-200
      focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500
      disabled:opacity-50 disabled:cursor-not-allowed
    `;

    const stateStyles = error
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500'
      : 'border-slate-700 hover:border-slate-600';

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label className="block text-sm font-medium text-slate-300">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              ${baseStyles}
              ${stateStyles}
              ${leftIcon ? 'pl-10' : ''}
              ${className}
            `}
            disabled={disabled}
            {...props}
          />
        </div>
        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {helperText && !error && (
          <p className="text-sm text-slate-500">{helperText}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;
