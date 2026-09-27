import { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import type { LeadDto } from '@leadflow/types';
import { Badge } from '../ui/Badge';
import { cn } from '../../lib/utils';
import { Mail, Phone, AlertTriangle, User } from 'lucide-react';

interface LeadCardProps {
  lead:    LeadDto;
  index:   number;
  onClick: (lead: LeadDto) => void;
  /** Briefly highlighted when updated by another user in real-time */
  isHighlighted?: boolean;
}

function initials(first: string, last: string) {
  return `${first[0] ?? ''}${last[0] ?? ''}`.toUpperCase();
}

export function LeadCard({ lead, index, onClick, isHighlighted }: LeadCardProps) {
  const [hover, setHover] = useState(false);

  return (
    <Draggable draggableId={lead.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          style={{
            ...provided.draggableProps.style,
            cursor: snapshot.isDragging ? 'grabbing' : 'grab',
          }}
          onClick={(e) => {
            // Prevent modal open if user just finished dragging
            if (!snapshot.isDragging) {
              onClick(lead);
            }
          }}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className={cn(
            'glass rounded-xl p-4 select-none',
            'border',
            snapshot.isDragging
              ? 'border-brand-500/80 shadow-glow-brand scale-[1.03] z-50'
              : 'transition-colors duration-150',
            isHighlighted
              ? 'border-brand-500/50 shadow-glow-brand animate-pulse-soft'
              : hover && !snapshot.isDragging
              ? 'border-brand-500/30 shadow-glow-brand/20'
              : 'border-white/6',
          )}
        >
          {/* Header row */}
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="w-8 h-8 rounded-full gradient-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials(lead.firstName, lead.lastName)}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-100 truncate">
                {lead.firstName} {lead.lastName}
              </p>
              <div className="flex items-center gap-1 mt-0.5">
                <Mail size={11} className="text-slate-500 shrink-0" />
                <p className="text-xs text-slate-400 truncate">{lead.email}</p>
              </div>
            </div>

            {/* Duplicate flag */}
            {lead.isDuplicate && (
              <span title="Duplicate lead detected">
                <AlertTriangle size={14} className="text-warning-500 shrink-0" />
              </span>
            )}
          </div>

          {/* Footer row */}
          <div className="flex items-center gap-2 mt-3">
            <Badge source={lead.source} />
            {lead.phone && (
              <span className="flex items-center gap-1 text-[10px] text-slate-500">
                <Phone size={10} />
                {lead.phone}
              </span>
            )}
            {lead.assignedAdvisorId && (
              <span className="ml-auto flex items-center gap-1 text-[10px] text-slate-500">
                <User size={10} />
                Assigned
              </span>
            )}
          </div>
        </div>
      )}
    </Draggable>
  );
}
