import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../components/ui/Toast';
import { Skeleton } from '../components/ui/Skeleton';
import {
  TrendingUp,
  Users,
  CheckSquare,
  AlertTriangle,
  RotateCw,
  Zap,
  ArrowRight,
  Target,
  BarChart3,
  Layers,
  Sparkles,
  Calendar,
} from 'lucide-react';
import type { DashboardMetrics, PipelineStage } from '@leadflow/types';

const STAGE_CONFIG: Record<
  PipelineStage,
  { label: string; color: string; bg: string; border: string; text: string; barColor: string }
> = {
  new: {
    label: 'New Leads',
    color: 'sky',
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/20',
    text: 'text-sky-400',
    barColor: 'bg-sky-500',
  },
  contacted: {
    label: 'Contacted',
    color: 'indigo',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/20',
    text: 'text-indigo-400',
    barColor: 'bg-indigo-500',
  },
  qualified: {
    label: 'Qualified',
    color: 'amber',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    barColor: 'bg-amber-500',
  },
  won: {
    label: 'Closed / Won',
    color: 'emerald',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    barColor: 'bg-emerald-500',
  },
  lost: {
    label: 'Closed / Lost',
    color: 'rose',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/20',
    text: 'text-rose-400',
    barColor: 'bg-rose-500',
  },
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { socket, isConnected } = useSocket();
  const { success, error } = useToast();

  // Fetch cached metrics
  const {
    data: metrics,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DashboardMetrics }>('/dashboard/metrics');
      return res.data.data;
    },
    staleTime: 30_000,
  });

  // Manual refresh mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: DashboardMetrics }>('/dashboard/refresh');
      return res.data.data;
    },
    onSuccess: (freshData) => {
      queryClient.setQueryData(['dashboard-metrics'], freshData);
      success('Metrics recomputed from pipeline records');
    },
    onError: () => {
      error('Failed to recalculate metrics');
    },
  });

  // Live Socket.io listener moved to SocketContext.tsx to ensure cache is updated even when Dashboard is not mounted.

  const totalLeads = metrics?.totalLeads ?? 0;
  const stageCounts = metrics?.stageCounts ?? {
    new: 0,
    contacted: 0,
    qualified: 0,
    won: 0,
    lost: 0,
  };

  const wonLeads = stageCounts.won ?? 0;
  const lostLeads = stageCounts.lost ?? 0;
  const closedTotal = wonLeads + lostLeads;
  const conversionPercent = ((metrics?.conversionRate ?? 0) * 100).toFixed(1);

  const formattedLastUpdated = metrics?.lastUpdatedAt
    ? new Date(metrics.lastUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto bg-surface-900 p-8 space-y-8">
      {/* ── Top Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-white/6">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Executive Dashboard</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                isConnected
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              {isConnected ? 'Live Socket Sync' : 'Polling Sync'}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time pipeline velocity, conversion performance, and operational health.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {formattedLastUpdated && (
            <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 bg-surface-800/60 px-3 py-1.5 rounded-lg border border-white/5">
              <Calendar size={13} className="text-slate-400" />
              <span>Cached at {formattedLastUpdated}</span>
            </div>
          )}

          <button
            id="refresh-metrics-btn"
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending || isRefetching}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-surface-700/80 hover:bg-surface-700 text-slate-200 hover:text-white border border-white/10 hover:border-brand-500/40 transition shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            <RotateCw
              size={14}
              className={`${refreshMutation.isPending || isRefetching ? 'animate-spin text-brand-400' : ''}`}
            />
            <span>Refresh Cache</span>
          </button>
        </div>
      </div>

      {/* ── KPI Stat Cards ─────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-2xl p-6 space-y-3">
              <div className="flex justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-8 rounded-lg" />
              </div>
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* Card 1: Total Leads */}
          <div className="glass rounded-2xl p-6 border border-white/8 relative overflow-hidden group hover:border-brand-500/30 transition shadow-card">
            <div className="absolute top-0 right-0 w-24 h-24 bg-brand-500/10 rounded-full blur-2xl group-hover:bg-brand-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Leads</span>
              <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/25 flex items-center justify-center text-brand-400 shadow-glow-brand">
                <Zap size={18} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">{totalLeads}</span>
              <span className="text-xs text-slate-400">active in pipeline</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/5">
              <span>{stageCounts.new} newly ingested</span>
              <button
                onClick={() => navigate('/pipeline')}
                className="text-brand-400 hover:text-brand-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                Board <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Card 2: Conversion Rate */}
          <div className="glass rounded-2xl p-6 border border-white/8 relative overflow-hidden group hover:border-emerald-500/30 transition shadow-card">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Conversion Rate</span>
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
                <Target size={18} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-emerald-400 tracking-tight">{conversionPercent}%</span>
              <span className="text-xs text-slate-400">won / closed</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/5">
              <span>{wonLeads} won of {closedTotal} concluded</span>
              <span className="text-emerald-400 font-medium">Win Ratio</span>
            </div>
          </div>

          {/* Card 3: Active Clients */}
          <div className="glass rounded-2xl p-6 border border-white/8 relative overflow-hidden group hover:border-indigo-500/30 transition shadow-card">
            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-2xl group-hover:bg-indigo-500/20 transition-all pointer-events-none" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Active Borrowers</span>
              <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-400">
                <Users size={18} />
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-white tracking-tight">{metrics?.activeClients ?? 0}</span>
              <span className="text-xs text-slate-400">converted clients</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/5">
              <span>Underwriting & docs</span>
              <button
                onClick={() => navigate('/clients')}
                className="text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 cursor-pointer"
              >
                Clients <ArrowRight size={12} />
              </button>
            </div>
          </div>

          {/* Card 4: Overdue Tasks */}
          <div
            className={`glass rounded-2xl p-6 border relative overflow-hidden group transition shadow-card ${
              (metrics?.overdueTaskCount ?? 0) > 0
                ? 'border-rose-500/30 hover:border-rose-500/50'
                : 'border-white/8 hover:border-slate-500/30'
            }`}
          >
            <div
              className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl pointer-events-none ${
                (metrics?.overdueTaskCount ?? 0) > 0 ? 'bg-rose-500/15' : 'bg-slate-500/10'
              }`}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Overdue Tasks</span>
              <div
                className={`w-9 h-9 rounded-xl flex items-center justify-center border ${
                  (metrics?.overdueTaskCount ?? 0) > 0
                    ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse'
                    : 'bg-surface-700/50 border-white/10 text-slate-400'
                }`}
              >
                {(metrics?.overdueTaskCount ?? 0) > 0 ? <AlertTriangle size={18} /> : <CheckSquare size={18} />}
              </div>
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span
                className={`text-3xl font-extrabold tracking-tight ${
                  (metrics?.overdueTaskCount ?? 0) > 0 ? 'text-rose-400' : 'text-white'
                }`}
              >
                {metrics?.overdueTaskCount ?? 0}
              </span>
              <span className="text-xs text-slate-400">requiring action</span>
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-white/5">
              <span>
                {(metrics?.overdueTaskCount ?? 0) > 0 ? 'Immediate follow-up' : 'All tasks current'}
              </span>
              <button
                onClick={() => navigate('/tasks')}
                className="text-slate-400 hover:text-white font-medium flex items-center gap-1 cursor-pointer"
              >
                Tasks <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Funnel Distribution Bar ───────────────────────────────────────── */}
      <div className="glass rounded-2xl p-6 border border-white/8 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <BarChart3 size={18} className="text-brand-400" />
            <h2 className="text-base font-semibold text-white">Pipeline Stage Funnel</h2>
          </div>
          <span className="text-xs text-slate-400">
            {totalLeads === 0 ? 'No leads in pipeline yet' : `${totalLeads} total leads across 5 stages`}
          </span>
        </div>

        {/* Stacked Percentage Bar */}
        <div className="w-full h-3.5 bg-surface-800 rounded-full overflow-hidden flex p-0.5 gap-0.5 border border-white/6">
          {(Object.keys(STAGE_CONFIG) as PipelineStage[]).map((stg) => {
            const count = stageCounts[stg] ?? 0;
            const pct = totalLeads > 0 ? (count / totalLeads) * 100 : 0;
            if (pct === 0) return null;
            return (
              <div
                key={stg}
                style={{ width: `${pct}%` }}
                title={`${STAGE_CONFIG[stg].label}: ${count} (${pct.toFixed(1)}%)`}
                className={`${STAGE_CONFIG[stg].barColor} h-full rounded-sm transition-all duration-500 hover:opacity-85`}
              />
            );
          })}
        </div>

        {/* Stage Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
          {(Object.keys(STAGE_CONFIG) as PipelineStage[]).map((stg) => {
            const cfg = STAGE_CONFIG[stg];
            const count = stageCounts[stg] ?? 0;
            const pct = totalLeads > 0 ? ((count / totalLeads) * 100).toFixed(0) : '0';

            return (
              <div
                key={stg}
                onClick={() => navigate('/pipeline')}
                className={`p-4 rounded-xl border ${cfg.border} ${cfg.bg} flex flex-col justify-between hover:scale-[1.02] transition cursor-pointer group`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
                  <span className="text-[11px] font-mono text-slate-400 group-hover:text-white transition">
                    {pct}%
                  </span>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="text-2xl font-bold text-white">{count}</span>
                  <span className="text-[11px] text-slate-500">leads</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Operational Insights & Cache Architecture ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Box 1: Funnel Drop-off Analysis */}
        <div className="glass rounded-2xl p-6 border border-white/8 space-y-4">
          <div className="flex items-center gap-2.5">
            <TrendingUp size={18} className="text-emerald-400" />
            <h3 className="text-base font-semibold text-white">Conversion Velocity</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Lead conversion metric measures won leads against total resolved outcomes:
            <code className="ml-1 px-1.5 py-0.5 rounded bg-surface-800 text-brand-300 font-mono text-[11px]">
              won / (won + lost)
            </code>
            .
          </p>

          <div className="space-y-3 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-400">Won Ratio vs All Closed Deals</span>
                <span className="text-emerald-400 font-semibold">{conversionPercent}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-surface-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, parseFloat(conversionPercent))}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-3">
              <div className="p-3 rounded-xl bg-surface-800/50 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Total Concluded</span>
                <span className="text-lg font-bold text-white">{closedTotal}</span>
              </div>
              <div className="p-3 rounded-xl bg-surface-800/50 border border-white/5">
                <span className="text-[11px] text-slate-400 block">Pipeline In-Flight</span>
                <span className="text-lg font-bold text-white">{totalLeads - closedTotal}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Box 2: Cache & Real-Time Sync Architecture */}
        <div className="glass rounded-2xl p-6 border border-white/8 space-y-4">
          <div className="flex items-center gap-2.5">
            <Sparkles size={18} className="text-brand-400" />
            <h3 className="text-base font-semibold text-white">Cache & Architecture</h3>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Dashboard metrics utilize a 3-tier high-performance architecture:
          </p>

          <div className="space-y-2.5 pt-1 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-800/50 border border-white/5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200">Redis In-Memory Key (L1)</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Sub-millisecond retrieval with 1-hour TTL. Avoids collection scans on frequent views.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-800/50 border border-white/5">
              <div className="w-2 h-2 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200">MongoDB Materialized View (L2)</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Durable fallback in <code className="font-mono text-indigo-300">DashboardCache</code> if Redis restarts.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-surface-800/50 border border-white/5">
              <div className="w-2 h-2 rounded-full bg-brand-400 mt-1.5 shrink-0" />
              <div>
                <span className="font-semibold text-slate-200">Event-Driven Invalidation</span>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Pipeline events immediately clear cache, recompute stats, and emit <code className="font-mono text-brand-300">metrics:updated</code> over WebSockets.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
