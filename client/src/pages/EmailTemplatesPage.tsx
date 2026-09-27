import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { Plus, Trash2, Mail } from 'lucide-react';
import type { EmailTemplateDto, PaginatedResponse } from '@leadflow/types';

export default function EmailTemplatesPage() {
  const { user } = useAuth();
  const { success, error: toastError } = useToast();
  const queryClient = useQueryClient();

  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplateDto | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({ name: '', subject: '', bodyHtml: '' });
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: PaginatedResponse<EmailTemplateDto> }>('/email-templates');
      return res.data.data.items;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const res = await api.post<{ success: boolean; data: EmailTemplateDto }>('/email-templates', data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      success('Template created successfully');
      setIsEditing(false);
    },
    onError: () => toastError('Failed to create template'),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      const res = await api.patch<{ success: boolean; data: EmailTemplateDto }>(`/email-templates/${id}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      success('Template updated successfully');
      setIsEditing(false);
    },
    onError: () => toastError('Failed to update template'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/email-templates/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      success('Template deleted successfully');
      setIsEditing(false);
    },
    onError: () => toastError('Failed to delete template'),
  });

  const handleSave = () => {
    if (selectedTemplate) {
      updateMutation.mutate({ id: selectedTemplate.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const openCreate = () => {
    setSelectedTemplate(null);
    setFormData({ name: '', subject: '', bodyHtml: '' });
    setIsEditing(true);
  };

  const openEdit = (template: EmailTemplateDto) => {
    setSelectedTemplate(template);
    setFormData({ name: template.name, subject: template.subject, bodyHtml: template.bodyHtml });
    setIsEditing(true);
  };

  return (
    <div className="flex-1 p-8 overflow-y-auto bg-surface-900 text-slate-200">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="text-brand-400" /> Email Templates
          </h1>
          <p className="text-sm text-slate-400 mt-1">Manage email templates used in automation and client communications.</p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus size={16} className="mr-2" /> New Template
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List of templates */}
        <div className="col-span-1 border-r border-white/10 pr-6 space-y-4">
          <h2 className="text-lg font-semibold text-white mb-4">Your Templates</h2>
          {isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-16 bg-surface-800 rounded-xl" />
              <div className="h-16 bg-surface-800 rounded-xl" />
            </div>
          ) : templates.length === 0 ? (
            <EmptyState
              icon={Mail}
              size="sm"
              title="No templates found"
              description="Create a reusable email template to streamline your automated outreach."
            />
          ) : (
            templates.map((tpl) => (
              <div
                key={tpl.id}
                onClick={() => openEdit(tpl)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  selectedTemplate?.id === tpl.id
                    ? 'bg-brand-500/10 border-brand-500/50 shadow-[0_0_15px_rgba(var(--color-brand-500),0.1)]'
                    : 'bg-surface-800 border-white/10 hover:border-brand-500/30'
                }`}
              >
                <h3 className="font-medium text-slate-200">{tpl.name}</h3>
                <p className="text-xs text-slate-500 mt-1 line-clamp-1">{tpl.subject}</p>
                {tpl.placeholders && tpl.placeholders.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {tpl.placeholders.map((p) => (
                      <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-700 text-slate-400">
                        {'{'}{'{'}{p}{'}'}{'}'}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="col-span-2">
          {isEditing ? (
            <div className="glass p-6 rounded-2xl border border-white/10 space-y-5">
              <h2 className="text-xl font-bold text-white border-b border-white/10 pb-3">
                {selectedTemplate ? 'Edit Template' : 'Create Template'}
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Template Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Welcome Email"
                    className="w-full bg-surface-800 border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email Subject</label>
                  <Input
                    value={formData.subject}
                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                    placeholder="e.g. Welcome to {{brokerageName}}"
                    className="w-full bg-surface-800 border-white/10 text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">Email Body (HTML format)</label>
                  <p className="text-xs text-slate-500 mb-2">You can use placeholders like {'{{firstName}}'}, {'{{lastName}}'}, {'{{email}}'}, {'{{stage}}'}.</p>
                  <textarea
                    value={formData.bodyHtml}
                    onChange={(e) => setFormData({ ...formData, bodyHtml: e.target.value })}
                    className="w-full h-64 p-3 rounded-lg bg-surface-800 border border-white/10 text-slate-200 text-sm focus:outline-none focus:border-brand-500/50 font-mono"
                    placeholder="<p>Hello {{firstName}},</p>"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-white/10">
                {selectedTemplate ? (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => setConfirmDeleteOpen(true)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 size={16} className="mr-2" /> Delete
                  </Button>
                ) : (
                  <div />
                )}
                
                <div className="space-x-3">
                  <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSave}
                    disabled={createMutation.isPending || updateMutation.isPending || !formData.name || !formData.subject || !formData.bodyHtml}
                  >
                    {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Template'}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-slate-500 border-2 border-dashed border-white/5 rounded-2xl p-8">
              <Mail size={48} className="mb-4 text-slate-600" />
              <p>Select a template from the list to edit, or create a new one.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={() => {
          if (selectedTemplate) deleteMutation.mutate(selectedTemplate.id);
          setConfirmDeleteOpen(false);
        }}
        title="Delete template?"
        description={`"${selectedTemplate?.name}" will be permanently deleted and removed from all automation rules.`}
        confirmLabel="Delete"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
