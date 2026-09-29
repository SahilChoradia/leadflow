import { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { cn } from '../lib/utils';
import {
  Users,
  Mail,
  Phone,
  FileText,
  Calendar,
  ExternalLink,
  Search,
  Download,
  UploadCloud,
  CheckCircle2,
  Clock,
  AlertCircle,
  RefreshCw,
  Plus,
} from 'lucide-react';
import type { ClientDto, DocumentDto, PaginatedResponse, DocumentStatus, EmailTemplateDto } from '@leadflow/types';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ClientsPage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const { success, error: toastError } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientDto | null>(null);
  const [isDocsModalOpen, setIsDocsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailTemplateId, setEmailTemplateId] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadPercent, setUploadPercent] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Real-time Socket listener for document status updates ────────────────
  useEffect(() => {
    if (!socket) return;

    const handleDocStatus = (payload: { id: string; status: DocumentStatus; failureReason?: string }) => {
      queryClient.setQueryData<DocumentDto[]>(['client-docs', selectedClient?.id], (prev = []) =>
        prev.map((d) =>
          d.id === payload.id
            ? { ...d, status: payload.status, failureReason: payload.failureReason ?? d.failureReason }
            : d
        )
      );
    };

    socket.on('doc:status', handleDocStatus);

    return () => {
      socket.off('doc:status', handleDocStatus);
    };
  }, [socket, selectedClient?.id, queryClient]);

  // ── Fetch clients ──────────────────────────────────────────────────────────
  const { data: clientsData, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<ClientDto> }>('/clients?limit=100');
      return res.data.data.items;
    },
  });

  const clients = clientsData || [];

  // Filter clients by search
  const filteredClients = clients.filter(
    (c) =>
      c.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // ── Fetch email templates for Send Email modal ────────────────────────────
  const { data: emailTemplates = [], isLoading: isTemplatesLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<EmailTemplateDto> }>('/email-templates');
      return res.data.data.items;
    },
    staleTime: 0,             // always treat as stale so newly-created templates appear
    refetchOnMount: 'always', // refetch every time the component mounts
  });

  // ── Send email mutation ────────────────────────────────────────────────────
  const sendEmailMutation = useMutation({
    mutationFn: async () => {
      if (!selectedClient || !emailTemplateId) return;
      await api.post('/email-templates/send', {
        to: selectedClient.email,
        templateId: emailTemplateId,
        variables: {
          firstName: selectedClient.firstName,
          lastName:  selectedClient.lastName,
          email:     selectedClient.email,
        },
      });
    },
    onSuccess: () => {
      success('Email queued', `Email will be sent to ${selectedClient?.email}`);
      setIsEmailModalOpen(false);
      setEmailTemplateId('');
    },
    onError: () => toastError('Failed to queue email'),
  });

  const openEmailModal = (client: ClientDto) => {
    setSelectedClient(client);
    setEmailTemplateId('');
    setIsEmailModalOpen(true);
    // Force a fresh fetch so newly-created templates always appear
    queryClient.invalidateQueries({ queryKey: ['email-templates'] });
  };

  // ── Fetch documents for selected client ───────────────────────────────────
  const { data: clientDocs = [], isLoading: isDocsLoading } = useQuery<DocumentDto[]>({
    queryKey: ['client-docs', selectedClient?.id],
    queryFn: async () => {
      if (!selectedClient) return [];
      const res = await api.get<{ success: boolean; data: DocumentDto[] }>(`/documents?clientId=${selectedClient.id}`);
      return res.data.data;
    },
    enabled: Boolean(selectedClient && isDocsModalOpen),
  });

  const openDocsModal = (client: ClientDto) => {
    setSelectedClient(client);
    setIsDocsModalOpen(true);
  };

  const getStatusBadge = (status: DocumentStatus) => {
    switch (status) {
      case 'passed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 size={12} /> Verified
          </span>
        );
      case 'checking':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-sky-500/15 text-sky-400">
            <RefreshCw size={12} className="animate-spin" /> Checking
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-rose-500/15 text-rose-400">
            <AlertCircle size={12} /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-amber-500/15 text-amber-400">
            <Clock size={12} /> Pending
          </span>
        );
    }
  };

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedClient) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('clientId', selectedClient.id);

    setIsUploading(true);
    setUploadPercent(0);

    try {
      await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const total = progressEvent.total || file.size;
          const percent = Math.min(100, Math.round((progressEvent.loaded * 100) / total));
          setUploadPercent(percent);
        },
      });

      queryClient.invalidateQueries({ queryKey: ['client-docs', selectedClient.id] });
      success('Document uploaded', `${file.name} sent for verification.`);
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Upload failed';
      toastError('Upload error', msg);
    } finally {
      setIsUploading(false);
      setUploadPercent(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleVerifyDocument = async (docId: string, status: 'verified' | 'failed', failureReason?: string) => {
    try {
      await api.patch(`/documents/${docId}/status`, { status, failureReason });
      queryClient.invalidateQueries({ queryKey: ['client-docs', selectedClient?.id] });
    } catch (err: any) {
      toastError('Failed to update document status', err.message);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-surface-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Active Clients</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {clients.length} converted clients under management
          </p>
        </div>

        {/* Search */}
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-surface-800 border border-white/10 text-slate-200 placeholder:text-slate-500 outline-none focus:border-brand-500"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="text-center py-12 text-slate-500 text-sm">Loading clients...</div>
        ) : filteredClients.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No active clients yet"
            description="Convert qualified leads from the Pipeline board using the 'Convert to Client' button to begin onboarding."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <div
                key={client.id}
                className="glass rounded-xl p-5 border border-white/6 hover:border-brand-500/30 transition-all duration-150 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full gradient-brand flex items-center justify-center text-white font-bold text-xs shadow-glow-brand shrink-0">
                        {client.firstName[0]}
                        {client.lastName[0]}
                      </div>
                      <div>
                        <h3 className="font-semibold text-white text-sm">
                          {client.firstName} {client.lastName}
                        </h3>
                        <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {client.caseStatus || 'Active'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 pt-2 border-t border-white/6">
                    <div className="flex items-center gap-2">
                      <Mail size={13} className="text-slate-500" />
                      <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                      <div className="flex items-center gap-2">
                        <Phone size={13} className="text-slate-500" />
                        <span>{client.phone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-slate-500">
                      <Calendar size={13} />
                      <span>Converted {new Date(client.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/6 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">Portal Enabled</span>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEmailModal(client)}
                      className="text-xs text-slate-400 hover:text-white hover:bg-surface-700"
                    >
                      <Mail size={13} className="mr-1" />
                      Email
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openDocsModal(client)}
                      className="text-xs text-brand-300 hover:text-white hover:bg-brand-500/10"
                    >
                      <FileText size={13} className="mr-1" />
                      Documents
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Client Documents Modal */}
      <Modal
        isOpen={isDocsModalOpen}
        onClose={() => {
          setIsDocsModalOpen(false);
          setSelectedClient(null);
        }}
        title={`Documents — ${selectedClient?.firstName} ${selectedClient?.lastName}`}
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/6">
            <p className="text-xs text-slate-400">
              Files submitted by client or uploaded by advisor:
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.docx"
              className="hidden"
              onChange={handleUploadFile}
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              isLoading={isUploading}
              className="text-xs gradient-brand text-white border-0 shadow-glow-brand"
            >
              <UploadCloud size={13} className="mr-1.5" />
              Upload Document
            </Button>
          </div>

          {/* Uploading progress indicator */}
          {isUploading && (
            <div className="p-3 rounded-xl bg-surface-700/80 border border-brand-500/30 space-y-1.5 animate-pulse">
              <div className="flex items-center justify-between text-xs text-brand-300">
                <span>Uploading document to storage...</span>
                <span>{uploadPercent ?? 0}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-surface-800 overflow-hidden">
                <div
                  className="h-full gradient-brand rounded-full transition-all duration-150"
                  style={{ width: `${uploadPercent ?? 10}%` }}
                />
              </div>
            </div>
          )}

          {isDocsLoading ? (
            <div className="py-8 text-center text-slate-500 text-xs">Loading documents...</div>
          ) : clientDocs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-white/8 rounded-xl text-slate-500 text-xs">
              No documents uploaded yet. Click "Upload Document" to add files for this client.
            </div>
          ) : (
            <div className="divide-y divide-white/6 max-h-80 overflow-y-auto">
              {clientDocs.map((doc) => (
                <div key={doc.id} className="py-3 flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <FileText size={16} className="text-brand-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-slate-200 truncate">{doc.fileName}</p>
                      <p className="text-[10px] text-slate-500">
                        {formatBytes(doc.sizeBytes)} · {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                      {doc.status === 'failed' && doc.failureReason && (
                        <p className="text-[11px] text-rose-400 mt-1 flex items-center gap-1 font-medium bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          <AlertCircle size={11} className="shrink-0" />
                          <span>Reason: {doc.failureReason}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(doc.status)}
                    {doc.status === 'pending' && (
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
                      className="p-1.5 rounded text-slate-400 hover:text-white hover:bg-surface-700"
                    >
                      <Download size={14} />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Send Email Modal */}
      <Modal
        isOpen={isEmailModalOpen}
        onClose={() => {
          setIsEmailModalOpen(false);
          setSelectedClient(null);
          setEmailTemplateId('');
        }}
        title={`Send Email — ${selectedClient?.firstName} ${selectedClient?.lastName}`}
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-400">
            Choose a template to send to{' '}
            <span className="text-slate-200 font-medium">{selectedClient?.email}</span>.
            Placeholders like{' '}
            <code className="text-brand-300 text-[10px] bg-surface-700 px-1 py-0.5 rounded">{'{{firstName}}'}</code>{' '}
            are filled automatically.
          </p>

          {/* Template list */}
          {isTemplatesLoading ? (
            <div className="animate-pulse space-y-2">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-14 bg-surface-700 rounded-xl" />
              ))}
            </div>
          ) : emailTemplates.length === 0 ? (
            <div className="p-4 rounded-xl border border-dashed border-white/8 text-center text-sm text-slate-500">
              No email templates found.{' '}
              <a href="/templates" className="text-brand-400 hover:underline">
                Create one first
              </a>
              .
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {emailTemplates.map((tpl) => {
                const isSelected = emailTemplateId === tpl.id;
                return (
                  <button
                    key={tpl.id}
                    onClick={() => setEmailTemplateId(tpl.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 rounded-xl border-2 transition-all duration-150 relative',
                      isSelected
                        ? 'bg-brand-500/20 border-brand-400 shadow-[0_0_16px_rgba(99,102,241,0.25)]'
                        : 'bg-surface-700 border-transparent hover:border-white/20 hover:bg-surface-600',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-sm font-semibold', isSelected ? 'text-white' : 'text-slate-200')}>
                        {tpl.name}
                      </p>
                      {isSelected && (
                        <span className="shrink-0 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-brand-500 text-white font-bold tracking-wide">
                          ✓ Selected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5 truncate">
                      Subject: {tpl.subject}
                    </p>
                    {tpl.placeholders && tpl.placeholders.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {tpl.placeholders.map((p) => (
                          <span key={p} className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-600 text-slate-400">
                            {'{{'}{p}{'}}'}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Preview of selected template body */}
          {emailTemplateId && (() => {
            const tpl = emailTemplates.find((t) => t.id === emailTemplateId);
            if (!tpl) return null;
            return (
              <div className="p-3 rounded-xl bg-surface-700/60 border border-white/6">
                <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2">Preview</p>
                <p className="text-xs text-slate-400">
                  <span className="text-slate-500">Subject:</span>{' '}
                  {tpl.subject
                    .replace(/\{\{firstName\}\}/g, selectedClient?.firstName ?? '')
                    .replace(/\{\{lastName\}\}/g,  selectedClient?.lastName  ?? '')
                    .replace(/\{\{email\}\}/g,     selectedClient?.email     ?? '')}
                </p>
              </div>
            );
          })()}

          <div className="flex justify-end gap-3 pt-2 border-t border-white/8">
            <Button variant="outline" size="sm" onClick={() => setIsEmailModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!emailTemplateId || sendEmailMutation.isPending}
              onClick={() => sendEmailMutation.mutate()}
            >
              <Mail size={13} className="mr-1.5" />
              {sendEmailMutation.isPending ? 'Sending…' : 'Send Email'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
