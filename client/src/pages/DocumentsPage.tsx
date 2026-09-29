import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSocket } from '../contexts/SocketContext';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { cn } from '../lib/utils';
import {
  FileText,
  Search,
  Download,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileCode,
  FileSpreadsheet,
  Image as ImageIcon,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type { DocumentDto, DocumentStatus } from '@leadflow/types';

function formatBytes(bytes: number): string {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));
}

function getFileIcon(mimeType: string) {
  if (mimeType.includes('pdf')) {
    return <FileText className="text-rose-400" size={18} />;
  }
  if (mimeType.includes('image')) {
    return <ImageIcon className="text-purple-400" size={18} />;
  }
  if (mimeType.includes('word') || mimeType.includes('document')) {
    return <FileCode className="text-blue-400" size={18} />;
  }
  if (mimeType.includes('sheet') || mimeType.includes('excel')) {
    return <FileSpreadsheet className="text-emerald-400" size={18} />;
  }
  return <FileText className="text-slate-400" size={18} />;
}

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { user } = useAuth();
  const { error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DocumentStatus>('all');

  // ── Real-time Socket listener for document verification events ───────────────
  useEffect(() => {
    if (!socket) return;
    const handleStatusUpdate = () => {
      queryClient.invalidateQueries({ queryKey: ['all-documents'] });
    };

    socket.on('doc:status', handleStatusUpdate);
    return () => {
      socket.off('doc:status', handleStatusUpdate);
    };
  }, [socket, queryClient]);

  // ── Fetch all brokerage documents ───────────────────────────────────────────
  const { data: documents = [], isLoading, isRefetching, refetch } = useQuery<DocumentDto[]>({
    queryKey: ['all-documents'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DocumentDto[] }>('/documents');
      return res.data.data;
    },
  });

  // ── Metrics ─────────────────────────────────────────────────────────────────
  const totalCount = documents.length;
  const verifiedCount = documents.filter((d) => d.status === 'passed').length;
  const pendingCount = documents.filter((d) => d.status === 'pending' || d.status === 'checking').length;
  const failedCount = documents.filter((d) => d.status === 'failed').length;

  // ── Filtering ───────────────────────────────────────────────────────────────
  const filteredDocs = documents.filter((doc) => {
    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'passed'
        ? doc.status === 'passed'
        : statusFilter === 'pending'
        ? doc.status === 'pending' || doc.status === 'checking'
        : doc.status === statusFilter;

    const searchLower = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      doc.fileName.toLowerCase().includes(searchLower) ||
      (doc.clientName && doc.clientName.toLowerCase().includes(searchLower)) ||
      (doc.clientEmail && doc.clientEmail.toLowerCase().includes(searchLower));

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_10px_rgba(52,211,153,0.1)]">
            <CheckCircle2 size={12} />
            Verified
          </span>
        );
      case 'checking':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
            <RefreshCw size={12} className="animate-spin text-sky-400" />
            Analyzing
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertCircle size={12} />
            Verification Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock size={12} />
            Pending
          </span>
        );
    }
  };

  const handleVerifyDocument = async (docId: string, status: 'verified' | 'failed', failureReason?: string) => {
    try {
      await api.patch(`/documents/${docId}/status`, { status, failureReason });
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    } catch (err: any) {
      toastError('Failed to update document status', err.message);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-900">
      {/* ── Page Header ──────────────────────────────────────────────────────── */}
      <div className="px-8 py-6 border-b border-white/6 shrink-0 bg-surface-800/40">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-2.5">
              <FileText className="text-brand-400" />
              Document Vault
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Brokerage-wide compliance records, identity proofs, and automated verification logs.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading || isRefetching}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-surface-700/60 border border-white/8 hover:border-brand-500/30 transition-all"
            title="Refresh documents"
          >
            <RefreshCw size={13} className={cn(isRefetching && 'animate-spin')} />
            <span>Sync</span>
          </button>
        </div>

        {/* ── KPI Summary Cards ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Total */}
          <div className="glass rounded-xl p-4 border border-white/8">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400 uppercase tracking-wider">All Documents</span>
              <FileText size={16} className="text-slate-400" />
            </div>
            <p className="text-2xl font-bold text-white mt-2">{totalCount}</p>
          </div>

          {/* Verified */}
          <div className="glass rounded-xl p-4 border border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-emerald-400 uppercase tracking-wider">Verified Clean</span>
              <ShieldCheck size={16} className="text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-emerald-300 mt-2">{verifiedCount}</p>
          </div>

          {/* Pending */}
          <div className="glass rounded-xl p-4 border border-amber-500/20 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-400 uppercase tracking-wider">In Verification</span>
              <Clock size={16} className="text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-amber-300 mt-2">{pendingCount}</p>
          </div>

          {/* Issues */}
          <div className="glass rounded-xl p-4 border border-rose-500/20 bg-rose-500/5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-400 uppercase tracking-wider">Action Needed</span>
              <AlertTriangle size={16} className="text-rose-400" />
            </div>
            <p className="text-2xl font-bold text-rose-300 mt-2">{failedCount}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Controls ─────────────────────────────────────────── */}
      <div className="px-8 py-4 border-b border-white/6 shrink-0 flex flex-wrap items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-surface-800 border border-white/6">
          {(
            [
              { key: 'all', label: 'All Files', count: totalCount },
              { key: 'passed', label: 'Verified', count: verifiedCount },
              { key: 'pending', label: 'Pending', count: pendingCount },
              { key: 'failed', label: 'Failed', count: failedCount },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5',
                statusFilter === tab.key
                  ? 'bg-brand-500 text-white shadow-glow-brand'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-surface-700',
              )}
            >
              <span>{tab.label}</span>
              <span
                className={cn(
                  'text-[10px] px-1.5 py-0.2 rounded-full font-bold',
                  statusFilter === tab.key ? 'bg-white/20 text-white' : 'bg-surface-700 text-slate-400',
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-72">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by file or client..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-surface-800 border border-white/10 text-slate-200 placeholder:text-slate-500 text-xs focus:outline-none focus:border-brand-500/50"
          />
        </div>
      </div>

      {/* ── Document Table ──────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-16 bg-surface-800/60 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filteredDocs.length === 0 ? (
          <EmptyState
            icon={FileText}
            title={searchTerm || statusFilter !== 'all' ? 'No matching documents' : 'No documents in vault'}
            description={
              searchTerm || statusFilter !== 'all'
                ? 'Try clearing your search query or switching filters.'
                : 'Documents uploaded by clients or advisors in the Clients tab will automatically appear here with automated verification status.'
            }
          />
        ) : (
          <div className="glass rounded-2xl border border-white/8 overflow-hidden shadow-card">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/8 bg-surface-800/80 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  <th className="py-3.5 px-5">Document Name</th>
                  <th className="py-3.5 px-5">Client</th>
                  <th className="py-3.5 px-5">File Size</th>
                  <th className="py-3.5 px-5">Uploaded Date</th>
                  <th className="py-3.5 px-5">Verification</th>
                  <th className="py-3.5 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/6 text-sm">
                {filteredDocs.map((doc) => (
                  <tr
                    key={doc.id}
                    className="hover:bg-surface-700/40 transition-colors group"
                  >
                    {/* Document File */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-surface-700/80 border border-white/8 flex items-center justify-center shrink-0">
                          {getFileIcon(doc.mimeType)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-200 truncate group-hover:text-brand-300 transition-colors">
                            {doc.fileName}
                          </p>
                          <p className="text-[11px] text-slate-500 uppercase tracking-wider">
                            {doc.mimeType.split('/')[1] || 'FILE'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Client */}
                    <td className="py-4 px-5">
                      {doc.clientName ? (
                        <div>
                          <p className="font-medium text-slate-300 text-xs">{doc.clientName}</p>
                          {doc.clientEmail && (
                            <p className="text-[11px] text-slate-500 truncate">{doc.clientEmail}</p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-500">Client ID #{doc.clientId.slice(-6)}</span>
                      )}
                    </td>

                    {/* Size */}
                    <td className="py-4 px-5 text-xs text-slate-400 font-mono">
                      {formatBytes(doc.sizeBytes)}
                    </td>

                    {/* Uploaded At */}
                    <td className="py-4 px-5 text-xs text-slate-400">
                      {formatDate(doc.uploadedAt)}
                    </td>

                    {/* Status */}
                    <td className="py-4 px-5">
                      <div className="space-y-1">
                        {getStatusBadge(doc.status)}
                        {doc.status === 'failed' && doc.failureReason && (
                          <p className="text-[10px] text-rose-400 max-w-xs truncate" title={doc.failureReason}>
                            {doc.failureReason}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-5 text-right flex justify-end items-center gap-2">
                      {doc.status === 'pending' && user?.role !== 'client' && (
                        <>
                          <button
                            onClick={() => handleVerifyDocument(doc.id, 'verified')}
                            className="px-2 py-1 text-xs rounded bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('Reason for rejection:');
                              if (reason !== null) handleVerifyDocument(doc.id, 'failed', reason);
                            }}
                            className="px-2 py-1 text-xs rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      <a
                        href={`/api/documents/${doc.id}/download`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-surface-700 hover:bg-brand-500 hover:text-white border border-white/8 hover:border-brand-500 transition-all"
                        title="Download file"
                      >
                        <Download size={13} />
                        <span>Download</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
