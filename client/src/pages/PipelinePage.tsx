import { useState, useCallback, useEffect } from 'react';
import { DragDropContext, Droppable, DropResult } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { useSocket } from '../contexts/SocketContext';
import { LeadCard } from '../components/leads/LeadCard';
import { LeadModal } from '../components/leads/LeadModal';
import { ColumnSkeleton } from '../components/ui/Skeleton';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../lib/utils';
import { Plus } from 'lucide-react';
import type { LeadDto, PipelineStage, CreateLeadInput, PaginatedResponse } from '@leadflow/types';

// ── Column definitions ─────────────────────────────────────────────────────────
const COLUMNS: { stage: PipelineStage; label: string; color: string }[] = [
  { stage: 'new',       label: 'New',       color: 'border-t-brand-500' },
  { stage: 'contacted', label: 'Contacted', color: 'border-t-blue-500'  },
  { stage: 'qualified', label: 'Qualified', color: 'border-t-yellow-500' },
  { stage: 'won',       label: 'Won',       color: 'border-t-green-500'  },
  { stage: 'lost',      label: 'Lost',      color: 'border-t-red-500'    },
];

// ── Hooks ──────────────────────────────────────────────────────────────────────
function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<LeadDto> }>('/leads?limit=200');
      return res.data.data.items;
    },
    staleTime: 30_000,
  });
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PipelinePage() {
  const { user } = useAuth();
  const { success, error: toastError, warning, info } = useToast();
  const queryClient = useQueryClient();
  const { socket } = useSocket();

  const { data: leads = [], isLoading } = useLeads();

  const [selectedLead, setSelectedLead] = useState<LeadDto | null>(null);
  const [isModalOpen,  setIsModalOpen]  = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  // ── Real-Time Socket Listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleCreated = (newLead: LeadDto) => {
      queryClient.setQueryData<LeadDto[]>(['leads'], (prev = []) => {
        if (prev.some((l) => l.id === newLead.id)) return prev;
        return [newLead, ...prev];
      });
      setHighlightedId(newLead.id);
      setTimeout(() => setHighlightedId((curr) => (curr === newLead.id ? null : curr)), 3000);
      info('New lead received', `${newLead.firstName} ${newLead.lastName}`);
    };

    const handleUpdated = (updatedLead: LeadDto) => {
      queryClient.setQueryData<LeadDto[]>(['leads'], (prev = []) =>
        prev.map((l) => (l.id === updatedLead.id ? updatedLead : l)),
      );
      setHighlightedId(updatedLead.id);
      setTimeout(() => setHighlightedId((curr) => (curr === updatedLead.id ? null : curr)), 3000);
    };

    const handleDeleted = ({ id }: { id: string }) => {
      queryClient.setQueryData<LeadDto[]>(['leads'], (prev = []) =>
        prev.filter((l) => l.id !== id),
      );
      if (selectedLead?.id === id) {
        setIsModalOpen(false);
        setSelectedLead(null);
      }
    };

    socket.on('lead:created', handleCreated);
    socket.on('lead:updated', handleUpdated);
    socket.on('lead:deleted', handleDeleted);

    return () => {
      socket.off('lead:created', handleCreated);
      socket.off('lead:updated', handleUpdated);
      socket.off('lead:deleted', handleDeleted);
    };
  }, [socket, queryClient, selectedLead?.id, info]);

  // Group leads by stage
  const byStage = useCallback(
    (stage: PipelineStage) => leads.filter((l) => l.stage === stage),
    [leads],
  );

  // ── Create lead ──────────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (data: CreateLeadInput) => {
      const res = await api.post<{ success: boolean; data: LeadDto }>('/leads', data);
      return res.data.data;
    },
    onSuccess: (lead) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      success('Lead created', `${lead.firstName} ${lead.lastName}`);
      if (lead.isDuplicate) warning('Duplicate detected', 'This lead may already exist');
      setIsModalOpen(false);
      setSelectedLead(null);
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toastError('Failed to create lead', msg);
    },
  });

  // ── Update lead ──────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await api.patch<{ success: boolean; data: LeadDto; currentVersion?: number }>(
        `/leads/${id}`,
        data,
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
    },
    onError: (err: unknown, variables) => {
      const status = (err as { response?: { status?: number; data?: { error?: string; data?: LeadDto } } })?.response?.status;
      if (status === 409) {
        // Conflict — revert optimistic update and notify user
        queryClient.invalidateQueries({ queryKey: ['leads'] });
        const serverLead = (err as { response?: { data?: { data?: LeadDto } } })?.response?.data?.data;
        if (serverLead) setHighlightedId(serverLead.id);
        toastError(
          'Edit conflict',
          'Someone else moved this lead. The board has been refreshed.',
        );
      } else {
        const errorData = (err as { response?: { data?: { error?: string; errors?: Array<{ field: string; message: string }> } } })?.response?.data;
        const msg = errorData?.errors?.map((e) => `${e.field}: ${e.message}`).join(', ') || errorData?.error;
        toastError('Update failed', msg);
      }
      void variables;
    },
  });

  // ── Delete lead ──────────────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/leads/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      success('Lead deleted');
      setIsModalOpen(false);
      setSelectedLead(null);
    },
    onError: () => toastError('Failed to delete lead'),
  });

  // ── Convert to client ────────────────────────────────────────────────────────
  const convertMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post<{
        success: boolean;
        data: { client: any; credentials?: { email: string; temporaryPassword?: string } };
        message: string;
      }>(`/leads/${id}/convert`, {});
      return res.data;
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      const creds = res.data?.credentials;
      success(
        'Lead converted to Client!',
        creds?.temporaryPassword
          ? `Portal credentials: ${creds.email} / ${creds.temporaryPassword}`
          : 'Active client portal profile established'
      );
      setIsModalOpen(false);
      setSelectedLead(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.error || 'Failed to convert lead';
      toastError('Conversion failed', msg);
    },
  });

  // ── Drag & drop handler ───────────────────────────────────────────────────────
  const onDragEnd = useCallback(
    (result: DropResult) => {
      const { destination, source, draggableId } = result;
      if (!destination || destination.droppableId === source.droppableId) return;

      const newStage = destination.droppableId as PipelineStage;
      const lead = leads.find((l) => l.id === draggableId);
      if (!lead) return;

      // Optimistic UI — update local cache immediately
      queryClient.setQueryData<LeadDto[]>(['leads'], (prev = []) =>
        prev.map((l) => (l.id === draggableId ? { ...l, stage: newStage } : l)),
      );

      // Persist — include version for optimistic concurrency check
      updateMutation.mutate({
        id:   draggableId,
        data: { stage: newStage, version: lead.version },
      });
    },
    [leads, queryClient, updateMutation],
  );

  // ── Handle card click ─────────────────────────────────────────────────────────
  const openEdit = (lead: LeadDto) => {
    setSelectedLead(lead);
    setIsModalOpen(true);
  };

  const openCreate = () => {
    setSelectedLead(null);
    setIsModalOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Page header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/6 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-white">Pipeline</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {leads.length} leads · drag to move stages
          </p>
        </div>
        {user?.role !== 'client' && (
          <Button onClick={openCreate} size="sm">
            <Plus size={15} />
            New Lead
          </Button>
        )}
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS.map(({ stage, label, color }) => {
              const columnLeads = byStage(stage);
              return (
                <div
                  key={stage}
                  className={cn(
                    'flex flex-col w-64 shrink-0 rounded-xl bg-surface-800/40 border-t-2',
                    color,
                  )}
                >
                  {/* Column header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                    <span className="text-sm font-semibold text-slate-200">{label}</span>
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-700 text-slate-400">
                      {columnLeads.length}
                    </span>
                  </div>

                  {/* Droppable area */}
                  <Droppable droppableId={stage}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={cn(
                          'flex-1 overflow-y-auto p-3 space-y-2.5 min-h-[120px] transition-colors duration-150 rounded-b-xl',
                          snapshot.isDraggingOver && 'bg-brand-500/5',
                        )}
                      >
                        {isLoading ? (
                          <ColumnSkeleton />
                        ) : columnLeads.length === 0 ? (
                          <div className="flex items-center justify-center h-20 border-2 border-dashed border-white/8 rounded-xl">
                            <p className="text-xs text-slate-600">Drop here</p>
                          </div>
                        ) : (
                          columnLeads.map((lead, index) => (
                            <LeadCard
                              key={lead.id}
                              lead={lead}
                              index={index}
                              onClick={openEdit}
                              isHighlighted={highlightedId === lead.id}
                            />
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      {/* Lead Modal */}
      <LeadModal
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setSelectedLead(null); }}
        lead={selectedLead}
        onSave={async (data) => {
          try {
            if (selectedLead) {
              await updateMutation.mutateAsync({
                id:   selectedLead.id,
                data: { ...data, version: selectedLead.version },
              });
              queryClient.invalidateQueries({ queryKey: ['leads'] });
              success('Lead updated');
              setIsModalOpen(false);
              setSelectedLead(null);
            } else {
              await createMutation.mutateAsync(data);
            }
          } catch {
            // Error handled by mutation onError
          }
        }}
        onDelete={selectedLead ? async () => deleteMutation.mutate(selectedLead.id) : undefined}
        onConvertToClient={selectedLead ? async () => convertMutation.mutate(selectedLead.id) : undefined}
        isSaving={createMutation.isPending || updateMutation.isPending}
        isConverting={convertMutation.isPending}
      />
    </div>
  );
}
