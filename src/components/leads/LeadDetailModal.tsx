import React from 'react';
import type { Lead } from '../../types';
import {
  X,
  Building,
  Mail,
  MapPin,
  Sparkles,
  Zap,
  Kanban,
} from 'lucide-react';


interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  onMoveToPipeline?: (leadId: string) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  onClose,
  onMoveToPipeline,
}) => {
  if (!lead) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="relative border-b border-slate-800 bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-900 p-6">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-start gap-4">
            <img
              src={lead.avatar}
              alt={lead.name}
              className="h-16 w-16 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-md"
            />
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-white">{lead.name}</h3>
                <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-400 font-mono">
                  {lead.score} / 100 ICP Match
                </span>
              </div>
              <p className="text-sm font-medium text-slate-300 mt-0.5">{lead.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-indigo-400" />
                  {lead.company}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {lead.location}
                </span>
                <span>•</span>
                <span className="text-emerald-400 font-bold font-mono">
                  ${lead.dealValue.toLocaleString()} ARR
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* AI Match Explanation */}
          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 p-4">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20">
              <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Sparkles className="h-4 w-4 text-amber-400" />
                Autonomous Fit Analysis
              </span>
              <span className="text-xs font-mono font-bold text-emerald-400">Tier A Priority</span>
            </div>
            <p className="mt-2.5 text-xs text-slate-300 leading-relaxed">
              Match score was computed based on exact persona alignment ({lead.title}), enterprise growth velocity, and active intent triggers detected within the last 72 hours.
            </p>
          </div>

          {/* Buying Triggers Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Detected Buying Triggers & Signals
            </h4>
            <div className="space-y-1.5">
              {lead.triggers.map((trigger, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs text-slate-200"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                  <span className="font-medium">{trigger}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Firmographics & Contact Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block text-[11px]">Direct Work Email</span>
              <span className="font-medium text-slate-200 font-mono select-all flex items-center gap-1.5 mt-0.5">
                <Mail className="h-3.5 w-3.5 text-indigo-400" />
                {lead.email}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block text-[11px]">Company Domain</span>
              <span className="font-medium text-slate-200 font-mono flex items-center gap-1.5 mt-0.5">
                <Building className="h-3.5 w-3.5 text-indigo-400" />
                {lead.companyDomain}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block text-[11px]">Industry</span>
              <span className="font-medium text-slate-200 mt-0.5 block">{lead.industry}</span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block text-[11px]">Company Headcount</span>
              <span className="font-medium text-slate-200 mt-0.5 block">
                {lead.companySize} employees
              </span>
            </div>
          </div>

          {/* SDR & Agent Notes */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <span className="text-xs font-semibold text-slate-400 block">Agent Intelligence Notes</span>
            <p className="mt-1 text-xs text-slate-300 italic">{lead.notes}</p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Current Stage:</span>
            <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-200">
              {lead.status}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (onMoveToPipeline) onMoveToPipeline(lead.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30"
            >
              <Kanban className="h-4 w-4" />
              View in Pipeline
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
