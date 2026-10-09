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
import { SourceIntelligenceWorkspace } from './SourceIntelligenceWorkspace';
import {
  Compass,
  Cpu,
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
  RotateCcw,
  Ban,
  Clock,
  AlertCircle,
  X,
  Play,
  Trash2,
  BarChart3,
  Check,
} from 'lucide-react';

interface DiscoveryViewProps {
  onCandidatesIngested?: () => void;
  onNavigateToLeads?: () => void;
}

export const DiscoveryView: React.FC<DiscoveryViewProps> = ({
  onCandidatesIngested,
  onNavigateToLeads,
}) => {
  // Subsystem View Mode: Domain Search vs Adaptive Source Intelligence
  const [discoveryModeTab, setDiscoveryModeTab] = useState<'domain_search' | 'source_intelligence'>('domain_search');

  // Operating Mode: 'live' (Mode A) | 'dry_run' (Mode B) | 'demo' (Mode C)
  const [operatingMode, setOperatingMode] = useState<'live' | 'dry_run' | 'demo'>('live');

  // Connector Capabilities & Status
  const [providers, setProviders] = useState<DiscoveryProviderStatus[]>([]);
  const [_connectorCapabilities, setConnectorCapabilities] = useState<any[]>([]);
  const [selectedProviderId, setSelectedProviderId] = useState<string>('hunter');

  // Dry-Run Simulation State
  const [dryRunResult, setDryRunResult] = useState<any | null>(null);
  const [isDryRunning, setIsDryRunning] = useState<boolean>(false);

  // Demo Sandbox Cleanup State
  const [isCleaningDemo, setIsCleaningDemo] = useState<boolean>(false);
  const [cleanupNotice, setCleanupNotice] = useState<string | null>(null);

  // Search Form State
  const [domainInput, setDomainInput] = useState<string>('ramp.com');
  const [limitCount, setLimitCount] = useState<number>(10);
  const [targetDepartment, setTargetDepartment] = useState<string>('all');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<DiscoveryJob | null>(null);
  const [_recentJobs, setRecentJobs] = useState<DiscoveryJob[]>([]);
  const [selectedJobFilter, setSelectedJobFilter] = useState<string | null>(null);
  const [isCancellingJob, setIsCancellingJob] = useState<boolean>(false);
  const [isRetryingJob, setIsRetryingJob] = useState<boolean>(false);

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
        const [provs, capsRes, cands, jobs] = await Promise.all([
          api.getDiscoveryProviders().catch(() => []),
          api.getConnectorCapabilities().catch(() => []),
          api.getAllDiscoveredCandidates({ limit: 100 }).catch(() => []),
          api.getAllDiscoveryJobs(10).catch(() => []),
        ]);
        if (!isMounted) return;
        setProviders(provs);
        setConnectorCapabilities(Array.isArray(capsRes) ? capsRes : []);
        
        const hunter = provs.find((p) => p.id === 'hunter');
        if (hunter && hunter.isConfigured) {
          setSelectedProviderId('hunter');
          setOperatingMode('live');
        } else {
          // If hunter is not configured, default to demo mode
          setSelectedProviderId('mock');
          setOperatingMode('demo');
        }
        setCandidates(cands);
        setRecentJobs(jobs);
        if (jobs.length > 0) {
          const activeOrFirst = jobs.find((j) => j.status === 'running' || j.status === 'queued') || jobs[0];
          setActiveJob(activeOrFirst);
        }
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

  // Real-time polling for active queued or running job
  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status !== 'queued' && activeJob.status !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const fresh = await api.getDiscoveryJob(activeJob.id);
        setActiveJob(fresh);
        setRecentJobs((prev) => prev.map((j) => (j.id === fresh.id ? fresh : j)));
        if (fresh.status === 'completed' || fresh.status === 'partially_completed') {
          void loadCandidates();
          const updatedJobs = await api.getAllDiscoveryJobs(10).catch(() => []);
          if (updatedJobs.length > 0) setRecentJobs(updatedJobs);
        }
      } catch (err) {
        console.error('[Discovery] Polling job status failed:', err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [activeJob, loadCandidates]);

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
        async: true,
      };

      if (targetDepartment !== 'all') {
        params.targetRoles = [targetDepartment];
      }

      const res = await api.startDiscoveryJob(params);
      setActiveJob(res.job);
      setRecentJobs((prev) => [res.job, ...prev.filter((j) => j.id !== res.job.id)]);
      setSelectedJobFilter(null);

      // If candidates were returned synchronously
      if (res.candidates && res.candidates.length > 0) {
        setCandidates((prev) => {
          const existingIds = new Set(prev.map((c) => c.id));
          const newOnes = res.candidates.filter((c) => !existingIds.has(c.id));
          return [...newOnes, ...prev];
        });

        const newlyEligibleIds = res.candidates
          .filter((c) => c.status === 'staged' && (c.dedupStatus === 'new' || c.dedupStatus === 'same_company_existing'))
          .map((c) => c.id);

        setSelectedIds((prev) => {
          const next = new Set(prev);
          newlyEligibleIds.forEach((id) => next.add(id));
          return next;
        });
      }
    } catch (err: any) {
      console.error('[Discovery] Job failed:', err);
      setSearchError(err instanceof ApiError ? err.message : 'Discovery job execution failed.');
    } finally {
      setIsSearching(false);
    }
  };

  // Run isolated Dry-Run Simulation (Mode B)
  const handleRunDryRun = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError(null);

    const domain = normalizeDomain(domainInput);
    if (!domain || !domain.includes('.')) {
      setSearchError('Please provide a valid corporate domain (e.g., stripe.com or ramp.com) for simulation.');
      return;
    }

    setIsDryRunning(true);
    try {
      const res = await api.runDryRunDiscovery({
        domain,
        limit: limitCount,
        targetRoles: targetDepartment !== 'all' ? [targetDepartment] : undefined,
      });
      setDryRunResult(res);
    } catch (err: any) {
      console.error('[Discovery] Dry run simulation failed:', err);
      setSearchError(err instanceof ApiError ? err.message : 'Dry-run simulation failed.');
    } finally {
      setIsDryRunning(false);
    }
  };

  // Purge Mock / Demo Sandbox Data (Mode C)
  const handleCleanupDemo = async () => {
    if (!window.confirm('Purge all demo sandbox candidates, mock discovery jobs, and demo leads? Production records will remain completely untouched.')) {
      return;
    }
    setIsCleaningDemo(true);
    setCleanupNotice(null);
    try {
      const res = await api.cleanupDemoData();
      setCleanupNotice(`Purged ${res.cleanedCandidates} mock candidates, ${res.cleanedJobs} jobs, and ${res.cleanedLeads} demo leads.`);
      await loadCandidates();
      onCandidatesIngested?.();
    } catch (err: any) {
      alert(`Cleanup failed: ${err.message}`);
    } finally {
      setIsCleaningDemo(false);
    }
  };


  const handleCancelJob = async () => {
    if (!activeJob) return;
    setIsCancellingJob(true);
    try {
      const updated = await api.cancelDiscoveryJob(activeJob.id);
      setActiveJob(updated);
      setRecentJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    } catch (err: any) {
      console.error('[Discovery] Cancel job failed:', err);
    } finally {
      setIsCancellingJob(false);
    }
  };

  const handleRetryJob = async () => {
    if (!activeJob) return;
    setIsRetryingJob(true);
    try {
      const updated = await api.retryDiscoveryJob(activeJob.id);
      setActiveJob(updated);
      setRecentJobs((prev) => prev.map((j) => (j.id === updated.id ? updated : j)));
    } catch (err: any) {
      console.error('[Discovery] Retry job failed:', err);
    } finally {
      setIsRetryingJob(false);
    }
  };

  // Filter candidates for table
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c) => {
      // Job specific filter
      if (selectedJobFilter && c.jobId !== selectedJobFilter) {
        return false;
      }
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
  }, [candidates, tableSearch, statusFilter, dedupFilter, tierFilter, selectedJobFilter]);

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
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold">
            <CheckCircle2 className="h-3 w-3" /> Verified
          </span>
        );
      case 'risky':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-amber-50 text-amber-800 border border-amber-200 px-1.5 py-0.5 text-[10px] font-semibold">
            <AlertTriangle className="h-3 w-3" /> Risky
          </span>
        );
      case 'undeliverable':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-rose-50 text-rose-800 border border-rose-200 px-1.5 py-0.5 text-[10px] font-semibold">
            <XCircle className="h-3 w-3" /> Undeliverable
          </span>
        );
      case 'inferred':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-sky-50 text-sky-800 border border-sky-200 px-1.5 py-0.5 text-[10px] font-semibold">
            <HelpCircle className="h-3 w-3" /> Inferred
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-600 border border-slate-200 px-1.5 py-0.5 text-[10px]">
            Unverified
          </span>
        );
    }
  };

  const renderDedupPill = (status: string) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold">
            New Lead
          </span>
        );
      case 'same_company_existing':
        return (
          <span className="inline-flex items-center rounded bg-indigo-50 text-indigo-800 border border-indigo-200 px-2 py-0.5 text-[10px] font-bold">
            Account Expansion
          </span>
        );
      case 'existing_lead':
        return (
          <span className="inline-flex items-center rounded bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 text-[10px] font-bold">
            In CRM Already
          </span>
        );
      case 'duplicate_in_job':
        return (
          <span className="inline-flex items-center rounded bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 text-[10px] font-medium">
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
              <Compass className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-[Plus_Jakarta_Sans]">
                  Discovery Engine
                </h1>
                <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
                  Real Sourcing
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Discover verified prospects, inspect field-level provenance, and safely bulk-ingest into your sales CRM.
              </p>
            </div>
          </div>
        </div>

        {/* Global Stats Counter */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">
              Staged Candidates
            </span>
            <span className="text-lg font-bold font-mono text-indigo-600">
              {candidates.filter((c) => c.status === 'staged').length}
            </span>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right shadow-2xs">
            <span className="text-[11px] font-semibold text-slate-500 block uppercase">
              Ingested to CRM
            </span>
            <span className="text-lg font-bold font-mono text-emerald-700">
              {candidates.filter((c) => c.status === 'ingested').length}
            </span>
          </div>
        </div>
      </div>

      {/* Discovery Subsystem Switcher */}
      <div className="flex flex-wrap border-b border-slate-200 gap-2 pb-2">
        <button
          onClick={() => setDiscoveryModeTab('domain_search')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            discoveryModeTab === 'domain_search'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Compass className="w-4 h-4" />
          Domain &amp; Contact Search
        </button>
        <button
          onClick={() => setDiscoveryModeTab('source_intelligence')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
            discoveryModeTab === 'source_intelligence'
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <Cpu className="w-4 h-4" />
          Adaptive Source Intelligence (Phase 6A)
          <span className="px-1.5 py-0.5 rounded text-[10px] bg-indigo-50 text-indigo-700 font-mono">
            New
          </span>
        </button>
      </div>

      {discoveryModeTab === 'source_intelligence' ? (
        <SourceIntelligenceWorkspace onPlanExecuted={loadCandidates} />
      ) : (
        <>
          {/* Three Explicit Operating Modes Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Operating Pipeline Mode
              </h2>
              <span className="text-xs text-slate-500">
                Choose between real external APIs, zero-credit dry-run simulation, or the demo sandbox
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Mode A: Live Discovery Card */}
              <div
                onClick={() => {
                  setOperatingMode('live');
                  setSelectedProviderId('hunter');
                  setDryRunResult(null);
                }}
                className={`cursor-pointer rounded-2xl border p-4 transition-all relative overflow-hidden flex flex-col justify-between ${
                  operatingMode === 'live'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-orange-100 border border-orange-200 flex items-center justify-center text-orange-600 font-black text-sm">
                        H
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">Mode A: Live Discovery</h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Hunter.io Domain Search API
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {hunterConfigured ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                          Configured
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Lock className="h-3 w-3" />
                          Key Required
                        </span>
                      )}
                    </div>
                  </div>

                  <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                    Executes real API requests against corporate domains. Enforces credentials and never fabricates live leads.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Credit Cost: 1 credit / domain</span>
                  {operatingMode === 'live' && (
                    <span className="text-indigo-600 font-bold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Selected
                    </span>
                  )}
                </div>
              </div>

              {/* Mode B: Dry-Run Simulation Card */}
              <div
                onClick={() => {
                  setOperatingMode('dry_run');
                  setSelectedProviderId('mock');
                }}
                className={`cursor-pointer rounded-2xl border p-4 transition-all relative overflow-hidden flex flex-col justify-between ${
                  operatingMode === 'dry_run'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-sky-100 border border-sky-200 flex items-center justify-center text-sky-600 font-bold text-sm">
                        <BarChart3 className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">Mode B: Dry-Run Simulation</h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Progressive Funnel Projection
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center rounded-full bg-sky-50 text-sky-800 border border-sky-200 px-2 py-0.5 text-[11px] font-bold">
                      Zero DB Writes
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                    Projects candidate yield, progressive filtering drop-offs, and estimated cost savings without touching production tables or spending credits.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <span>Credit Cost: 0 credits (Free)</span>
                  {operatingMode === 'dry_run' && (
                    <span className="text-indigo-600 font-bold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Selected
                    </span>
                  )}
                </div>
              </div>

              {/* Mode C: Demo Sandbox Card */}
              <div
                onClick={() => {
                  setOperatingMode('demo');
                  setSelectedProviderId('mock');
                  setDryRunResult(null);
                }}
                className={`cursor-pointer rounded-2xl border p-4 transition-all relative overflow-hidden flex flex-col justify-between ${
                  operatingMode === 'demo'
                    ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-500 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300 shadow-2xs'
                }`}
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-600 font-black text-sm">
                        LF
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-900 text-sm">Mode C: Demo Sandbox</h3>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Isolated Deterministic Dataset
                        </p>
                      </div>
                    </div>

                    <span className="inline-flex items-center rounded-full bg-purple-50 text-purple-800 border border-purple-200 px-2 py-0.5 text-[11px] font-bold">
                      Demo Data
                    </span>
                  </div>

                  <p className="mt-3 text-xs text-slate-600 leading-relaxed">
                    Air-gapped corporate catalog for end-to-end evaluation. Records are flagged as demo candidates and excluded from production attribution.
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleCleanupDemo();
                    }}
                    disabled={isCleaningDemo}
                    className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span>{isCleaningDemo ? 'Purging...' : 'Purge Demo Sandbox'}</span>
                  </button>

                  {operatingMode === 'demo' && (
                    <span className="text-indigo-600 font-bold flex items-center gap-1">
                      <Check className="h-3.5 w-3.5" /> Selected
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Cleanup Notice Banner */}
          {cleanupNotice && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 animate-in fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{cleanupNotice}</span>
              </div>
              <button
                onClick={() => setCleanupNotice(null)}
                className="text-emerald-700 hover:text-emerald-900 font-bold text-xs"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* Warning if Live mode selected but Hunter key missing */}
          {operatingMode === 'live' && !hunterConfigured && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 animate-in fade-in">
              <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
              <div className="space-y-1">
                <strong className="font-semibold block text-amber-800">
                  Real API Credentials Required: HUNTER_API_KEY is not configured
                </strong>
                <p className="leading-relaxed text-amber-800">
                  Live discovery communicates with external provider endpoints and cannot run without a valid Hunter.io key.
                  To protect data integrity, LeadForge AI will never pretend mock results are live results.
                  Configure <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">HUNTER_API_KEY</code> in your environment,
                  or switch to <button onClick={() => setOperatingMode('dry_run')} className="underline font-bold text-amber-900">Mode B: Dry-Run Simulation</button> or <button onClick={() => setOperatingMode('demo')} className="underline font-bold text-amber-900">Mode C: Demo Sandbox</button>.
                </p>
              </div>
            </div>
          )}

          {/* Search Configuration & Run Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <form
              onSubmit={(e) => {
                if (operatingMode === 'dry_run') {
                  void handleRunDryRun(e);
                } else {
                  void handleRunDiscovery(e);
                }
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
                {/* Domain input */}
                <div className="lg:col-span-5 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5 text-indigo-600" />
                    Target Company Domain
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={domainInput}
                      onChange={(e) => setDomainInput(e.target.value)}
                      placeholder="e.g. stripe.com or ramp.com"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Department Filter */}
                <div className="lg:col-span-3 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-indigo-600" />
                    Department Focus
                  </label>
                  <select
                    value={targetDepartment}
                    onChange={(e) => setTargetDepartment(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Departments</option>
                    <option value="executive">Executive &amp; Leadership</option>
                    <option value="engineering">Engineering &amp; Product</option>
                    <option value="sales">Sales &amp; Business Development</option>
                    <option value="it">Information Technology</option>
                    <option value="finance">Finance &amp; Operations</option>
                  </select>
                </div>

                {/* Limit selector */}
                <div className="lg:col-span-2 space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-indigo-600" />
                    Max Candidates
                  </label>
                  <select
                    value={limitCount}
                    onChange={(e) => setLimitCount(Number(e.target.value))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2.5 text-xs text-slate-800 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
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
                      isSearching ||
                      isDryRunning ||
                      (operatingMode === 'live' && !hunterConfigured)
                    }
                    className={`w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      operatingMode === 'dry_run'
                        ? 'bg-sky-600 hover:bg-sky-700'
                        : operatingMode === 'live'
                        ? 'bg-indigo-600 hover:bg-indigo-700'
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {isSearching || isDryRunning ? (
                      <>
                        <RefreshCw className="h-4 w-4 animate-spin" />
                        <span>{isDryRunning ? 'Simulating...' : 'Searching...'}</span>
                      </>
                    ) : operatingMode === 'dry_run' ? (
                      <>
                        <BarChart3 className="h-4 w-4" />
                        <span>Run Dry-Run</span>
                      </>
                    ) : operatingMode === 'live' ? (
                      <>
                        <Compass className="h-4 w-4" />
                        <span>Run Live Discovery</span>
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4" />
                        <span>Run Demo Discovery</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick domain buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                <span className="text-slate-500 text-[11px] font-medium">Quick Examples:</span>
                {quickDomains.map((dom) => (
                  <button
                    key={dom}
                    type="button"
                    onClick={() => setDomainInput(dom)}
                    className={`rounded-lg border px-2 py-0.5 text-[11px] font-mono transition-colors ${
                      domainInput === dom
                        ? 'border-indigo-300 bg-indigo-50 text-indigo-700 font-semibold'
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {dom}
                  </button>
                ))}
              </div>
            </form>

            {/* Search Error Notice */}
            {searchError && (
              <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{searchError}</span>
              </div>
            )}
          </div>

          {/* Mode B: Dry-Run Simulation Results View */}
          {dryRunResult && (
            <div className="rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50/70 to-indigo-50/40 p-5 shadow-xs space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between pb-3 border-b border-sky-200/60">
                <div className="flex items-center gap-2.5">
                  <span className="rounded-lg bg-sky-100 text-sky-800 border border-sky-200 px-2 py-0.5 text-xs font-bold font-mono">
                    [Dry-Run Simulation]
                  </span>
                  <h3 className="font-bold text-slate-900 text-sm">
                    Progressive Filtering Projection for {dryRunResult.domain}
                  </h3>
                </div>
                <button
                  onClick={() => setDryRunResult(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                  title="Close dry-run results"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* 5-Stage Progressive Funnel */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    1. Raw Accounts
                  </span>
                  <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
                    {dryRunResult.progressiveFunnel?.rawAccountsEvaluated ?? 0}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    2. Signal Qualified
                  </span>
                  <span className="text-xl font-bold font-mono text-indigo-600 mt-1 block">
                    {dryRunResult.progressiveFunnel?.signalQualifiedAccounts ?? 0}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    3. Decision Makers
                  </span>
                  <span className="text-xl font-bold font-mono text-purple-600 mt-1 block">
                    {dryRunResult.progressiveFunnel?.decisionMakersIdentified ?? 0}
                  </span>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">
                    4. Emails Verified
                  </span>
                  <span className="text-xl font-bold font-mono text-sky-600 mt-1 block">
                    {dryRunResult.progressiveFunnel?.emailsDiscovered ?? 0}
                  </span>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase block">
                    5. ICP Qualified
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-800 mt-1 block">
                    {dryRunResult.progressiveFunnel?.icpQualifiedCandidates ?? 0}
                  </span>
                </div>
              </div>

              {/* Projected Economics Callout */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 text-xs">
                <div className="flex items-center gap-4 text-slate-600">
                  <span>
                    Estimated Live Cost: <strong className="text-slate-900 font-mono">${dryRunResult.projectedEconomics?.estimatedCostLiveUsd?.toFixed(2) ?? '0.00'}</strong>
                  </span>
                  <span>•</span>
                  <span className="text-emerald-700 font-semibold">
                    Cost Avoided in Dry-Run: ${dryRunResult.projectedEconomics?.costAvoidedByDryRunUsd?.toFixed(2) ?? '0.00'}
                  </span>
                  <span>•</span>
                  <span>
                    Projected Yield: <strong className="text-indigo-600">{dryRunResult.projectedEconomics?.projectedYieldRatePercent ?? 0}%</strong>
                  </span>
                </div>

                <span className="text-[11px] text-slate-500 italic">
                  Isolated simulation — zero records written to production database
                </span>
              </div>
            </div>
          )}

          {/* Active Job Pipeline Monitor & History Card */}
          {activeJob && (
            <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden p-5 space-y-4">
              {/* Header: ID, Status, Provider, Actions */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-lg">
                    {activeJob.id}
                  </span>

                  {/* Status Badge */}
                  {activeJob.status === 'queued' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 text-blue-800 border border-blue-200 px-2.5 py-0.5 text-xs font-bold">
                      <Clock className="h-3.5 w-3.5 animate-pulse" />
                      QUEUED
                    </span>
                  )}
                  {activeJob.status === 'running' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 text-xs font-bold">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      RUNNING PIPELINE
                    </span>
                  )}
                  {activeJob.status === 'completed' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      COMPLETED
                    </span>
                  )}
                  {activeJob.status === 'partially_completed' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 text-orange-800 border border-orange-200 px-2.5 py-0.5 text-xs font-bold">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      PARTIALLY COMPLETED
                    </span>
                  )}
                  {activeJob.status === 'failed' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 text-rose-800 border border-rose-200 px-2.5 py-0.5 text-xs font-bold">
                      <XCircle className="h-3.5 w-3.5" />
                      FAILED
                    </span>
                  )}
                  {activeJob.status === 'cancelled' && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 px-2.5 py-0.5 text-xs font-bold">
                      <Ban className="h-3.5 w-3.5" />
                      CANCELLED
                    </span>
                  )}

                  <span className="text-xs text-slate-500">
                    Target Domain:{' '}
                    <strong className="text-slate-900 font-mono">{activeJob.queryParams.domain}</strong>
                  </span>
                  <span className="rounded bg-slate-100 text-slate-700 px-2 py-0.5 text-[11px] font-semibold uppercase">
                    {activeJob.provider} ({activeJob.mode})
                  </span>
                </div>

                {/* Monitor Controls */}
                <div className="flex items-center gap-2">
                  {/* Cancel Button */}
                  {(activeJob.status === 'queued' || activeJob.status === 'running') && (
                    <button
                      onClick={handleCancelJob}
                      disabled={isCancellingJob || Boolean(activeJob.cancelRequestedAt)}
                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100 transition-colors disabled:opacity-50"
                    >
                      {isCancellingJob ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Ban className="h-3 w-3" />
                      )}
                      <span>{activeJob.cancelRequestedAt ? 'Cancelling...' : 'Cancel Job'}</span>
                    </button>
                  )}

                  {/* Retry Button */}
                  {(activeJob.status === 'failed' ||
                    activeJob.status === 'cancelled' ||
                    activeJob.status === 'partially_completed') && (
                    <button
                      onClick={handleRetryJob}
                      disabled={isRetryingJob}
                      className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                    >
                      {isRetryingJob ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <RotateCcw className="h-3 w-3" />
                      )}
                      <span>Retry Pipeline</span>
                    </button>
                  )}

                  {/* Filter toggle */}
                  <button
                    onClick={() =>
                      setSelectedJobFilter((prev) => (prev === activeJob.id ? null : activeJob.id))
                    }
                    className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors ${
                      selectedJobFilter === activeJob.id
                        ? 'border-indigo-600 bg-indigo-600 text-white'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Filter className="h-3 w-3" />
                    <span>
                      {selectedJobFilter === activeJob.id
                        ? 'Showing This Job Only'
                        : 'Filter Table by This Job'}
                    </span>
                  </button>

                  {/* Dismiss Monitor */}
                  <button
                    onClick={() => setActiveJob(null)}
                    className="rounded-lg p-1 text-slate-400 hover:text-slate-600 transition-colors"
                    title="Close monitor"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Metrics Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                    Found
                  </span>
                  <span className="text-xl font-bold font-mono text-slate-900">
                    {activeJob.candidatesFound ?? activeJob.totalFound ?? 0}
                  </span>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                  <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                    Processed &amp; Staged
                  </span>
                  <span className="text-xl font-bold font-mono text-indigo-600">
                    {activeJob.candidatesProcessed ?? 0}
                  </span>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
                  <span className="text-[11px] font-semibold text-emerald-800 block uppercase">
                    Ingested to CRM
                  </span>
                  <span className="text-xl font-bold font-mono text-emerald-800">
                    {activeJob.candidatesIngested ?? 0}
                  </span>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                  <span className="text-[11px] font-semibold text-amber-800 block uppercase">
                    Skipped (Duplicates)
                  </span>
                  <span className="text-xl font-bold font-mono text-amber-800">
                    {activeJob.candidatesSkipped ?? 0}
                  </span>
                </div>
                <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3">
                  <span className="text-[11px] font-semibold text-rose-800 block uppercase">
                    Failed
                  </span>
                  <span className="text-xl font-bold font-mono text-rose-800">
                    {activeJob.candidatesFailed ?? 0}
                  </span>
                </div>
              </div>

              {/* Error Diagnostics Alert */}
              {activeJob.errorMessage && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2 text-rose-800 font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>Pipeline Execution Diagnostic:</span>
                    {activeJob.lastErrorCategory && (
                      <span className="rounded bg-rose-100 text-rose-800 border border-rose-200 px-1.5 py-0.5 text-[10px] font-mono uppercase">
                        Category: {activeJob.lastErrorCategory}
                      </span>
                    )}
                    {activeJob.attemptCount !== undefined && activeJob.maxRetries && (
                      <span className="text-rose-700 text-[11px] ml-auto">
                        Attempt {activeJob.attemptCount} of {activeJob.maxRetries}
                      </span>
                    )}
                  </div>
                  <p className="text-rose-800 pl-6 font-mono text-[11px]">{activeJob.errorMessage}</p>
                  {activeJob.nextRetryAt && (
                    <p className="text-amber-800 pl-6 text-[11px]">
                      Automatic retry scheduled for: {new Date(activeJob.nextRetryAt).toLocaleTimeString()}
                    </p>
                  )}
                </div>
              )}

              {/* Timestamps & Audit Row */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 pt-1">
                <div className="flex items-center gap-4">
                  <span>Created: {new Date(activeJob.createdAt).toLocaleTimeString()}</span>
                  {activeJob.startedAt && <span>Started: {new Date(activeJob.startedAt).toLocaleTimeString()}</span>}
                  {activeJob.completedAt && (
                    <span>Completed: {new Date(activeJob.completedAt).toLocaleTimeString()}</span>
                  )}
                </div>
                {activeJob.retryCount !== undefined && activeJob.retryCount > 0 && (
                  <span className="text-indigo-600 font-medium">
                    Retries executed: {activeJob.retryCount}
                  </span>
                )}
              </div>
            </div>
          )}

      {/* Candidate Review Table Section */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-xs overflow-hidden space-y-4 p-5">
        {/* Table Top Controls & Filters */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search Input */}
            <div className="relative min-w-[220px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Search candidates, title, email..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
              />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="staged">Staged Only</option>
              <option value="ingested">Ingested Only</option>
            </select>

            {/* Dedup Filter */}
            <select
              value={dedupFilter}
              onChange={(e) => setDedupFilter(e.target.value as any)}
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none cursor-pointer"
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
              className="rounded-xl border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-xs text-slate-700 focus:bg-white focus:outline-none cursor-pointer"
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
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 shadow-2xs"
              >
                Clear Selection ({selectedIds.size})
              </button>
            )}

            <button
              onClick={handleSelectAllEligible}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span>Select Eligible</span>
            </button>

            <button
              onClick={() => setIsBulkModalOpen(true)}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-1.5 text-xs font-bold text-white shadow-xs transition-all disabled:opacity-40 disabled:cursor-not-allowed"
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
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold">
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
                    className="rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="py-3 px-3">Contact &amp; Title</th>
                <th className="py-3 px-3">Company &amp; Domain</th>
                <th className="py-3 px-3">Direct Email &amp; Status</th>
                <th className="py-3 px-3">ICP Fit Preview</th>
                <th className="py-3 px-3">Identity Deduplication</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoadingCandidates ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-600" />
                    <span>Loading candidates...</span>
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 space-y-2">
                    <Compass className="h-8 w-8 mx-auto text-slate-400 mb-1" />
                    <p className="font-semibold text-slate-700">No candidate records match your filters.</p>
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
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isSelected ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectCandidate(cand.id)}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Contact & Title */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{cand.contactName}</span>
                          {cand.isMock && (
                            <span className="rounded bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.2 text-[9px] font-mono font-bold">
                              DEMO
                            </span>
                          )}
                          {cand.linkedin && (
                            <a
                              href={cand.linkedin}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:text-indigo-800"
                              title="LinkedIn Profile"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 truncate max-w-[200px]">
                          {cand.title}
                        </div>
                      </td>

                      {/* Company & Domain */}
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-800">{cand.companyName}</div>
                        <div className="text-[11px] font-mono text-indigo-600 flex items-center gap-1">
                          <Building className="h-3 w-3 text-slate-400" />
                          {cand.companyDomain}
                        </div>
                      </td>

                      {/* Email & Verification */}
                      <td className="py-3 px-3">
                        <div className="font-mono text-slate-800 select-all truncate max-w-[190px]">
                          {cand.email || <span className="text-slate-400 italic">No email</span>}
                        </div>
                        <div className="mt-1 flex items-center gap-1">
                          {renderVerificationPill(cand.emailVerification)}
                          {cand.confidenceScore !== null && cand.confidenceScore !== undefined && (
                            <span className="font-mono text-[10px] text-slate-500">
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
                                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                  : cand.icpScorePreview >= 60
                                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {cand.icpScorePreview}%
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                              {cand.icpTierPreview}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Unscored</span>
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
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-semibold">
                            <CheckCircle2 className="h-3 w-3" /> Ingested
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 text-slate-700 border border-slate-200 px-2 py-0.5 text-[11px] font-medium">
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
                            className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:border-slate-300 hover:text-slate-900 transition-colors shadow-2xs"
                            title="Inspect field-level provenance and source evidence"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>

                          {/* Single Ingest Action */}
                          {isEligible && (
                            <button
                              onClick={() => handleIngestSingle(cand.id)}
                              disabled={isIngestingSingleId === cand.id}
                              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100 transition-colors disabled:opacity-50"
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
      </>
    )}

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
