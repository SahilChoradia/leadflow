import { cn } from '../../lib/utils';
import type { PipelineStage } from '@leadflow/types';

const stageConfig: Record<PipelineStage, { label: string; className: string }> = {
  new:       { label: 'New',       className: 'bg-brand-500/20 text-brand-300 border-brand-500/30' },
  contacted: { label: 'Contacted', className: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  qualified: { label: 'Qualified', className: 'bg-warning-500/20 text-warning-400 border-warning-500/30' },
  won:       { label: 'Won',       className: 'bg-success-500/20 text-success-500 border-success-500/30' },
  lost:      { label: 'Lost',      className: 'bg-danger-500/20 text-danger-500 border-danger-500/30' },
};

const sourceColors: Record<string, string> = {
  typeform:  'bg-purple-500/20 text-purple-300',
  fb_ads:    'bg-blue-600/20 text-blue-300',
  referral:  'bg-green-600/20 text-green-300',
  manual:    'bg-slate-500/20 text-slate-400',
};

interface BadgeProps {
  stage?: PipelineStage;
  source?: string;
  label?: string;
  className?: string;
}

export function Badge({ stage, source, label, className }: BadgeProps) {
  if (stage) {
    const cfg = stageConfig[stage];
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border', cfg.className, className)}>
        {cfg.label}
      </span>
    );
  }
  if (source) {
    const color = sourceColors[source] ?? 'bg-slate-500/20 text-slate-400';
    return (
      <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', color, className)}>
        {source}
      </span>
    );
  }
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-surface-600 text-slate-400', className)}>
      {label}
    </span>
  );
}
