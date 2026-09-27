import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * Reusable EmptyState component — consistent look across all pages.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  size = 'md',
}: EmptyStateProps) {
  const iconSize = { sm: 28, md: 40, lg: 52 }[size];
  const titleClass = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' }[size];
  const padding = { sm: 'py-10 px-6', md: 'py-16 px-8', lg: 'py-24 px-10' }[size];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center border-2 border-dashed border-white/6 rounded-2xl',
        padding,
        className,
      )}
    >
      <div className="w-14 h-14 rounded-2xl bg-surface-700 border border-white/8 flex items-center justify-center mb-4">
        <Icon size={iconSize} className="text-slate-500" />
      </div>
      <h3 className={cn('font-semibold text-slate-300 mb-1', titleClass)}>{title}</h3>
      {description && (
        <p className="text-sm text-slate-500 max-w-xs">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
