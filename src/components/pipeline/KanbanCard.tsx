import React from 'react';
import type { Lead } from '../../types';
import {
  ChevronRight,
  ChevronLeft,
  Eye,
} from 'lucide-react';


interface KanbanCardProps {
  lead: Lead;
  onSelectLead: (lead: Lead) => void;
  onMoveStage: (leadId: string, direction: 'prev' | 'next') => void;
  isFirstStage: boolean;
  isLastStage: boolean;
}

export const KanbanCard: React.FC<KanbanCardProps> = ({
  lead,
  onSelectLead,
  onMoveStage,
  isFirstStage,
  isLastStage,
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-800 bg-emerald-50 border-emerald-300';
    if (score >= 75) return 'text-indigo-800 bg-indigo-50 border-indigo-300';
    return 'text-amber-800 bg-amber-50 border-amber-300';
  };

  return (
    <div className="group relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs hover:border-slate-300 hover:shadow-md transition-all">
      {/* Top row: Avatar & Name + Score */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => onSelectLead(lead)}
        >
          <img
            src={lead.avatar}
            alt={lead.name}
            className="h-8 w-8 rounded-full object-cover border border-slate-200 shadow-2xs"
          />
          <div>
            <h4 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1">
              {lead.name}
            </h4>
            <p className="text-[11px] text-slate-500 line-clamp-1 font-medium">{lead.company}</p>
          </div>
        </div>

        <span
          className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold font-mono border ${getScoreColor(
            lead.score
          )}`}
          title={`Fit Score: ${lead.score}/100`}
        >
          {lead.score}
        </span>
      </div>

      {/* Role title */}
      <p className="mt-2 text-[11px] text-slate-600 line-clamp-1">{lead.title}</p>

      {/* Trigger or note */}
      <div className="mt-2.5">
        <span className="inline-block rounded bg-slate-50 border border-slate-200 px-2 py-0.5 text-[10px] text-slate-700 line-clamp-1 font-medium">
          ⚡ {lead.triggers[0]}
        </span>
      </div>

      {/* Footer: Deal value & Stage Controls */}
      <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
        <span className="text-xs font-bold text-emerald-700 font-mono">
          ${lead.dealValue.toLocaleString()}
        </span>

        {/* Action Arrows */}
        <div className="flex items-center gap-1">
          {!isFirstStage && (
            <button
              onClick={() => onMoveStage(lead.id, 'prev')}
              title="Move to previous stage"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            onClick={() => onSelectLead(lead)}
            title="Inspect lead"
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>

          {!isLastStage && (
            <button
              onClick={() => onMoveStage(lead.id, 'next')}
              title="Advance to next stage"
              className="rounded p-1 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-800 transition-colors"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
