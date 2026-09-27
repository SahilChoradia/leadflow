import { cn } from '../../lib/utils';

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />;
}

export function LeadCardSkeleton() {
  return (
    <div className="glass rounded-xl p-4 space-y-3 animate-pulse">
      <div className="flex items-center gap-3">
        <Skeleton className="w-8 h-8 rounded-full" />
        <div className="space-y-1.5 flex-1">
          <Skeleton className="h-3.5 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <Skeleton className="h-3 w-1/3" />
    </div>
  );
}

export function ColumnSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <LeadCardSkeleton />
      <LeadCardSkeleton />
      <LeadCardSkeleton />
    </div>
  );
}

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex items-center gap-4 py-3.5 px-4 border-b border-white/5 animate-pulse">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} className={`h-4 ${i === 0 ? 'w-1/4' : 'flex-1'}`} />
      ))}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="glass rounded-xl p-5 space-y-3 animate-pulse">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-7 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

