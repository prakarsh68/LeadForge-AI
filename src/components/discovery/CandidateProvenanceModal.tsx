import React from 'react';
import type { DiscoveredCandidate } from '../../types';
import {
  X,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ExternalLink,
  Building,
  Mail,
  Info,
} from 'lucide-react';

interface CandidateProvenanceModalProps {
  candidate: DiscoveredCandidate | null;
  onClose: () => void;
  onIngestSingle?: (candidateId: string) => Promise<void>;
  isIngesting?: boolean;
}

export const CandidateProvenanceModal: React.FC<CandidateProvenanceModalProps> = ({
  candidate,
  onClose,
  onIngestSingle,
  isIngesting = false,
}) => {
  if (!candidate) return null;

  const renderVerificationBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
            <CheckCircle2 className="h-3 w-3" /> Verified Deliverable
          </span>
        );
      case 'risky':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
            <AlertTriangle className="h-3 w-3" /> Risky / Catch-All
          </span>
        );
      case 'undeliverable':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400">
            <XCircle className="h-3 w-3" /> Undeliverable
          </span>
        );
      case 'inferred':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-500/30 bg-sky-500/10 px-2 py-0.5 text-[11px] font-semibold text-sky-400">
            <HelpCircle className="h-3 w-3" /> Inferred Pattern
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
            Unverified
          </span>
        );
    }
  };

  const renderDedupBadge = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
            New Lead
          </span>
        );
      case 'same_company_existing':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-400">
            Account Expansion (New Contact)
          </span>
        );
      case 'existing_lead':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
            Existing Contact in CRM
          </span>
        );
      case 'duplicate_in_job':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-0.5 text-[11px] font-semibold text-slate-400">
            Duplicate in Current Job
          </span>
        );
      default:
        return null;
    }
  };

  const provenance = candidate.provenanceMetadata || {};
  const provenanceEntries = Object.entries(provenance);

  const isEligibleForIngest =
    candidate.status === 'staged' &&
    (candidate.dedupStatus === 'new' || candidate.dedupStatus === 'same_company_existing');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative border-b border-slate-800 bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 p-6">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-white">{candidate.contactName}</h3>
                {candidate.isMock ? (
                  <span className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-400 uppercase tracking-wide">
                    DEMO MOCK SANDBOX
                  </span>
                ) : (
                  <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-400 uppercase tracking-wide">
                    LIVE PROVIDER
                  </span>
                )}
                {renderDedupBadge(candidate.dedupStatus)}
              </div>
              <p className="text-sm font-medium text-slate-300 mt-1">{candidate.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Building className="h-3.5 w-3.5 text-indigo-400" />
                  {candidate.companyName} ({candidate.companyDomain})
                </span>
                {candidate.email && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-slate-300">
                      <Mail className="h-3.5 w-3.5 text-indigo-400" />
                      {candidate.email}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Ingest Action Button if staged */}
            {isEligibleForIngest && onIngestSingle && (
              <div className="self-start sm:self-center">
                <button
                  onClick={() => onIngestSingle(candidate.id)}
                  disabled={isIngesting}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-50"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isIngesting ? 'Ingesting...' : 'Ingest to CRM'}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Summary Badges Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block text-[11px]">Provider Source</span>
              <span className="font-semibold text-slate-200 mt-0.5 capitalize block">
                {candidate.provider === 'hunter' ? 'Hunter.io API v2' : 'LeadForge Mock Sandbox'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block text-[11px]">Email Verification</span>
              <div className="mt-1">{renderVerificationBadge(candidate.emailVerification)}</div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block text-[11px]">Provider Confidence</span>
              <span className="font-semibold text-slate-200 mt-0.5 block font-mono">
                {candidate.confidenceScore !== null && candidate.confidenceScore !== undefined
                  ? `${candidate.confidenceScore}%`
                  : 'N/A (Provider omitted)'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3">
              <span className="text-slate-400 block text-[11px]">ICP Score Preview</span>
              <span className="font-semibold text-purple-300 mt-0.5 block font-mono">
                {candidate.icpScorePreview !== null && candidate.icpScorePreview !== undefined
                  ? `${candidate.icpScorePreview} / 100 (${candidate.icpTierPreview?.toUpperCase()})`
                  : 'Pending ICP qualification'}
              </span>
            </div>
          </div>

          {/* Staging Warning or Ingested Notice */}
          {candidate.status === 'ingested' && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3.5 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>
                This candidate was successfully ingested into CRM. Linked Lead ID:{' '}
                <code className="font-mono font-bold text-white">{candidate.ingestedLeadId}</code>
              </span>
            </div>
          )}

          {candidate.dedupStatus === 'existing_lead' && candidate.status === 'staged' && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-950/30 p-3.5 text-xs text-amber-300">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
              <span>
                This email matches an existing lead in your CRM (<code className="font-mono font-bold">{candidate.existingLeadId}</code>). Ingestion will be skipped during bulk import to prevent duplication.
              </span>
            </div>
          )}

          {/* Field-by-Field Provenance Audit Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                Field-Level Provenance & Attribution Audit
              </h4>
              <span className="text-[11px] text-slate-400 font-mono">
                {provenanceEntries.length} verified fields
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/60 text-slate-400 font-medium">
                    <th className="py-2.5 px-3">Field Name</th>
                    <th className="py-2.5 px-3">Extracted Value</th>
                    <th className="py-2.5 px-3">Source Provider</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Verification</th>
                    <th className="py-2.5 px-3">Source Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {provenanceEntries.map(([fieldName, prov]) => (
                    <tr key={fieldName} className="hover:bg-slate-900/40 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-indigo-300 font-medium">
                        {fieldName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-200 font-medium max-w-[200px] truncate">
                        {prov.value !== null && prov.value !== undefined
                          ? String(prov.value)
                          : <span className="text-slate-500 italic">null</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400 capitalize">
                        {prov.sourceProvider}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">
                        {prov.confidence !== null && prov.confidence !== undefined
                          ? `${prov.confidence}%`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {renderVerificationBadge(prov.verificationStatus)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-400">
                        {prov.sourceUrl ? (
                          <a
                            href={prov.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 underline underline-offset-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Source
                          </a>
                        ) : (
                          <span className="text-slate-500 italic">None supplied</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Provider Evidence Sources */}
          {candidate.sourceUrls && candidate.sourceUrls.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5 text-indigo-400" />
                Raw Source Reference URLs ({candidate.sourceUrls.length})
              </h4>
              <div className="space-y-1.5">
                {candidate.sourceUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-2.5 text-xs text-slate-300"
                  >
                    <span className="truncate max-w-md font-mono text-[11px] text-slate-400">
                      {url}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 text-xs font-medium shrink-0 ml-2"
                    >
                      Open Link <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimers & Integrity Notice */}
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/40 p-3 text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Info className="h-3.5 w-3.5 text-indigo-400" />
              <span>Data Provenance Guarantee</span>
            </div>
            <p>
              LeadForge AI preserves authentic provider attribution and original verification statuses.
              No synthetic provenance is fabricated. Staged records remain unpersisted in the live sales CRM until explicit human or batch approval.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-800 bg-slate-950/80 p-4 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Discovered at:{' '}
            <span className="font-mono text-slate-300">{candidate.createdAt}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
