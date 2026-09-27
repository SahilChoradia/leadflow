import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Plus, Trash2, Zap, Mail, CheckSquare, ChevronDown, ChevronUp, Save } from 'lucide-react';
import type { EmailTemplateDto, PaginatedResponse, PipelineStageConfigDto, PipelineStage, TaskConfigItem } from '@leadflow/types';
import { cn } from '../lib/utils';

const STAGES: { value: PipelineStage; label: string; color: string }[] = [
  { value: 'new',       label: 'New',       color: 'text-slate-400  border-slate-500/30  bg-slate-500/10'  },
  { value: 'contacted', label: 'Contacted', color: 'text-blue-400   border-blue-500/30   bg-blue-500/10'   },
  { value: 'qualified', label: 'Qualified', color: 'text-amber-400  border-amber-500/30  bg-amber-500/10'  },
  { value: 'won',       label: 'Won',       color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  { value: 'lost',      label: 'Lost',      color: 'text-rose-400   border-rose-500/30   bg-rose-500/10'   },
];

interface StageCardProps {
  stage: typeof STAGES[0];
  config?: PipelineStageConfigDto;
  templates: EmailTemplateDto[];
}

function StageCard({ stage, config, templates }: StageCardProps) {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [isExpanded, setIsExpanded] = useState(false);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);
  const [emailTemplateId, setEmailTemplateId] = useState(config?.emailTemplateId ?? '');
  const [tasks, setTasks] = useState<TaskConfigItem[]>(config?.tasks ?? []);

  const saveMutation = useMutation({
    mutationFn: async () => {
      await api.put(`/pipeline-stage-configs/${stage.value}`, {
        emailTemplateId: emailTemplateId || null,
        tasks,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stage-configs'] });
      success(`Automation saved for "${stage.label}"`);
      setIsExpanded(false);
    },
    onError: () => toastError('Failed to save automation'),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await api.delete(`/pipeline-stage-configs/${stage.value}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipeline-stage-configs'] });
      success(`Automation cleared for "${stage.label}"`);
      setEmailTemplateId('');
      setTasks([]);
    },
    onError: () => toastError('Failed to clear automation'),
  });

  const isConfigured = !!(config?.emailTemplateId || (config?.tasks && config.tasks.length > 0));

  const addTask = () =>
    setTasks((prev) => [...prev, { title: '', assigneePlaceholder: 'assigned_advisor', dueDaysOffset: 3 }]);

  const updateTask = (idx: number, patch: Partial<TaskConfigItem>) =>
    setTasks((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));

  const removeTask = (idx: number) => setTasks((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className={cn('rounded-2xl border transition-all', stage.color.split(' ').slice(1).join(' '), 'bg-surface-800/60')}>
      {/* Card header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-5 text-left"
      >
        <div className={cn('w-2.5 h-2.5 rounded-full', stage.color.split(' ')[0].replace('text-', 'bg-'))} />
        <div className="flex-1">
          <p className="font-semibold text-white">{stage.label}</p>
          {isConfigured ? (
            <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-2">
              {config?.emailTemplateId && (
                <span className="flex items-center gap-1"><Mail size={11} /> Email template attached</span>
              )}
              {(config?.tasks?.length ?? 0) > 0 && (
                <span className="flex items-center gap-1"><CheckSquare size={11} /> {config!.tasks.length} auto-task{config!.tasks.length !== 1 ? 's' : ''}</span>
              )}
            </p>
          ) : (
            <p className="text-xs text-slate-500 mt-0.5">No automation configured</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConfigured && (
            <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-brand-500/15 text-brand-300 border border-brand-500/20 font-medium">
              <Zap size={10} /> Active
            </span>
          )}
          {isExpanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </div>
      </button>

      {/* Expanded editor */}
      {isExpanded && (
        <div className="px-5 pb-5 space-y-5 border-t border-white/8 pt-5">
          {/* Email template picker */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Mail size={13} /> Auto-send email template
            </label>
            <select
              value={emailTemplateId}
              onChange={(e) => setEmailTemplateId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg bg-surface-700 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-brand-500/50 appearance-none"
            >
              <option value="">— None —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1.5">
              Sent automatically to the lead's email when they enter this stage.
            </p>
          </div>

          {/* Auto-tasks */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <CheckSquare size={13} /> Auto-create tasks
              </label>
              <Button variant="outline" size="sm" onClick={addTask}>
                <Plus size={13} className="mr-1" /> Add task
              </Button>
            </div>

            {tasks.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No auto-tasks. Click "Add task" to create one.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 p-3 rounded-lg bg-surface-700 border border-white/8"
                  >
                    <input
                      type="text"
                      value={task.title}
                      onChange={(e) => updateTask(idx, { title: e.target.value })}
                      placeholder="Task title…"
                      className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 focus:outline-none"
                    />
                    <select
                      value={task.assigneePlaceholder}
                      onChange={(e) =>
                        updateTask(idx, {
                          assigneePlaceholder: e.target.value as 'assigned_advisor' | 'any',
                        })
                      }
                      className="text-xs bg-surface-600 border border-white/8 rounded-md px-2 py-1 text-slate-300 focus:outline-none"
                    >
                      <option value="assigned_advisor">Assigned advisor</option>
                      <option value="any">Any</option>
                    </select>
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                      <input
                        type="number"
                        min={0}
                        max={90}
                        value={task.dueDaysOffset}
                        onChange={(e) => updateTask(idx, { dueDaysOffset: parseInt(e.target.value) || 0 })}
                        className="w-12 bg-surface-600 border border-white/8 rounded-md px-2 py-1 text-slate-300 text-center focus:outline-none"
                      />
                      days
                    </div>
                    <button
                      onClick={() => removeTask(idx)}
                      className="text-slate-600 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-white/8">
            {isConfigured ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmClearOpen(true)}
                disabled={deleteMutation.isPending}
              >
                <Trash2 size={13} className="mr-1.5" />
                Clear automation
              </Button>
            ) : (
              <div />
            )}
            <Button
              size="sm"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              <Save size={13} className="mr-1.5" />
              {saveMutation.isPending ? 'Saving…' : 'Save automation'}
            </Button>
          </div>

          <ConfirmDialog
            isOpen={confirmClearOpen}
            onClose={() => setConfirmClearOpen(false)}
            onConfirm={() => {
              setConfirmClearOpen(false);
              deleteMutation.mutate();
            }}
            title={`Clear automation for "${stage.label}"?`}
            description="This will remove the automated email template and task creation rules configured for this stage."
            confirmLabel="Clear automation"
            variant="danger"
          />
        </div>
      )}
    </div>
  );
}

export default function AutomationPage() {
  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<EmailTemplateDto> }>('/email-templates');
      return res.data.data.items;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: configs = [], isLoading } = useQuery({
    queryKey: ['pipeline-stage-configs'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PipelineStageConfigDto[] }>('/pipeline-stage-configs');
      return res.data.data;
    },
  });

  const configByStage = Object.fromEntries(configs.map((c) => [c.stage, c]));

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-surface-900 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Zap className="text-brand-400" /> Automation
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Configure automatic emails and tasks triggered when a lead moves to a pipeline stage.
          </p>
        </div>
      </div>

      {/* Info banner */}
      <div className="mb-6 p-4 rounded-xl bg-brand-500/8 border border-brand-500/20 flex items-start gap-3">
        <Zap size={16} className="text-brand-400 mt-0.5 shrink-0" />
        <div className="text-sm text-slate-300">
          <p className="font-medium text-brand-300 mb-1">How it works</p>
          <p className="text-slate-400">
            When a lead's pipeline stage changes, LeadFlow automatically sends the configured email template
            to the lead and creates the listed tasks for your team. Use{' '}
            <code className="text-brand-300 text-xs bg-surface-700 px-1 py-0.5 rounded">{'{{firstName}}'}</code>,{' '}
            <code className="text-brand-300 text-xs bg-surface-700 px-1 py-0.5 rounded">{'{{lastName}}'}</code>,{' '}
            <code className="text-brand-300 text-xs bg-surface-700 px-1 py-0.5 rounded">{'{{email}}'}</code>{' '}
            and{' '}
            <code className="text-brand-300 text-xs bg-surface-700 px-1 py-0.5 rounded">{'{{stage}}'}</code>{' '}
            as placeholders in your email templates.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-surface-800 rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {STAGES.map((stage) => (
            <StageCard
              key={stage.value}
              stage={stage}
              config={configByStage[stage.value]}
              templates={templates}
            />
          ))}
        </div>
      )}
    </div>
  );
}
