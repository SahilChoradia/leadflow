import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import {
  CheckSquare,
  Square,
  Trash2,
  Plus,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ListTodo,
} from 'lucide-react';
import type { TaskDto, PaginatedResponse } from '@leadflow/types';
import { cn } from '../lib/utils';
import { EmptyState } from '../components/ui/EmptyState';

function formatDate(iso?: string) {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium' }).format(new Date(iso));
}

export default function TasksPage() {
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [showCompleted, setShowCompleted] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDue, setNewTaskDue] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', showCompleted],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<TaskDto> }>(
        `/tasks?completed=${showCompleted}&limit=200`,
      );
      return res.data.data.items;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await api.post<{ success: boolean; data: TaskDto }>('/tasks', {
        title: newTaskTitle,
        dueDate: newTaskDue || undefined,
      });
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      success('Task created');
      setNewTaskTitle('');
      setNewTaskDue('');
      setIsAdding(false);
    },
    onError: () => toastError('Failed to create task'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isCompleted }: { id: string; isCompleted: boolean }) => {
      await api.patch(`/tasks/${id}`, { isCompleted });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: () => toastError('Failed to update task'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      success('Task deleted');
    },
    onError: () => toastError('Failed to delete task'),
  });

  const overdueTasks   = tasks.filter((t) => t.isOverdue);
  const dueTodayTasks  = tasks.filter((t) => {
    if (!t.dueDate || t.isCompleted || t.isOverdue) return false;
    const today = new Date();
    const due   = new Date(t.dueDate);
    return (
      due.getFullYear() === today.getFullYear() &&
      due.getMonth()    === today.getMonth() &&
      due.getDate()     === today.getDate()
    );
  });
  const upcomingTasks  = tasks.filter((t) => !t.isOverdue && !dueTodayTasks.includes(t));

  const renderTask = (task: TaskDto) => (
    <div
      key={task.id}
      className={cn(
        'flex items-start gap-3 px-4 py-3.5 rounded-xl border transition-all group',
        task.isCompleted
          ? 'bg-surface-800/40 border-white/5 opacity-60'
          : task.isOverdue
          ? 'bg-rose-500/5 border-rose-500/20'
          : 'bg-surface-800 border-white/8 hover:border-brand-500/30',
      )}
    >
      <button
        onClick={() => toggleMutation.mutate({ id: task.id, isCompleted: !task.isCompleted })}
        className="mt-0.5 shrink-0 text-slate-400 hover:text-brand-400 transition-colors"
        title={task.isCompleted ? 'Mark incomplete' : 'Mark complete'}
      >
        {task.isCompleted ? (
          <CheckCircle2 size={18} className="text-emerald-400" />
        ) : (
          <Square size={18} />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium', task.isCompleted ? 'line-through text-slate-500' : 'text-slate-200')}>
          {task.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {task.dueDate && (
            <span
              className={cn(
                'flex items-center gap-1 text-[11px]',
                task.isOverdue ? 'text-rose-400' : 'text-slate-500',
              )}
            >
              {task.isOverdue ? <AlertTriangle size={11} /> : <Clock size={11} />}
              {task.isOverdue ? 'Overdue · ' : ''}Due {formatDate(task.dueDate)}
            </span>
          )}
          {task.leadId && (
            <span className="text-[11px] text-slate-500 px-1.5 py-0.5 rounded-full bg-surface-700">Lead</span>
          )}
        </div>
      </div>

      <button
        onClick={() => deleteMutation.mutate(task.id)}
        className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-rose-400 transition-all p-1 rounded"
        title="Delete task"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );

  const Section = ({
    title,
    items,
    accent,
  }: {
    title: string;
    items: TaskDto[];
    accent?: string;
  }) =>
    items.length === 0 ? null : (
      <div className="mb-6">
        <h3 className={cn('text-xs font-semibold uppercase tracking-widest mb-3', accent ?? 'text-slate-500')}>
          {title} · {items.length}
        </h3>
        <div className="space-y-2">{items.map(renderTask)}</div>
      </div>
    );

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-surface-900 text-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListTodo className="text-brand-400" /> Tasks
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track follow-ups and action items across your pipeline.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCompleted((v) => !v)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg border transition-all',
              showCompleted
                ? 'bg-brand-500/15 border-brand-500/40 text-brand-300'
                : 'border-white/10 text-slate-400 hover:text-slate-200',
            )}
          >
            {showCompleted ? 'Hide Completed' : 'Show Completed'}
          </button>
          <Button size="sm" onClick={() => setIsAdding(true)}>
            <Plus size={16} className="mr-2" /> New Task
          </Button>
        </div>
      </div>

      {/* Quick-add form */}
      {isAdding && (
        <div className="glass p-4 rounded-xl border border-brand-500/30 mb-6 flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-xs text-slate-400 mb-1">Task title</label>
            <Input
              autoFocus
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newTaskTitle.trim()) createMutation.mutate();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              placeholder="e.g. Call back Johann Schmidt"
              className="w-full bg-surface-800 border-white/10 text-white"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Due date (optional)</label>
            <input
              type="date"
              value={newTaskDue}
              onChange={(e) => setNewTaskDue(e.target.value)}
              className="px-3 py-2 rounded-lg bg-surface-800 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-brand-500/50"
            />
          </div>
          <Button
            size="sm"
            onClick={() => createMutation.mutate()}
            disabled={!newTaskTitle.trim() || createMutation.isPending}
          >
            {createMutation.isPending ? 'Adding…' : 'Add'}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>
            Cancel
          </Button>
        </div>
      )}

      {/* Task list */}
      {isLoading ? (
        <div className="animate-pulse space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-14 bg-surface-800 rounded-xl" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="All clear!"
          description="No open tasks. Create one or move a lead to trigger automation tasks."
          action={
            <Button size="sm" onClick={() => setIsAdding(true)}>
              <Plus size={16} className="mr-2" /> New Task
            </Button>
          }
        />
      ) : (
        <>
          <Section title="Overdue"  items={overdueTasks}  accent="text-rose-400" />
          <Section title="Due today" items={dueTodayTasks} accent="text-amber-400" />
          <Section title="Upcoming" items={upcomingTasks} />
        </>
      )}
    </div>
  );
}
