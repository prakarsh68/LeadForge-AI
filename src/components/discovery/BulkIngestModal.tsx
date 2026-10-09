import React from 'react';
import type { DiscoveredCandidate, IngestBatchResult } from '../../types';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Building,
  ArrowRight,
  Info,
  RefreshCw,
} from 'lucide-react';

interface BulkIngestModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCandidates: DiscoveredCandidate[];
  onConfirmIngest: (eligibleIds: string[]) => Promise<void>;
  isIngesting: boolean;
  ingestResult: IngestBatchResult | null;
  onResetResult: () => void;
  onViewLeads?: () => void;
}

export const BulkIngestModal: React.FC<BulkIngestModalProps> = ({
  isOpen,
  onClose,
  selectedCandidates,
  onConfirmIngest,
  isIngesting,
  ingestResult,
  onResetResult,
  onViewLeads,
}) => {
  if (!isOpen) return null;

  // Compute breakdown before import
  const stagedCandidates = selectedCandidates.filter((c) => c.status === 'staged');
  const eligibleCandidates = stagedCandidates.filter(
    (c) => c.dedupStatus === 'new' || c.dedupStatus === 'same_company_existing'
  );
  const existingContacts = stagedCandidates.filter((c) => c.dedupStatus === 'existing_lead');
  const jobDuplicates = stagedCandidates.filter((c) => c.dedupStatus === 'duplicate_in_job');
  const alreadyIngested = selectedCandidates.filter((c) => c.status === 'ingested');

  const eligibleIds = eligibleCandidates.map((c) => c.id);

  const handleClose = () => {
    if (ingestResult) {
      onResetResult();
    }
    onClose();
  };

  const handleConfirm = async () => {
    if (eligibleIds.length === 0 || isIngesting) return;
    await onConfirmIngest(eligibleIds);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative border-b border-slate-200 bg-slate-50/80 p-6">
          <button
            onClick={handleClose}
            className="absolute top-5 right-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">
                {ingestResult ? 'Bulk Ingestion Report' : 'Confirm Bulk Candidate Ingestion'}
              </h3>
              <p className="text-xs text-slate-500">
                {ingestResult
                  ? 'Candidate promotion complete. Summary audit below.'
                  : 'Review identity deduplication and verify candidates before promoting to CRM.'}
              </p>
            </div>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {!ingestResult ? (
            <>
              {/* Pre-Import Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-slate-500 block text-[11px] font-medium">Selected Total</span>
                  <span className="text-xl font-bold font-mono text-slate-900 mt-0.5 block">
                    {selectedCandidates.length}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <span className="text-emerald-800 font-semibold block text-[11px]">
                    Eligible to Ingest
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-800 mt-0.5 block">
                    {eligibleCandidates.length}
                  </span>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <span className="text-amber-800 font-semibold block text-[11px]">
                    Existing in CRM
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-800 mt-0.5 block">
                    {existingContacts.length}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <span className="text-slate-500 block text-[11px] font-medium">Duplicates / Done</span>
                  <span className="text-xl font-bold font-mono text-slate-700 mt-0.5 block">
                    {jobDuplicates.length + alreadyIngested.length}
                  </span>
                </div>
              </div>

              {/* Informative Guidance */}
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 text-xs text-indigo-900 space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-indigo-800">
                  <Info className="h-4 w-4 shrink-0 text-indigo-600" />
                  <span>Safe Ingestion Safeguards</span>
                </div>
                <p className="text-[11px] leading-relaxed text-indigo-800">
                  Only eligible candidates (new contacts and account expansions) will be promoted into
                  live CRM Leads. Deterministic Phase 3A qualification will run automatically,
                  generating synced sales opportunities and permanent field-level provenance records.
                </p>
              </div>

              {/* Duplicate & Ineligible Warning */}
              {(existingContacts.length > 0 || jobDuplicates.length > 0 || alreadyIngested.length > 0) && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-800">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                    <span>Ineligible Items Will Be Automatically Skipped</span>
                  </div>
                  <ul className="list-disc pl-5 text-[11px] space-y-1 text-amber-800">
                    {existingContacts.length > 0 && (
                      <li>
                        <strong>{existingContacts.length} existing contact(s)</strong> already have an active profile in your CRM.
                      </li>
                    )}
                    {jobDuplicates.length > 0 && (
                      <li>
                        <strong>{jobDuplicates.length} candidate(s)</strong> were identified as duplicates within this search run.
                      </li>
                    )}
                    {alreadyIngested.length > 0 && (
                      <li>
                        <strong>{alreadyIngested.length} candidate(s)</strong> were already ingested previously.
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Eligible Candidates Preview */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Eligible Candidates Ready for Promotion ({eligibleCandidates.length})</span>
                  <span className="text-[11px] text-emerald-700 font-semibold font-mono">
                    ✓ Validated
                  </span>
                </h4>

                {eligibleCandidates.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                    No selected candidates are currently eligible for ingestion. (All selected are either already ingested or duplicate contacts).
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 bg-white divide-y divide-slate-100">
                    {eligibleCandidates.map((c) => (
                      <div key={c.id} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50/80">
                        <div>
                          <div className="font-semibold text-slate-900 flex items-center gap-2">
                            <span>{c.contactName}</span>
                            <span className="text-slate-500 text-[11px]">({c.title})</span>
                          </div>
                          <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                            <span className="flex items-center gap-1">
                              <Building className="h-3 w-3 text-indigo-600" />
                              {c.companyName}
                            </span>
                            <span>•</span>
                            <span className="font-mono text-slate-600">{c.email}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {c.dedupStatus === 'same_company_existing' && (
                            <span className="rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 text-[10px] font-semibold">
                              New Contact
                            </span>
                          )}
                          <span className="rounded bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 text-[11px] font-bold font-mono">
                            {c.icpScorePreview ?? 0}% Fit
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Post-Import Execution Results View */
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                  <span className="text-emerald-800 font-semibold block text-[11px]">
                    Successfully Ingested
                  </span>
                  <span className="text-2xl font-bold font-mono text-emerald-800 mt-1 block">
                    {ingestResult.counts.ingested}
                  </span>
                </div>

                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-center">
                  <span className="text-amber-800 font-semibold block text-[11px]">
                    Skipped (Duplicates)
                  </span>
                  <span className="text-2xl font-bold font-mono text-amber-800 mt-1 block">
                    {ingestResult.counts.skipped}
                  </span>
                </div>

                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-center">
                  <span className="text-rose-800 font-semibold block text-[11px]">
                    Errors / Failed
                  </span>
                  <span className="text-2xl font-bold font-mono text-rose-800 mt-1 block">
                    {ingestResult.counts.failed}
                  </span>
                </div>
              </div>

              {/* Ingested Leads List */}
              {ingestResult.ingested.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    Created Leads in CRM ({ingestResult.ingested.length})
                  </h4>
                  <div className="max-h-36 overflow-y-auto rounded-xl border border-emerald-200 bg-emerald-50/50 divide-y divide-emerald-100 text-xs">
                    {ingestResult.ingested.map((item, idx) => (
                      <div key={idx} className="p-2.5 flex items-center justify-between">
                        <div>
                          <span className="font-semibold text-slate-900">{item.lead.name}</span>
                          <span className="text-slate-500 text-[11px] ml-2">
                            at {item.lead.company}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] text-emerald-800 font-semibold">
                          Lead ID: {item.lead.id}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped Details */}
              {ingestResult.skipped.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    Skipped Candidates ({ingestResult.skipped.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-amber-200 bg-amber-50/50 divide-y divide-amber-100 text-xs">
                    {ingestResult.skipped.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-800">{item.candidateId}</span>
                        <span className="text-amber-800 italic">{item.reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Failed Details */}
              {ingestResult.failed.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-rose-800 uppercase tracking-wider flex items-center gap-1.5">
                    <XCircle className="h-4 w-4" />
                    Failed Items ({ingestResult.failed.length})
                  </h4>
                  <div className="max-h-32 overflow-y-auto rounded-xl border border-rose-200 bg-rose-50/50 divide-y divide-rose-100 text-xs">
                    {ingestResult.failed.map((item, idx) => (
                      <div key={idx} className="p-2 flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-800">{item.candidateId}</span>
                        <span className="text-rose-800">{item.error}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 flex items-center justify-between gap-3">
          <button
            onClick={handleClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            {ingestResult ? 'Dismiss' : 'Cancel'}
          </button>

          {!ingestResult ? (
            <button
              onClick={handleConfirm}
              disabled={eligibleCandidates.length === 0 || isIngesting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5 py-2 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50"
            >
              {isIngesting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Ingesting Candidates...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Confirm &amp; Ingest ({eligibleCandidates.length} Eligible)</span>
                </>
              )}
            </button>
          ) : (
            onViewLeads && (
              <button
                onClick={() => {
                  handleClose();
                  onViewLeads();
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all"
              >
                <span>View Leads in CRM</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  );
};
