import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { UserCheck } from 'lucide-react';
import type { LeadDto, CreateLeadInput, PipelineStage } from '@leadflow/types';

interface LeadModalProps {
  isOpen:  boolean;
  onClose: () => void;
  lead?:   LeadDto | null;    // null = create mode
  onSave:  (data: CreateLeadInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onConvertToClient?: () => Promise<void>;
  isSaving?: boolean;
  isConverting?: boolean;
}

interface FormValues {
  firstName: string;
  lastName:  string;
  email:     string;
  phone:     string;
  source:    string;
  notes:     string;
}

const STAGES: PipelineStage[] = ['new', 'contacted', 'qualified', 'won', 'lost'];

export function LeadModal({
  isOpen,
  onClose,
  lead,
  onSave,
  onDelete,
  onConvertToClient,
  isSaving,
  isConverting,
}: LeadModalProps) {
  const isEdit = !!lead;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      firstName: lead?.firstName ?? '',
      lastName:  lead?.lastName  ?? '',
      email:     lead?.email     ?? '',
      phone:     lead?.phone     ?? '',
      source:    lead?.source    ?? 'manual',
      notes:     lead?.notes     ?? '',
    },
  });

  // Reset when lead changes
  useEffect(() => {
    reset({
      firstName: lead?.firstName ?? '',
      lastName:  lead?.lastName  ?? '',
      email:     lead?.email     ?? '',
      phone:     lead?.phone     ?? '',
      source:    lead?.source    ?? 'manual',
      notes:     lead?.notes     ?? '',
    });
  }, [lead, reset]);

  const onSubmit = async (values: FormValues) => {
    await onSave({
      firstName: values.firstName,
      lastName:  values.lastName,
      email:     values.email,
      phone:     values.phone || undefined,
      source:    values.source || 'manual',
      notes:     values.notes || undefined,
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={isEdit ? 'Edit Lead' : 'New Lead'}>
      {/* Duplicate warning */}
      {lead?.isDuplicate && (
        <div className="mb-4 p-3 rounded-lg bg-warning-500/10 border border-warning-500/30 text-warning-400 text-xs">
          ⚠️ Duplicate detected — this lead shares an email or phone with an existing record.
        </div>
      )}

      {/* Stage badges (view-only in modal — drag to change) */}
      {isEdit && (
        <div className="flex items-center gap-2 mb-4 pb-4 border-b border-white/6">
          <span className="text-xs text-slate-500">Stage:</span>
          <Badge stage={lead?.stage as PipelineStage} />
          <span className="text-xs text-slate-500 ml-auto">
            v{lead?.version} · drag card to move
          </span>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="First Name"
            required
            {...register('firstName', { required: 'Required' })}
            error={errors.firstName?.message}
          />
          <Input
            label="Last Name"
            required
            {...register('lastName', { required: 'Required' })}
            error={errors.lastName?.message}
          />
        </div>

        <Input
          label="Email"
          type="email"
          required
          {...register('email', {
            required: 'Required',
            pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
          })}
          error={errors.email?.message}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone" placeholder="+49 151 …" {...register('phone')} />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-slate-300">Source</label>
            <select
              {...register('source')}
              className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-white/10 text-slate-100 text-sm outline-none focus:border-brand-500"
            >
              <option value="manual">Manual</option>
              <option value="typeform">Typeform</option>
              <option value="fb_ads">Facebook Ads</option>
              <option value="referral">Referral</option>
              <option value="website">Website</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-slate-300">Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            placeholder="Internal notes about this lead…"
            className="w-full px-3 py-2 rounded-lg bg-surface-700 border border-white/10 text-slate-100 text-sm outline-none focus:border-brand-500 resize-none placeholder:text-slate-500"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          {isEdit && onDelete && (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={onDelete}
              disabled={isSaving || isConverting}
            >
              Delete
            </Button>
          )}

          {isEdit && onConvertToClient && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onConvertToClient}
              isLoading={isConverting}
              disabled={isSaving || isConverting}
              className="border-brand-500/40 text-brand-300 hover:bg-brand-500/20"
            >
              <UserCheck size={14} className="mr-1.5" />
              Convert to Client
            </Button>
          )}

          <div className="flex gap-2 ml-auto">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" isLoading={isSaving} disabled={isConverting}>
              {isEdit ? 'Save Changes' : 'Create Lead'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
