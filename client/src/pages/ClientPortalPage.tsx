import { useState, useRef, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  LogOut,
  User,
  ShieldCheck,
  RefreshCw,
  X,
} from 'lucide-react';
import type { DocumentDto, DocumentStatus } from '@leadflow/types';

interface ClientProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  caseStatus: string;
  assignedAdvisor?: {
    id: string;
    name: string;
    email: string;
  };
}

interface UploadTask {
  id: string;
  fileName: string;
  sizeBytes: number;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientPortalPage() {
  const { user, logout } = useAuth();
  const { socket, isConnected } = useSocket();
  const { success, error: toastError, info } = useToast();
  const queryClient = useQueryClient();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadTasks, setUploadTasks] = useState<UploadTask[]>([]);

  // ── Fetch client profile ──────────────────────────────────────────────────
  const { data: profile, isLoading: isProfileLoading } = useQuery<ClientProfile>({
    queryKey: ['client-me'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: ClientProfile }>('/clients/me');
      return res.data.data;
    },
  });

  // ── Fetch documents ───────────────────────────────────────────────────────
  const { data: documents = [], isLoading: isDocsLoading } = useQuery<DocumentDto[]>({
    queryKey: ['client-documents'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: DocumentDto[] }>('/documents');
      return res.data.data;
    },
  });

  // ── Socket listener for real-time document status updates ─────────────────
  useEffect(() => {
    if (!socket) return;

    const handleDocStatus = (payload: { id: string; status: DocumentStatus; fileName?: string }) => {
      queryClient.setQueryData<DocumentDto[]>(['client-documents'], (prev = []) =>
        prev.map((d) => (d.id === payload.id ? { ...d, status: payload.status } : d))
      );
      if (payload.status === 'verified') {
        success('Document verified', `${payload.fileName || 'Your document'} has been verified!`);
      } else if (payload.status === 'failed') {
        toastError('Verification issue', `${payload.fileName || 'Your document'} requires attention.`);
      }
    };

    socket.on('doc:status', handleDocStatus);

    return () => {
      socket.off('doc:status', handleDocStatus);
    };
  }, [socket, queryClient, success, toastError]);

  // ── File upload handler with per-file progress ────────────────────────────
  const handleUploadFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileList = Array.from(files);
      if (fileList.length === 0) return;

      for (const file of fileList) {
        const taskId = Math.random().toString(36).slice(2);
        const newTask: UploadTask = {
          id: taskId,
          fileName: file.name,
          sizeBytes: file.size,
          progress: 0,
          status: 'uploading',
        };

        setUploadTasks((prev) => [newTask, ...prev]);

        const formData = new FormData();
        formData.append('file', file);

        try {
          await api.post('/documents/upload', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
            onUploadProgress: (progressEvent) => {
              const total = progressEvent.total || file.size;
              const percent = Math.min(100, Math.round((progressEvent.loaded * 100) / total));
              setUploadTasks((prev) =>
                prev.map((t) => (t.id === taskId ? { ...t, progress: percent } : t))
              );
            },
          });

          setUploadTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, progress: 100, status: 'completed' } : t))
          );
          queryClient.invalidateQueries({ queryKey: ['client-documents'] });
          success('Uploaded', `${file.name} uploaded successfully.`);
        } catch (err: any) {
          const msg = err.response?.data?.error || 'Upload failed';
          setUploadTasks((prev) =>
            prev.map((t) => (t.id === taskId ? { ...t, status: 'error', errorMessage: msg } : t))
          );
          toastError('Upload error', msg);
        }
      }
    },
    [queryClient, success, toastError]
  );

  const removeTask = (id: string) => {
    setUploadTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
            <CheckCircle2 size={13} /> Verified
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-500/15 text-rose-400 border border-rose-500/30">
            <AlertCircle size={13} /> Attention Needed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/15 text-amber-400 border border-amber-500/30">
            <Clock size={13} /> Pending Check
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-surface-900 text-slate-100 flex flex-col">
      {/* Top Header */}
      <header className="border-b border-white/8 bg-surface-800/60 backdrop-blur px-6 py-4 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl gradient-brand flex items-center justify-center shadow-glow-brand">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">LeadFlow Client Portal</h1>
            <p className="text-[11px] text-slate-400">Secure Document & Case Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-700 border border-white/6 text-xs text-slate-300">
            <span
              className={cn(
                'w-2 h-2 rounded-full',
                isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-amber-400'
              )}
            />
            {isConnected ? 'Real-Time Connected' : 'Syncing...'}
          </div>

          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 bg-surface-700/60 hover:bg-surface-700 px-3 py-1.5 rounded-lg border border-white/6 transition-colors"
          >
            <LogOut size={13} />
            Sign Out
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-6 md:p-8 space-y-6">
        {/* Welcome & Case Status Banner */}
        <div className="glass rounded-2xl p-6 border border-white/8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-brand-500/20 text-brand-300 border border-brand-500/30">
                  Case Status: {profile?.caseStatus?.replace('_', ' ') || 'Active'}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-white">
                Welcome, {profile?.firstName ?? user?.name ?? 'Client'}
              </h2>
              <p className="text-sm text-slate-400 mt-1">
                Upload your requested documents below. Our team verifies files automatically.
              </p>
            </div>

            {/* Assigned Advisor Card */}
            {profile?.assignedAdvisor && (
              <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-800/80 border border-white/6 shrink-0">
                <div className="w-10 h-10 rounded-full gradient-brand flex items-center justify-center font-bold text-white text-sm">
                  {profile.assignedAdvisor.name[0]}
                </div>
                <div>
                  <p className="text-xs text-slate-400">Assigned Advisor</p>
                  <p className="text-sm font-semibold text-slate-200">{profile.assignedAdvisor.name}</p>
                  <p className="text-xs text-brand-300">{profile.assignedAdvisor.email}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Upload Zone */}
        <section className="glass rounded-2xl p-6 border border-white/8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Document Upload</h3>
              <p className="text-xs text-slate-400">Upload PDF, PNG, JPEG, or DOCX files (up to 25MB)</p>
            </div>
            <Button
              onClick={() => fileInputRef.current?.click()}
              size="sm"
              className="gradient-brand shadow-glow-brand"
            >
              <UploadCloud size={16} />
              Choose Files
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.docx"
            className="hidden"
            onChange={(e) => {
              if (e.target.files) handleUploadFiles(e.target.files);
              e.target.value = '';
            }}
          />

          {/* Drag & Drop Area */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files) handleUploadFiles(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all duration-200',
              isDragging
                ? 'border-brand-500 bg-brand-500/10 scale-[1.01]'
                : 'border-white/10 hover:border-brand-500/40 hover:bg-surface-800/40'
            )}
          >
            <div className="w-12 h-12 rounded-2xl bg-surface-700 flex items-center justify-center text-brand-400">
              <UploadCloud size={24} />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-200">
                Drag and drop files here, or <span className="text-brand-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Multi-file concurrent upload supported</p>
            </div>
          </div>

          {/* Per-File Progress Queue */}
          {uploadTasks.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Upload Queue
              </p>
              <div className="space-y-2">
                {uploadTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3 rounded-xl bg-surface-800/90 border border-white/6 flex items-center gap-3"
                  >
                    <FileText size={18} className="text-brand-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-slate-200 truncate">{task.fileName}</span>
                        <span className="text-slate-400">{formatBytes(task.sizeBytes)} · {task.progress}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-700 overflow-hidden">
                        <div
                          className={cn(
                            'h-full transition-all duration-200 rounded-full',
                            task.status === 'error'
                              ? 'bg-rose-500'
                              : task.status === 'completed'
                              ? 'bg-emerald-500'
                              : 'gradient-brand'
                          )}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => removeTask(task.id)}
                      className="text-slate-500 hover:text-slate-300 p-1"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Uploaded Documents List */}
        <section className="glass rounded-2xl p-6 border border-white/8 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">Your Documents</h3>
              <p className="text-xs text-slate-400">
                {documents.length} {documents.length === 1 ? 'file' : 'files'} uploaded
              </p>
            </div>
          </div>

          {isDocsLoading ? (
            <div className="p-8 text-center text-slate-500 text-sm">Loading documents...</div>
          ) : documents.length === 0 ? (
            <div className="p-12 text-center border border-dashed border-white/6 rounded-xl">
              <FileText size={32} className="mx-auto text-slate-600 mb-2" />
              <p className="text-sm font-medium text-slate-300">No documents uploaded yet</p>
              <p className="text-xs text-slate-500 mt-1">Upload your identity or income documents above</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-white/6 text-slate-400 text-xs">
                    <th className="pb-3 font-medium">Document</th>
                    <th className="pb-3 font-medium">Size</th>
                    <th className="pb-3 font-medium">Uploaded</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/6">
                  {documents.map((doc) => (
                    <tr key={doc.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-surface-700 flex items-center justify-center text-brand-400 shrink-0">
                            <FileText size={16} />
                          </div>
                          <span className="font-medium text-slate-200 truncate max-w-xs">{doc.fileName}</span>
                        </div>
                      </td>
                      <td className="py-3.5 text-xs text-slate-400">{formatBytes(doc.sizeBytes)}</td>
                      <td className="py-3.5 text-xs text-slate-400">
                        {new Date(doc.uploadedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3.5">{getStatusBadge(doc.status)}</td>
                      <td className="py-3.5 text-right">
                        <a
                          href={`/api/documents/${doc.id}/download`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-surface-700/60 hover:bg-surface-700 border border-white/6 transition-colors"
                        >
                          <Download size={13} /> Download
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
