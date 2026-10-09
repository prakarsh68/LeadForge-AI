import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type {
  DiscoveryProviderStatus,
  DiscoveryJob,
  DiscoveredCandidate,
  IngestBatchResult,
} from '../../types';
import { api, ApiError } from '../../services/api';
import { CandidateProvenanceModal } from './CandidateProvenanceModal';
import { BulkIngestModal } from './BulkIngestModal';
import {
  Compass,
  Search,
  Building,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  ExternalLink,
  Eye,
  UserPlus,
  Filter,
  RefreshCw,
  Lock,
  Globe,
  Sliders,
  CheckCheck,
} from 'lucide-react';

interface DiscoveryViewProps {
  onCandidatesIngested?: () => void;
  onNavigateToLeads?: () => void;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({
  onCandidatesIngested,
  onNavigateToLeads,
}) => {
  // Provider and Mode Configuration
  const [providers, setProviders] = useState<DiscoveryProviderStatus[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('mock');

  // Search Form State
  const [domainInput, setDomainInput] = useState<string>('ramp.com');
  const [limitCount, setLimitCount] = useState<number>(10);
  const [targetDepartment, setTargetDepartment] = useState<string>('all');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<DiscoveryJob | null>(null);

  // Candidate Data & Selection
  const [candidates, setCandidates] = useState<DiscoveredCandidate[]>([]);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter States
  const [tableSearch, setTableSearch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'staged' | 'ingested'>('all');
  const [dedupFilter, setDedupFilter] = useState<'all' | 'new' | 'same_company_existing' | 'existing_lead' | 'duplicate_in_job'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  // Modals & Single Action States
  const [inspectingCandidate, setInspectingCandidate] = useState<DiscoveredCandidate | null>(null);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState<boolean>(false);
  const [isIngestingBatch, setIsIngestingBatch] = useState<boolean>(false);
  const [batchResult, setBatchResult] = useState<IngestBatchResult | null>(null);
  const [isIngestingSingleId, setIsIngestingSingleId] = useState<string | null>(null);

  // Quick domain chips
  const quickDomains = ['ramp.com', 'stripe.com', 'figma.com', 'datadoghq.com', 'brex.com'];

  // Fetch staged candidates across jobs
  const loadCandidates = useCallback(async () => {
    setIsLoadingCandidates(true);
    try {
      const data = await api.getAllDiscoveredCandidates({ limit: 100 });
      setCandidates(data);
    } catch (err: any) {
      console.error('[Discovery] Failed to load candidates:', err);
    } finally {
      setIsLoadingCandidates(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    async function initialize() {
      setIsLoadingCandidates(true);
      try {
        const [provs, cands] = await Promise.all([
          api.getDiscoveryProviders().catch(() => []),
          api.getAllDiscoveredCandidates({ limit: 100 }).catch(() => []),
        ]);
        if (!isMounted) return;
        setProviders(provs);
        const hunter = provs.find((p) => p.id === 'hunter');
        if (hunter && hunter.isConfigured) {
          setSelectedProviderId('hunter');
        } else {
          setSelectedProviderId('mock');
        }
        setCandidates(cands);
      } catch (err) {
        console.error('[Discovery] Initialization error:', err);
      } finally {
        if (isMounted) {
          setIsLoadingCandidates(false);
        }
      }
    }

    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeProvider = useMemo(() => {
    return providers.find((p) => p.id === selectedProviderId) || null;
  }, [providers, selectedProviderId]);

  // Clean domain input
  const normalizeDomain = (raw: string): string => {
    return raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/\/.*$/, '');
  };

  // Run discovery job
  const handleRunDiscovery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError(null);

    const domain = normalizeDomain(domainInput);
    if (!domain || !domain.includes('.')) {
      setSearchError('Please provide a valid corporate domain (e.g., stripe.com or ramp.com).');
      return;
    }

    if (activeProvider && activeProvider.mode === 'real' && !activeProvider.isConfigured) {
      setSearchError(
        'Live discovery is unavailable because the HUNTER_API_KEY environment variable is not configured. Please switch to Demo Sandbox to proceed.'
      );
      return;
    }

    setIsSearching(true);
    try {
      const params: any = {
        provider: selectedProviderId,
        domain,
        limit: limitCount,
      };

      if (targetDepartment !== 'all') {
        params.targetRoles = [targetDepartment];
      }

      const res = await api.startDiscoveryJob(params);
      setActiveJob(res.job);

      // Prepend newly found candidates
      setCandidates((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const newOnes = res.candidates.filter((c) => !existingIds.has(c.id));
        return [...newOnes, ...prev];
      });

      // Automatically select eligible candidates from this new job
      const newlyEligibleIds = res.candidates
        .filter((c) => c.status === 'staged' && (c.dedupStatus === 'new' || c.dedupStatus === 'same_company_existing'))
        .map((c) => c.id);

      setSelectedIds((prev) => {
        const next = new Set(prev);
        newlyEligibleIds.forEach((id) => next.add(id));
        return next;
      });
    } catch (err: any) {
      console.error('[Discovery] Job failed:', err);
      setSearchError(err instanceof ApiError ? err.message : 'Discovery job execution failed.');
    } finally {
      setIsSearching(false);
    }
  };

  // Filter candidates for table
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Text search
      if (tableSearch.trim()) {
        const q = tableSearch.toLowerCase();
        const matchesName = c.contactName.toLowerCase().includes(q);
        const matchesTitle = c.title.toLowerCase().includes(q);
        const matchesCompany = c.companyName.toLowerCase().includes(q);
        const matchesDomain = c.companyDomain.toLowerCase().includes(q);
        const matchesEmail = (c.email || '').toLowerCase().includes(q);
        if (!matchesName && !matchesTitle && !matchesCompany && !matchesDomain && !matchesEmail) {
          return false;
        }
      }

      // Status
      if (statusFilter !== 'all' && c.status !== statusFilter) {
        return false;
      }

      // Dedup
      if (dedupFilter !== 'all' && c.dedupStatus !== dedupFilter) {
        return false;
      }

      // ICP Tier
      if (tierFilter !== 'all') {
        if (!c.icpTierPreview || c.icpTierPreview !== tierFilter) {
          return false;
        }
      }

      return true;
    });
  }, [candidates, tableSearch, statusFilter, dedupFilter, tierFilter]);

  // Selection helpers
  const eligibleSelectedCount = useMemo(() => {
    return candidates.filter(
      (c) =>
        selectedIds.has(c.id) &&
        c.status === 'staged' &&
        (c.dedupStatus === 'new' || c.dedupStatus === 'same_company_existing')
    ).length;
  }, [candidates, selectedIds]);

  const toggleSelectCandidate = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAllOnTable = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredCandidates.forEach((c) => next.add(c.id));
      return next;
    });
  };

  const handleSelectAllEligible = () => {
    const eligibleIds = candidates
      .filter((c) => c.status === 'staged' && (c.dedupStatus === 'new' || c.dedupStatus === 'same_company_existing'))
      .map((c) => c.id);
    setSelectedIds(new Set(eligibleIds));
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Ingest single candidate
  const handleIngestSingle = async (candidateId: string) => {
    setIsIngestingSingleId(candidateId);
    try {
      const res = await api.ingestDiscoveredCandidate(candidateId);
      // Update candidate locally
      setCandidates((prev) =>
        prev.map((c) =>
          c.id === candidateId
            ? { ...c, status: 'ingested', ingestedLeadId: res.lead.id }
            : c
        )
      );
      if (inspectingCandidate && inspectingCandidate.id === candidateId) {
        setInspectingCandidate((prev) =>
          prev ? { ...prev, status: 'ingested', ingestedLeadId: res.lead.id } : null
        );
      }
      onCandidatesIngested?.();
    } catch (err: any) {
      alert(`Ingestion failed: ${err.message}`);
    } finally {
      setIsIngestingSingleId(null);
    }
  };

  // Bulk Ingestion execution
  const handleConfirmBulkIngest = async (eligibleIds: string[]) => {
    setIsIngestingBatch(true);
    try {
      const result = await api.ingestCandidatesBatch(eligibleIds);
      setBatchResult(result);

      // Refresh candidate state from backend
      await loadCandidates();
      onCandidatesIngested?.();
    } catch (err: any) {
      alert(`Batch ingestion failed: ${err.message}`);
    } finally {
      setIsIngestingBatch(false);
    }
  };

  const selectedCandidatesList = useMemo(() => {
    return candidates.filter((c) => selectedIds.has(c.id));
  }, [candidates, selectedIds]);

  const renderVerificationPill = (status: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </span>
        );
      case 'risky':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-semibold">
            <AlertTriangle className="h-3 w-3" /> Risky
          </span>
        );
      case 'undeliverable':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-500/10 text-rose-400 border border-rose-500/30 px-1.5 py-0.5 text-[10px] font-semibold">
            <XCircle className="h-3 w-3" /> Undeliverable
          </span>
        );
      case 'inferred':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-sky-500/10 text-sky-400 border border-sky-500/30 px-1.5 py-0.5 text-[10px] font-semibold">
            <HelpCircle className="h-3 w-3" /> Inferred
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-800 text-slate-400 border border-slate-700 px-1.5 py-0.5 text-[10px]">
            Unverified
          </span>
        );
    }
  };

  const renderDedupPill = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold">
            New Lead
          </span>
        );
      case 'same_company_existing':
        return (
          <span className="inline-flex items-center rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 text-[10px] font-bold">
            Account Expansion
          </span>
        );
      case 'existing_lead':
        return (
          <span className="inline-flex items-center rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 text-[10px] font-bold">
            In CRM Already
          </span>
        );
      case 'duplicate_in_job':
        return (
          <span className="inline-flex items-center rounded bg-slate-800 text-slate-400 border border-slate-700 px-2 py-0.5 text-[10px] font-medium">
            Search Duplicate
          </span>
        );
      default:
        return null;
    }
  };

  const hunterConfigured = providers.find((p) => p.id === 'hunter')?.isConfigured ?? false;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-pink-500 shadow-lg shadow-purple-500/20">
              <Compass className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-white font-[Plus_Jakarta_Sans]">
                  Discovery Engine
                </h1>
                <span className="rounded-full bg-purple-500/20 px-2.5 py-0.5 text-[11px] font-bold text-purple-300 border border-purple-500/30">
                  Phase 3B
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Discover verified prospects, inspect field-level provenance, and safely bulk-ingest into your sales CRM.
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats Counter */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-right">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              Staged Candidates
            </span>
            <span className="text-lg font-bold font-mono text-indigo-400">
              {candidates.filter((c) => c.status === 'staged').length}
            </span>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-2 text-right">
            <span className="text-[11px] font-semibold text-slate-400 block uppercase">
              Ingested to CRM
            </span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {candidates.filter((c) => c.status === 'ingested').length}
            </span>
          </div>
        </div>
      </div>

      {/* Provider Selector Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hunter.io Live Card */}
        <div
          onClick={() => setSelectedProviderId('hunter')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all relative overflow-hidden ${
            selectedProviderId === 'hunter'
              ? 'border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500 shadow-lg shadow-indigo-950/50'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-orange-400 font-black text-sm">
                H
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">Hunter.io Domain Search</h3>
                  <span className="rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                    LIVE MODE
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Real external API integration for real corporate domain enrichment.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {hunterConfigured ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                  Configured
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                  <Lock className="h-3 w-3" />
                  Key Required
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <span className="font-medium text-slate-300">Capabilities:</span>
            {['domain-search', 'email-verification', 'confidence-scoring', 'sources-attribution'].map(
              (cap) => (
                <span
                  key={cap}
                  className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[10px] font-mono text-slate-300"
                >
                  {cap}
                </span>
              )
            )}
          </div>
        </div>

        {/* Demo Mock Provider Card */}
        <div
          onClick={() => setSelectedProviderId('mock')}
          className={`cursor-pointer rounded-2xl border p-4 transition-all relative overflow-hidden ${
            selectedProviderId === 'mock'
              ? 'border-indigo-500 bg-indigo-950/20 ring-1 ring-indigo-500 shadow-lg shadow-indigo-950/50'
              : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-black text-sm">
                LF
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">LeadForge Demo Sandbox</h3>
                  <span className="rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 text-[10px] font-bold">
                    DEMO / MOCK
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Pre-configured realistic corporate dataset for zero-configuration testing.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
                Always Ready
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400">
            <span className="font-medium text-slate-300">Capabilities:</span>
            {['synthetic-profiles', 'domain-catalog', 'air-gapped-testing', 'deterministic-icp'].map(
              (cap) => (
                <span
                  key={cap}
                  className="rounded-md border border-slate-800 bg-slate-950/60 px-2 py-0.5 text-[10px] font-mono text-slate-300"
                >
                  {cap}
                </span>
              )
            )}
          </div>
        </div>
      </div>

      {/* Warning if Live mode selected but Hunter key missing */}
      {selectedProviderId === 'hunter' && !hunterConfigured && (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/40 bg-amber-950/30 p-4 text-xs text-amber-200 animate-in fade-in">
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <strong className="font-semibold block text-amber-300">
              HUNTER_API_KEY is not configured on the backend
            </strong>
            <p className="leading-relaxed">
              Live discovery cannot be executed without a valid API key. Per project integrity constraints,
              LeadForge AI never silently fakes live provider results. You can switch to the{' '}
              <button
                onClick={() => setSelectedProviderId('mock')}
                className="underline font-bold text-amber-400 hover:text-white"
              >
                LeadForge Demo Sandbox
              </button>{' '}
              to test discovery workflows with realistic candidates.
            </p>
          </div>
        </div>
      )}

      {/* Search Configuration & Run Card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 p-5 shadow-xl space-y-4">
        <form onSubmit={handleRunDiscovery} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
            {/* Domain input */}
            <div className="lg:col-span-5 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-indigo-400" />
                Company Target Domain
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={domainInput}
                  onChange={(e) => setDomainInput(e.target.value)}
                  placeholder="e.g. stripe.com or ramp.com"
                  className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3.5 py-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Department Filter */}
            <div className="lg:col-span-3 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-indigo-400" />
                Department Filter
              </label>
              <select
                value={targetDepartment}
                onChange={(e) => setTargetDepartment(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value="all">All Departments</option>
                <option value="executive">Executive & Leadership</option>
                <option value="engineering">Engineering & Product</option>
                <option value="sales">Sales & Business Development</option>
                <option value="it">Information Technology</option>
                <option value="finance">Finance & Operations</option>
              </select>
            </div>

            {/* Limit selector */}
            <div className="lg:col-span-2 space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                Max Candidates
              </label>
              <select
                value={limitCount}
                onChange={(e) => setLimitCount(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 px-3 py-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none cursor-pointer"
              >
                <option value={5}>5 candidates</option>
                <option value={10}>10 candidates</option>
                <option value={20}>20 candidates</option>
              </select>
            </div>

            {/* Submit Button */}
            <div className="lg:col-span-2">
              <button
                type="submit"
                disabled={
                  isSearching || (selectedProviderId === 'hunter' && !hunterConfigured)
                }
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-purple-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSearching ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Searching...</span>
                  </>
                ) : (
                  <>
                    <Compass className="h-4 w-4" />
                    <span>Run Discovery</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick domain buttons */}
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span className="text-slate-400 text-[11px] font-medium">Quick Examples:</span>
            {quickDomains.map((dom) => (
              <button
                key={dom}
                type="button"
                onClick={() => setDomainInput(dom)}
                className={`rounded-lg border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                  domainInput === dom
                    ? 'border-indigo-500/60 bg-indigo-500/20 text-indigo-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                }`}
              >
                {dom}
              </button>
            ))}
          </div>
        </form>

        {/* Search Error Notice */}
        {searchError && (
          <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-950/40 p-3 text-xs text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{searchError}</span>
          </div>
        )}

        {/* Active Job Information Banner */}
        {activeJob && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-xl border border-indigo-500/30 bg-indigo-950/20 p-3 text-xs text-indigo-200">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>
                Job <strong>{activeJob.id}</strong> completed: Found{' '}
                <strong className="text-white">{activeJob.totalFound}</strong> candidate(s) for{' '}
                <strong className="text-white">{activeJob.queryParams.domain}</strong> via{' '}
                <strong className="capitalize">{activeJob.provider}</strong> provider.
              </span>
            </div>
            <span className="font-mono text-[11px] text-slate-400">
              {new Date(activeJob.createdAt).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      {/* Candidate Review Table Section */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden space-y-4 p-5">
        {/* Table Top Controls & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search candidates, title, email..."
                className="w-full rounded-xl border border-slate-700 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="staged">Staged Only</option>
              <option value="ingested">Ingested Only</option>
            </select>

            {/* Dedup Filter */}
            <select
              value={dedupFilter}
              onChange={(e) => setDedupFilter(e.target.value as any)}
              className="rounded-xl border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Identity Types</option>
              <option value="new">New Leads</option>
              <option value="same_company_existing">Account Expansions</option>
              <option value="existing_lead">In CRM Already</option>
              <option value="duplicate_in_job">Search Duplicates</option>
            </select>

            {/* ICP Tier Filter */}
            <select
              value={tierFilter}
              onChange={(e) => setTierFilter(e.target.value as any)}
              className="rounded-xl border border-slate-700 bg-slate-950/80 px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All ICP Tiers</option>
              <option value="high">High Tier (80+)</option>
              <option value="medium">Medium Tier (60-79)</option>
              <option value="low">Low Tier (&lt;60)</option>
            </select>
          </div>

          {/* Selection & Bulk Actions */}
          <div className="flex items-center gap-2">
            {selectedIds.size > 0 && (
              <button
                onClick={handleClearSelection}
                className="rounded-lg border border-slate-800 bg-slate-950/60 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 hover:text-white"
              >
                Clear Selection ({selectedIds.size})
              </button>
            )}

            <button
              onClick={handleSelectAllEligible}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5 text-emerald-400" />
              <span>Select Eligible</span>
            </button>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-emerald-900/30 hover:from-emerald-500 hover:to-teal-500 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>
                Bulk Ingest ({selectedIds.size}
                {eligibleSelectedCount < selectedIds.size ? ` · ${eligibleSelectedCount} eligible` : ''})
              </span>
            </button>
          </div>
        </div>

        {/* Candidates Table */}
        <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/80 text-slate-400 font-semibold">
                <th className="py-3 px-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredCandidates.length > 0 &&
                      filteredCandidates.every((c) => selectedIds.has(c.id))
                    }
                    onChange={(e) => {
                      if (e.target.checked) {
                        handleSelectAllOnTable();
                      } else {
                        handleClearSelection();
                      }
                    }}
                    className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">Contact & Title</th>
                <th className="py-3 px-3">Company & Domain</th>
                <th className="py-3 px-3">Direct Email & Status</th>
                <th className="py-3 px-3">ICP Fit Preview</th>
                <th className="py-3 px-3">Identity Deduplication</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoadingCandidates ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-400" />
                    <span>Loading candidates...</span>
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 space-y-2">
                    <Compass className="h-8 w-8 mx-auto text-slate-600 mb-1" />
                    <p className="font-semibold text-slate-300">No candidate records match your filters.</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Run domain discovery above using the Demo Sandbox or Hunter.io provider to stage contacts.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((cand) => {
                  const isSelected = selectedIds.has(cand.id);
                  const isEligible =
                    cand.status === 'staged' &&
                    (cand.dedupStatus === 'new' || cand.dedupStatus === 'same_company_existing');

                  return (
                    <tr
                      key={cand.id}
                      className={`hover:bg-slate-900/50 transition-colors ${
                        isSelected ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectCandidate(cand.id)}
                          className="rounded border-slate-700 bg-slate-900 text-indigo-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Contact & Title */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          <span>{cand.contactName}</span>
                          {cand.linkedin && (
                            <a
                              href={cand.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-400 hover:text-indigo-300"
                              title="LinkedIn Profile"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          {cand.title}
                        </div>
                      </td>

                      {/* Company & Domain */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-200">{cand.companyName}</div>
                        <div className="text-[11px] font-mono text-indigo-400 flex items-center gap-1">
                          <Building className="h-3 w-3 text-slate-500" />
                          {cand.companyDomain}
                        </div>
                      </td>

                      {/* Email & Verification */}
                      <td className="py-3 px-3">
                        <div className="font-mono text-slate-200 select-all truncate max-w-[190px]">
                          {cand.email || <span className="text-slate-500 italic">No email</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {renderVerificationPill(cand.emailVerification)}
                          {cand.confidenceScore !== null && cand.confidenceScore !== undefined && (
                            <span className="font-mono text-[10px] text-slate-400">
                              {cand.confidenceScore}% conf
                            </span>
                          )}
                        </div>
                      </td>

                      {/* ICP Fit Preview */}
                      <td className="py-3 px-3">
                        {cand.icpScorePreview !== null && cand.icpScorePreview !== undefined ? (
                          <div className="flex items-center gap-1.5">
                            <span
                              className={`rounded font-mono px-2 py-0.5 text-xs font-bold ${
                                cand.icpScorePreview >= 80
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                  : cand.icpScorePreview >= 60
                                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                  : 'bg-slate-800 text-slate-400 border border-slate-700'
                              }`}
                            >
                              {cand.icpScorePreview}%
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">
                              {cand.icpTierPreview}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Unscored</span>
                        )}
                      </td>

                      {/* Identity Deduplication */}
                      <td className="py-3 px-3">
                        {renderDedupPill(cand.dedupStatus)}
                        {cand.existingLeadId && (
                          <span className="block text-[10px] font-mono text-slate-500 mt-0.5">
                            Linked: {cand.existingLeadId}
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        {cand.status === 'ingested' ? (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 text-[11px] font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Ingested
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-800 text-slate-300 border border-slate-700 px-2 py-0.5 text-[11px] font-medium">
                            Staged
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Provenance Inspector Button */}
                          <button
                            onClick={() => setInspectingCandidate(cand)}
                            className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 text-slate-400 hover:border-slate-700 hover:text-white transition-colors"
                            title="Inspect field-level provenance and source evidence"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Single Ingest Action */}
                          {isEligible && (
                            <button
                              onClick={() => handleIngestSingle(cand.id)}
                              disabled={isIngestingSingleId === cand.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-600/20 border border-emerald-500/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-600/40 transition-colors disabled:opacity-50"
                              title="Promote candidate into CRM"
                            >
                              <UserPlus className="h-3 w-3" />
                              {isIngestingSingleId === cand.id ? 'Ingesting...' : 'Ingest'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Field-Level Provenance Inspector Modal */}
      {inspectingCandidate && (
        <CandidateProvenanceModal
          candidate={inspectingCandidate}
          onClose={() => setInspectingCandidate(null)}
          onIngestSingle={async (id) => {
            await handleIngestSingle(id);
          }}
          isIngesting={isIngestingSingleId === inspectingCandidate.id}
        />
      )}

      {/* Bulk Ingestion Confirmation Modal */}
      <BulkIngestModal
        isOpen={isBulkModalOpen}
        onClose={() => {
          setIsBulkModalOpen(false);
          setBatchResult(null);
        }}
        selectedCandidates={selectedCandidatesList}
        onConfirmIngest={handleConfirmBulkIngest}
        isIngesting={isIngestingBatch}
        ingestResult={batchResult}
        onResetResult={() => setBatchResult(null)}
        onViewLeads={onNavigateToLeads}
      />
    </div>
  );
};
