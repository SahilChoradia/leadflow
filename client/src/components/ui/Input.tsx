import { InputHTMLAttributes, forwardRef } from 'react';
import { cn } from '../../lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, ...props }, ref) => (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-sm font-medium text-slate-300">
          {label}
          {props.required && <span className="text-brand-400 ml-1">*</span>}
        </label>
      )}
      <input
        ref={ref}
        className={cn(
          'w-full px-3 py-2 rounded-lg bg-surface-700 border text-slate-100 text-sm',
          'placeholder:text-slate-500 outline-none transition-all duration-150',
          error
            ? 'border-danger-500 focus:ring-2 focus:ring-danger-500/30'
            : 'border-white/10 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20',
          className,
        )}
        {...props}
      />
      {error && <p className="text-xs text-danger-500">{error}</p>}
    </div>
  ),
);
Input.displayName = 'Input';
