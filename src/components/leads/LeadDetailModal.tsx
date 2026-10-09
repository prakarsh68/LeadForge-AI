import React, { useState } from 'react';
import type { Lead, LeadStatus, EvaluationStatus } from '../../types';
import {
  X,
  Building,
  Mail,
  MapPin,
  Sparkles,
  Zap,
  Kanban,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Info,
  ExternalLink,
} from 'lucide-react';

interface LeadDetailModalProps {
  lead: Lead | null;
  onClose: () => void;
  onMoveToPipeline?: (leadId: string) => void;
  onUpdateStatus?: (leadId: string, status: LeadStatus) => void;
  onUpdateNotes?: (leadId: string, notes: string) => void;
  onDeleteLead?: (leadId: string) => void;
  onQualifyLead?: (leadId: string) => Promise<any>;
}

const ALL_STAGES: LeadStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal',
  'Won',
  'Disqualified',
];

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  onClose,
  onMoveToPipeline,
  onUpdateStatus,
  onUpdateNotes,
  onDeleteLead,
  onQualifyLead,
}) => {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(lead?.notes || '');
  const [savedNotesToast, setSavedNotesToast] = useState(false);
  const [isQualifying, setIsQualifying] = useState(false);
  const [qualifyError, setQualifyError] = useState<string | null>(null);

  if (!lead) return null;

  const handleSaveNotes = () => {
    onUpdateNotes?.(lead.id, notesValue);
    setEditingNotes(false);
    setSavedNotesToast(true);
    setTimeout(() => setSavedNotesToast(false), 2000);
  };

  const handleDelete = () => {
    if (window.confirm(`Are you sure you want to delete lead "${lead.name}"? This action will remove associated pipeline records.`)) {
      onDeleteLead?.(lead.id);
      onClose();
    }
  };

  const handleQualify = async () => {
    if (!lead || !onQualifyLead) return;
    setIsQualifying(true);
    setQualifyError(null);
    try {
      await onQualifyLead(lead.id);
    } catch (err: any) {
      setQualifyError(err.message || 'Failed to qualify lead');
    } finally {
      setIsQualifying(false);
    }
  };

  const breakdown = lead.qualificationBreakdown;

  const renderStatusBadge = (status: EvaluationStatus) => {
    switch (status) {
      case 'match':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Match
          </span>
        );
      case 'partial':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
            <AlertTriangle className="h-3 w-3" /> Partial
          </span>
        );
      case 'mismatch':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400">
            <XCircle className="h-3 w-3" /> Mismatch
          </span>
        );
      case 'no_data':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
            <HelpCircle className="h-3 w-3" /> No Data
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
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

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <img
                src={lead.avatar}
                alt={lead.name}
                className="h-16 w-16 rounded-2xl object-cover border-2 border-indigo-500/40 shadow-md flex-shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-white">{lead.name}</h3>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-bold font-mono ${
                      lead.score >= 80
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : lead.score >= 60
                        ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
                        : 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                    }`}
                  >
                    {lead.score} / 100 ICP Match
                  </span>
                  <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-medium text-slate-300 uppercase tracking-wide">
                    {lead.tier} tier
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

            {/* Qualify Action Button */}
            {onQualifyLead && (
              <div className="self-start sm:self-center">
                <button
                  onClick={handleQualify}
                  disabled={isQualifying}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-500/50 bg-indigo-600/20 px-3.5 py-2 text-xs font-semibold text-indigo-300 hover:bg-indigo-600/30 hover:text-white transition-all shadow-sm disabled:opacity-50"
                  title="Run deterministic ICP scoring engine"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isQualifying ? 'animate-spin text-indigo-400' : ''}`} />
                  {isQualifying ? 'Scoring Lead...' : 'Qualify Lead'}
                </button>
              </div>
            )}
          </div>

          {qualifyError && (
            <div className="mt-3 rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-1.5 text-xs text-rose-300">
              {qualifyError}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Explainable ICP Qualification Engine Results */}
          {breakdown ? (
            <div className="rounded-2xl border border-indigo-500/30 bg-slate-950/50 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800 gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-400" />
                  <span className="text-xs font-bold text-indigo-300 uppercase tracking-wider">
                    Explainable ICP Score Breakdown
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-medium">Profile:</span>
                  <span className="text-slate-200 font-semibold">{breakdown.icpProfileName}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      breakdown.isQualified
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {breakdown.isQualified ? '✓ Qualified' : 'Below Threshold'}
                  </span>
                </div>
              </div>

              {/* Criterion-Level Scoring Cards */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Evaluated Criteria Breakdown
                </div>
                <div className="space-y-2">
                  {breakdown.criteria.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-200">{c.name}</span>
                          {renderStatusBadge(c.status)}
                        </div>
                        <div className="text-xs font-mono font-bold">
                          {c.id === 'negative_keywords' ? (
                            c.pointsEarned < 0 ? (
                              <span className="text-rose-400">{c.pointsEarned} pts</span>
                            ) : (
                              <span className="text-slate-500">0 pts (clean)</span>
                            )
                          ) : (
                            <span
                              className={
                                c.pointsEarned === c.weight
                                  ? 'text-emerald-400'
                                  : c.pointsEarned > 0
                                  ? 'text-amber-400'
                                  : 'text-slate-500'
                              }
                            >
                              {c.pointsEarned} / {c.weight} pts
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-slate-300">
                        <p className="text-slate-400 text-[11px] leading-relaxed">
                          <span className="text-slate-500 font-medium">Evidence: </span>
                          <span className="text-slate-300 font-mono text-[11px]">{c.evidence}</span>
                        </p>
                        <p className="mt-1 text-slate-300 text-xs">
                          {c.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Summary Reasons */}
              {breakdown.summaryReasons && breakdown.summaryReasons.length > 0 && (
                <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                    Qualification Summary Signals
                  </span>
                  <ul className="space-y-1">
                    {breakdown.summaryReasons.map((reason, idx) => (
                      <li key={idx} className="text-xs text-slate-300 flex items-start gap-1.5">
                        <span className="text-purple-400 font-bold">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="rounded-xl border border-slate-800/80 bg-slate-900/30 p-2.5 flex items-start gap-2">
                <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-400 leading-relaxed italic">
                  {breakdown.disclaimers}
                </p>
              </div>
            </div>
          ) : (
            /* Prompt to Qualify */
            <div className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-purple-400" />
                  Deterministic ICP Qualification
                </h4>
                <p className="mt-1 text-xs text-slate-300">
                  This lead has not yet been qualified against the active ICP profile. Run the qualification engine to calculate explainable criteria alignment.
                </p>
              </div>
              {onQualifyLead && (
                <button
                  onClick={handleQualify}
                  disabled={isQualifying}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 px-4 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isQualifying ? 'animate-spin' : ''}`} />
                  {isQualifying ? 'Evaluating...' : 'Qualify Lead Now'}
                </button>
              )}
            </div>
          )}

          {/* Buying Triggers Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Detected Buying Triggers & Signals
            </h4>
            <div className="space-y-1.5">
              {lead.triggers && lead.triggers.length > 0 ? (
                lead.triggers.map((trigger, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs text-slate-200"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                    <span className="font-medium">{trigger}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-2.5 text-xs text-slate-500 italic">
                  No active buying triggers recorded
                </div>
              )}
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

          {/* Discovery & Provider Provenance (when imported via discovery) */}
          {lead.sourceProvider && (
            <div className="rounded-xl border border-indigo-500/30 bg-slate-950/60 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-400" />
                  Discovery & Provider Provenance
                </span>
                <span className="rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {lead.isMock ? 'Demo Mock Sandbox' : 'Live Provider'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-400 text-[11px] block">Provider</span>
                  <span className="font-semibold text-slate-200 capitalize">
                    {lead.sourceProvider === 'hunter' ? 'Hunter.io API v2' : 'LeadForge Mock Provider'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Email Verification</span>
                  <span className="font-semibold text-emerald-400 capitalize">
                    {lead.emailVerificationStatus || 'Unverified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 text-[11px] block">Source Evidence</span>
                  {lead.sourceUrl ? (
                    <a
                      href={lead.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline font-mono text-[11px]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Link
                    </a>
                  ) : (
                    <span className="text-slate-500 italic text-[11px]">None recorded</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SDR & Agent Notes with Editing */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-slate-400">Agent Intelligence Notes</span>
              {!editingNotes ? (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  Edit Note
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="text-[11px] text-slate-500 hover:text-slate-300"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {!editingNotes ? (
              <p className="mt-1 text-xs text-slate-300 italic">{lead.notes || 'No notes added.'}</p>
            ) : (
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                rows={3}
              />
            )}

            {savedNotesToast && (
              <p className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3" /> Note updated successfully
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer with Interactive Stage Selector */}
        <div className="border-t border-slate-800 bg-slate-950/80 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Pipeline Stage:</span>
            <select
              value={lead.status}
              onChange={(e) => onUpdateStatus?.(lead.id, e.target.value as LeadStatus)}
              className="rounded-lg border border-indigo-500/40 bg-slate-900 px-3 py-1.5 text-xs font-bold text-indigo-300 focus:border-indigo-400 focus:outline-none cursor-pointer"
            >
              {ALL_STAGES.map((st) => (
                <option key={st} value={st}>
                  {st}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onDeleteLead && (
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-1 rounded-xl border border-rose-500/30 bg-rose-950/20 px-3 py-2 text-xs font-semibold text-rose-400 hover:bg-rose-900/40 hover:text-rose-200 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
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
