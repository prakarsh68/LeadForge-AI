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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Banner */}
        <div className="relative border-b border-slate-200 bg-slate-50 p-6">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <img
                src={lead.avatar}
                alt={lead.name}
                className="h-16 w-16 rounded-xl object-cover border-2 border-indigo-200 shadow-sm flex-shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-bold text-slate-900">{lead.name}</h3>
                  <span
                    className={`rounded-md border px-2 py-0.5 text-xs font-bold font-mono ${
                      lead.score >= 80
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : lead.score >= 60
                        ? 'border-amber-300 bg-amber-50 text-amber-800'
                        : 'border-rose-300 bg-rose-50 text-rose-800'
                    }`}
                  >
                    {lead.score} / 100 ICP Match
                  </span>
                  <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase tracking-wide">
                    {lead.tier} tier
                  </span>
                  {lead.isQualificationStale && (
                    <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> Stale (Criteria Changed)
                    </span>
                  )}
                  {lead.lastQualificationError && (
                    <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-rose-800 flex items-center gap-1">
                      <XCircle className="h-3 w-3" /> Qualify Error
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-slate-600 mt-0.5">{lead.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Building className="h-3.5 w-3.5 text-indigo-600" />
                    <span className="font-medium text-slate-700">{lead.company}</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{lead.location}</span>
                  </span>
                  <span>•</span>
                  <span className="text-emerald-700 font-bold font-mono">
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
                  className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 hover:text-indigo-900 transition-all shadow-xs disabled:opacity-50"
                  title="Run deterministic ICP scoring engine"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isQualifying ? 'animate-spin text-indigo-600' : ''}`} />
                  {isQualifying ? 'Scoring Lead...' : 'Qualify Lead'}
                </button>
              </div>
            )}
          </div>

          {qualifyError && (
            <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 font-medium">
              {qualifyError}
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Explainable ICP Qualification Engine Results */}
          {breakdown ? (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-indigo-100 gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-bold text-indigo-900 uppercase tracking-wider">
                    Explainable ICP Score Breakdown
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-500 font-medium">Profile:</span>
                  <span className="text-slate-800 font-semibold">{breakdown.icpProfileName}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                      breakdown.isQualified
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {breakdown.isQualified ? '✓ Qualified' : 'Below Threshold'}
                  </span>
                </div>
              </div>

              {/* Staleness Notice Banner */}
              {lead.isQualificationStale && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>Qualification Stale:</strong> Lead criteria (industry, title, company size, or triggers) were modified after this evaluation. Re-qualify to recalculate score.
                    </span>
                  </div>
                  {onQualifyLead && (
                    <button
                      onClick={handleQualify}
                      disabled={isQualifying}
                      className="shrink-0 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] px-3 py-1.5 transition-colors disabled:opacity-50"
                    >
                      {isQualifying ? 'Re-scoring...' : 'Re-qualify Now'}
                    </button>
                  )}
                </div>
              )}

              {/* Criterion-Level Scoring Cards */}
              <div className="space-y-2">
                <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Evaluated Criteria Breakdown
                </div>
                <div className="space-y-2">
                  {breakdown.criteria.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-xl border border-slate-200 bg-white p-3 hover:border-slate-300 transition-colors shadow-xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-800">{c.name}</span>
                          {renderStatusBadge(c.status)}
                        </div>
                        <div className="text-xs font-mono font-bold">
                          {c.id === 'negative_keywords' ? (
                            c.pointsEarned < 0 ? (
                              <span className="text-rose-600">{c.pointsEarned} pts</span>
                            ) : (
                              <span className="text-slate-400">0 pts (clean)</span>
                            )
                          ) : (
                            <span
                              className={
                                c.pointsEarned === c.weight
                                  ? 'text-emerald-700'
                                  : c.pointsEarned > 0
                                  ? 'text-amber-700'
                                  : 'text-slate-400'
                              }
                            >
                              {c.pointsEarned} / {c.weight} pts
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="mt-2 text-xs text-slate-600">
                        <p className="text-slate-500 text-[11px] leading-relaxed">
                          <span className="text-slate-400 font-medium">Evidence: </span>
                          <span className="text-slate-700 font-mono text-[11px]">{c.evidence}</span>
                        </p>
                        <p className="mt-1 text-slate-600 text-xs">
                          {c.reason}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Key Summary Reasons */}
              {breakdown.summaryReasons && breakdown.summaryReasons.length > 0 && (
                <div className="rounded-xl border border-indigo-100 bg-white p-3 space-y-1.5 shadow-xs">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">
                    Qualification Summary Signals
                  </span>
                  <ul className="space-y-1">
                    {breakdown.summaryReasons.map((reason, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex items-start gap-1.5">
                        <span className="text-indigo-600 font-bold">•</span>
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="rounded-xl border border-slate-200 bg-white p-2.5 flex items-start gap-2 shadow-xs">
                <Info className="h-4 w-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-slate-500 leading-relaxed italic">
                  {breakdown.disclaimers}
                </p>
              </div>
            </div>
          ) : (
            /* Prompt to Qualify */
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  Deterministic ICP Qualification
                </h4>
                <p className="mt-1 text-xs text-slate-600">
                  This lead has not yet been qualified against the active ICP profile. Run the qualification engine to calculate explainable criteria alignment.
                </p>
              </div>
              {onQualifyLead && (
                <button
                  onClick={handleQualify}
                  disabled={isQualifying}
                  className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${isQualifying ? 'animate-spin' : ''}`} />
                  {isQualifying ? 'Evaluating...' : 'Qualify Lead Now'}
                </button>
              )}
            </div>
          )}

          {/* Buying Triggers Breakdown */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Detected Buying Triggers & Signals
            </h4>
            <div className="space-y-1.5">
              {lead.triggers && lead.triggers.length > 0 ? (
                lead.triggers.map((trigger, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    <span className="font-medium">{trigger}</span>
                  </div>
                ))
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs text-slate-400 italic">
                  No active buying triggers recorded
                </div>
              )}
            </div>
          </div>

          {/* Firmographics & Contact Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Direct Work Email</span>
              <span className="font-semibold text-slate-800 font-mono select-all flex items-center gap-1.5 mt-0.5">
                <Mail className="h-3.5 w-3.5 text-indigo-600" />
                {lead.email}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Company Domain</span>
              <span className="font-semibold text-slate-800 font-mono flex items-center gap-1.5 mt-0.5">
                <Building className="h-3.5 w-3.5 text-indigo-600" />
                {lead.companyDomain}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Industry</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">{lead.industry}</span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Company Headcount</span>
              <span className="font-semibold text-slate-800 mt-0.5 block">
                {lead.companySize} employees
              </span>
            </div>
          </div>

          {/* Discovery & Provider Provenance (when imported via discovery) */}
          {lead.sourceProvider && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/20 p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  Discovery & Provider Provenance
                </span>
                <span className="rounded bg-indigo-100 text-indigo-800 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold uppercase">
                  {lead.isMock ? 'Demo Mock Sandbox' : 'Live Provider'}
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px] block">Provider</span>
                  <span className="font-semibold text-slate-800 capitalize">
                    {lead.sourceProvider === 'hunter' ? 'Hunter.io API v2' : 'LeadForge Mock Provider'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Email Verification</span>
                  <span className="font-semibold text-emerald-700 capitalize">
                    {lead.emailVerificationStatus || 'Unverified'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[11px] block">Source Evidence</span>
                  {lead.sourceUrl ? (
                    <a
                      href={lead.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline font-mono text-[11px]"
                    >
                      <ExternalLink className="h-3 w-3" />
                      View Link
                    </a>
                  ) : (
                    <span className="text-slate-400 italic text-[11px]">None recorded</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Enrichment Conflict History (when conflicting data was recorded) */}
          {lead.conflictHistory && lead.conflictHistory.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-900 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Recorded Enrichment Conflicts ({lead.conflictHistory.length})
                </span>
                <span className="text-[10px] text-slate-500 font-mono">
                  Field-Level Precedence Applied
                </span>
              </div>
              <div className="space-y-1.5">
                {lead.conflictHistory.map((c, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-700 shadow-xs"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-indigo-700 font-semibold uppercase">{c.fieldName}</span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          c.resolution === 'preserved_existing'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {c.resolution === 'preserved_existing' ? 'Preserved Existing Data' : 'Overwritten by Higher Precedence'}
                      </span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block">Existing Value ({c.existingSource}):</span>
                        <span className="font-semibold text-slate-800">{String(c.existingValue)}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 block">Conflicting Value ({c.conflictingSource}):</span>
                        <span className="text-slate-400 line-through">{String(c.conflictingValue)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SDR & Agent Notes with Editing */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
            <div className="flex items-center justify-between pb-1">
              <span className="text-xs font-semibold text-slate-600">Agent Intelligence Notes</span>
              {!editingNotes ? (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold"
                >
                  Edit Note
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="text-[11px] text-slate-500 hover:text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveNotes}
                    className="text-[11px] text-emerald-700 hover:text-emerald-800 font-bold"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>

            {!editingNotes ? (
              <p className="mt-1 text-xs text-slate-700 italic">{lead.notes || 'No notes added.'}</p>
            ) : (
              <textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white p-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
                rows={3}
              />
            )}

            {savedNotesToast && (
              <p className="mt-1 text-[11px] text-emerald-700 flex items-center gap-1 font-medium">
                <CheckCircle2 className="h-3 w-3" /> Note updated successfully
              </p>
            )}
          </div>
        </div>

        {/* Modal Footer with Interactive Stage Selector */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-slate-600">Pipeline Stage:</span>
            <select
              value={lead.status}
              onChange={(e) => onUpdateStatus?.(lead.id, e.target.value as LeadStatus)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:border-indigo-500 focus:outline-none cursor-pointer shadow-2xs"
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
                className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 hover:text-rose-800 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              Close
            </button>
            <button
              onClick={() => {
                if (onMoveToPipeline) onMoveToPipeline(lead.id);
                onClose();
              }}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all"
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
