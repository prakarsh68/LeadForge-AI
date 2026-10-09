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
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            <CheckCircle2 className="h-3 w-3" /> Verified Deliverable
          </span>
        );
      case 'risky':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            <AlertTriangle className="h-3 w-3" /> Risky / Catch-All
          </span>
        );
      case 'undeliverable':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800">
            <XCircle className="h-3 w-3" /> Undeliverable
          </span>
        );
      case 'inferred':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800">
            <HelpCircle className="h-3 w-3" /> Inferred Pattern
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            Unverified
          </span>
        );
    }
  };

  const renderDedupBadge = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
            New Lead
          </span>
        );
      case 'same_company_existing':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-800">
            Account Expansion (New Contact)
          </span>
        );
      case 'existing_lead':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
            Existing Contact in CRM
          </span>
        );
      case 'duplicate_in_job':
        return (
          <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative border-b border-slate-200 bg-slate-50/80 p-6">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-xl font-bold text-slate-900">{candidate.contactName}</h3>
                {candidate.isMock ? (
                  <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 uppercase tracking-wide">
                    DEMO MOCK SANDBOX
                  </span>
                ) : (
                  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 uppercase tracking-wide">
                    LIVE PROVIDER
                  </span>
                )}
                {renderDedupBadge(candidate.dedupStatus)}
              </div>
              <p className="text-sm font-medium text-slate-600 mt-1">{candidate.title}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1 font-medium text-slate-700">
                  <Building className="h-3.5 w-3.5 text-indigo-600" />
                  {candidate.companyName} ({candidate.companyDomain})
                </span>
                {candidate.email && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-1 font-mono text-slate-700">
                      <Mail className="h-3.5 w-3.5 text-indigo-600" />
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50"
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
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Provider Source</span>
              <span className="font-semibold text-slate-900 mt-0.5 capitalize block">
                {candidate.provider === 'hunter' ? 'Hunter.io API v2' : 'LeadForge Mock Sandbox'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Email Verification</span>
              <div className="mt-1">{renderVerificationBadge(candidate.emailVerification)}</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">Provider Confidence</span>
              <span className="font-semibold text-slate-900 mt-0.5 block font-mono">
                {candidate.confidenceScore !== null && candidate.confidenceScore !== undefined
                  ? `${candidate.confidenceScore}%`
                  : 'N/A (Provider omitted)'}
              </span>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
              <span className="text-slate-500 block text-[11px] font-medium">ICP Score Preview</span>
              <span className="font-semibold text-indigo-700 mt-0.5 block font-mono">
                {candidate.icpScorePreview !== null && candidate.icpScorePreview !== undefined
                  ? `${candidate.icpScorePreview} / 100 (${candidate.icpTierPreview?.toUpperCase()})`
                  : 'Pending ICP qualification'}
              </span>
            </div>
          </div>

          {/* Staging Warning or Ingested Notice */}
          {candidate.status === 'ingested' && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                This candidate was successfully ingested into CRM. Linked Lead ID:{' '}
                <code className="font-mono font-bold text-slate-900">{candidate.ingestedLeadId}</code>
              </span>
            </div>
          )}

          {candidate.dedupStatus === 'existing_lead' && candidate.status === 'staged' && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>
                This email matches an existing lead in your CRM (<code className="font-mono font-bold">{candidate.existingLeadId}</code>). Ingestion will be skipped during bulk import to prevent duplication.
              </span>
            </div>
          )}

          {/* Field-by-Field Provenance Audit Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-indigo-600" />
                Field-Level Provenance &amp; Attribution Audit
              </h4>
              <span className="text-[11px] text-slate-500 font-mono">
                {provenanceEntries.length} verified fields
              </span>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Field Name</th>
                    <th className="py-2.5 px-3">Extracted Value</th>
                    <th className="py-2.5 px-3">Source Provider</th>
                    <th className="py-2.5 px-3">Confidence</th>
                    <th className="py-2.5 px-3">Verification</th>
                    <th className="py-2.5 px-3">Source Evidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {provenanceEntries.map(([fieldName, prov]) => (
                    <tr key={fieldName} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-3 font-mono text-indigo-700 font-medium">
                        {fieldName}
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium max-w-[200px] truncate">
                        {prov.value !== null && prov.value !== undefined
                          ? String(prov.value)
                          : <span className="text-slate-400 italic">null</span>}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 capitalize">
                        {prov.sourceProvider}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">
                        {prov.confidence !== null && prov.confidence !== undefined
                          ? `${prov.confidence}%`
                          : '—'}
                      </td>
                      <td className="py-2.5 px-3">
                        {renderVerificationBadge(prov.verificationStatus)}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {prov.sourceUrl ? (
                          <a
                            href={prov.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                            Source
                          </a>
                        ) : (
                          <span className="text-slate-400 italic">None supplied</span>
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
              <h4 className="text-xs font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <ExternalLink className="h-3.5 w-3.5 text-indigo-600" />
                Raw Source Reference URLs ({candidate.sourceUrls.length})
              </h4>
              <div className="space-y-1.5">
                {candidate.sourceUrls.map((url, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/60 p-2.5 text-xs text-slate-700"
                  >
                    <span className="truncate max-w-md font-mono text-[11px] text-slate-600">
                      {url}
                    </span>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 text-xs font-semibold shrink-0 ml-2"
                    >
                      Open Link <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Disclaimers & Integrity Notice */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <Info className="h-3.5 w-3.5 text-indigo-600" />
              <span>Data Provenance Guarantee</span>
            </div>
            <p>
              LeadForge AI preserves authentic provider attribution and original verification statuses.
              No synthetic provenance is fabricated. Staged records remain unpersisted in the live sales CRM until explicit human or batch approval.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-slate-200 bg-slate-50 p-4 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            Discovered at:{' '}
            <span className="font-mono text-slate-700">{candidate.createdAt}</span>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};
