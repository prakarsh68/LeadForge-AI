import React, { useState, useEffect, useCallback } from 'react';
import type {
  SourceRegistryItem,
  SourceSignal,
  SourcingPlan,
  SourcingJob,
  SourceIntelligenceAnalytics,
  SignalCategory,
} from '../../types';
import { api } from '../../services/api';
import { AgenticSourcingPanel } from './AgenticSourcingPanel';
import {
  Cpu,
  Layers,
  Radio,
  Sliders,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Play,
  RotateCw,
  PlusCircle,
  Filter,
  DollarSign,
  Users,
  Target,
  Sparkles,
  Info,
} from 'lucide-react';

interface SourceIntelligenceWorkspaceProps {
  onPlanExecuted?: () => void;
}

export const SourceIntelligenceWorkspace: React.FC<SourceIntelligenceWorkspaceProps> = ({
  onPlanExecuted,
}) => {
  // Navigation tab
  const [activeTab, setActiveTab] = useState<'sources' | 'signals' | 'planner' | 'pipeline' | 'analytics' | 'agentic'>('agentic');

  // Status & Feature Flag
  const [isFlagEnabled, setIsFlagEnabled] = useState<boolean>(true);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Data states
  const [sources, setSources] = useState<SourceRegistryItem[]>([]);
  const [signals, setSignals] = useState<SourceSignal[]>([]);
  const [selectedSignalCategory, setSelectedSignalCategory] = useState<string>('all');
  const [analytics, setAnalytics] = useState<SourceIntelligenceAnalytics | null>(null);

  // Strategy Planner State
  const [planName, setPlanName] = useState<string>('Q4 High-Growth SaaS Expansion');
  const [campaignObjective, setCampaignObjective] = useState<string>(
    'Discover mid-market enterprise accounts with active hiring in RevOps/SDRs and verify executive emails.'
  );
  const [targetYield, setTargetYield] = useState<number>(30);
  const [maxBudget, setMaxBudget] = useState<number>(15);
  const [activePlanPreview, setActivePlanPreview] = useState<SourcingPlan | null>(null);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState<boolean>(false);
  const [isExecutingPlan, setIsExecutingPlan] = useState<boolean>(false);
  const [lastExecutedJob, setLastExecutedJob] = useState<SourcingJob | null>(null);

  // New Signal Modal / Form
  const [showSignalModal, setShowSignalModal] = useState<boolean>(false);
  const [newCompanyName, setNewCompanyName] = useState<string>('Vanguard Tech');
  const [newCompanyDomain, setNewCompanyDomain] = useState<string>('vanguard-tech.io');
  const [newSignalCategory, setNewSignalCategory] = useState<SignalCategory>('hiring');
  const [newSignalText, setNewSignalText] = useState<string>('Hiring 5 Enterprise Account Executives for North America Expansion');

  const showNotification = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const loadData = useCallback(async () => {
    try {
      const statusRes = await api.getSourceIntelligenceStatus().catch(() => ({
        enabled: false,
        sourcesCount: 0,
        signalsCount: 0,
        plansCount: 0,
        message: 'Backend Adaptive Source Intelligence is inactive.',
      }));

      setIsFlagEnabled(statusRes.enabled);
      setStatusMessage(statusRes.message);

      if (statusRes.enabled) {
        const [sourceList, signalList, analyticsData] = await Promise.all([
          api.getSourceRegistry().catch(() => []),
          api.getSourceSignals().catch(() => []),
          api.getSourceIntelligenceAnalytics().catch(() => null),
        ]);

        setSources(sourceList);
        setSignals(signalList);
        setAnalytics(analyticsData);
      }
    } catch {
      setIsFlagEnabled(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initialize = async () => {
      try {
        const statusRes = await api.getSourceIntelligenceStatus().catch(() => ({
          enabled: false,
          sourcesCount: 0,
          signalsCount: 0,
          plansCount: 0,
          message: 'Backend Adaptive Source Intelligence is inactive.',
        }));

        if (!isMounted) return;
        setIsFlagEnabled(statusRes.enabled);
        setStatusMessage(statusRes.message);

        if (statusRes.enabled) {
          const [sourceList, signalList, analyticsData] = await Promise.all([
            api.getSourceRegistry().catch(() => []),
            api.getSourceSignals().catch(() => []),
            api.getSourceIntelligenceAnalytics().catch(() => null),
          ]);
          if (!isMounted) return;
          setSources(sourceList);
          setSignals(signalList);
          setAnalytics(analyticsData);
        }
      } catch {
        if (isMounted) setIsFlagEnabled(false);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void initialize();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleToggleSource = async (id: string, currentEnabled: boolean) => {
    try {
      const updated = await api.toggleSource(id, !currentEnabled);
      setSources((prev) => prev.map((s) => (s.id === id ? updated : s)));
      showNotification(`Source "${updated.name}" ${updated.isEnabled ? 'enabled' : 'disabled'}.`);
    } catch {
      showNotification('Failed to toggle source state.');
    }
  };

  const handleCheckHealth = async (id?: string) => {
    try {
      await api.checkSourceHealth(id);
      const updatedSources = await api.getSourceRegistry();
      setSources(updatedSources);
      showNotification('Health check completed successfully.');
    } catch {
      showNotification('Health check failed.');
    }
  };

  const handleCreateSignal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await api.createSourceSignal({
        companyName: newCompanyName,
        companyDomain: newCompanyDomain,
        signalCategory: newSignalCategory,
        sourceId: 'demo_adaptive_source',
        signalText: newSignalText,
        confidence: 0.95,
        relevanceScore: 90,
      });
      setSignals((prev) => [created, ...prev]);
      setShowSignalModal(false);
      showNotification(`Signal for "${newCompanyName}" ingested successfully.`);
    } catch {
      showNotification('Failed to ingest signal.');
    }
  };

  const handleGeneratePreview = async () => {
    setIsGeneratingPlan(true);
    try {
      const preview = await api.previewSourcingPlan({
        name: planName,
        campaignObjective,
        constraints: {
          targetYield,
          maxBudget,
        },
      });
      setActivePlanPreview(preview);
      showNotification('Explainable sourcing strategy preview generated.');
    } catch {
      showNotification('Failed to generate strategy preview.');
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  const handleApproveAndExecute = async () => {
    if (!activePlanPreview) return;
    setIsExecutingPlan(true);
    try {
      // 1. Save Plan
      const saved = await api.saveSourcingPlan(activePlanPreview);
      // 2. Execute Plan
      const job = await api.executeSourcingPlan(saved.id);
      setLastExecutedJob(job);
      setActiveTab('pipeline');
      showNotification(`Plan "${saved.name}" executed: ${job.recordsQualified} qualified leads staged!`);
      if (onPlanExecuted) onPlanExecuted();
      // Reload analytics
      const analyticsData = await api.getSourceIntelligenceAnalytics().catch(() => null);
      if (analyticsData) setAnalytics(analyticsData);
    } catch (err: any) {
      showNotification(`Execution failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsExecutingPlan(false);
    }
  };

  const filteredSignals = signals.filter((s) => {
    if (selectedSignalCategory === 'all') return true;
    return s.signalCategory === selectedSignalCategory;
  });

  return (
    <div className="space-y-6">
      {/* Banner / Notice */}
      {actionNotice && (
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-sm flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>{actionNotice}</span>
          </div>
        </div>
      )}

      {/* Feature Flag Banner if disabled */}
      {!isFlagEnabled && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 text-amber-400 flex-shrink-0" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-200">Adaptive Source Intelligence Engine Disabled</div>
            <p className="text-xs text-amber-300/80">
              {statusMessage || 'Enable SOURCE_INTELLIGENCE_ENABLED=true in server/.env to activate multi-source strategy planning, business signal ingestion, and progressive candidate filtering.'}
            </p>
          </div>
        </div>
      )}

      {/* Top Workspace Bar */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 backdrop-blur-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Phase 6A
              </span>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-400" />
                Adaptive Source Intelligence Engine
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Multi-source registry, real-time business signals, explainable utility planner, and 8-stage progressive candidate filtering.
            </p>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-3">
            <div className="px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700/60 text-center">
              <div className="text-xs text-slate-400">Sources</div>
              <div className="text-sm font-bold text-white">{sources.length}</div>
            </div>
            <div className="px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700/60 text-center">
              <div className="text-xs text-slate-400">Signals</div>
              <div className="text-sm font-bold text-indigo-400">{signals.length}</div>
            </div>
            <div className="px-3 py-2 bg-slate-800/80 rounded-xl border border-slate-700/60 text-center">
              <div className="text-xs text-slate-400">Yield</div>
              <div className="text-sm font-bold text-emerald-400">
                {analytics?.totals.totalQualified || 6}
              </div>
            </div>
            <button
              onClick={() => loadData()}
              disabled={isLoading}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              title="Refresh"
            >
              <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Tab Sub-Navigation */}
        <div className="flex flex-wrap gap-2 mt-5 border-t border-slate-800/80 pt-4">
          <button
            onClick={() => setActiveTab('sources')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
              activeTab === 'sources'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Source Catalog ({sources.length})
          </button>
          <button
            onClick={() => setActiveTab('signals')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
              activeTab === 'signals'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Radio className="w-4 h-4" />
            Signal Intelligence ({signals.length})
          </button>
          <button
            onClick={() => setActiveTab('planner')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
              activeTab === 'planner'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Sliders className="w-4 h-4" />
            Strategy Planner
          </button>
          <button
            onClick={() => setActiveTab('pipeline')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
              activeTab === 'pipeline'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Filter className="w-4 h-4" />
            8-Stage Filter Funnel
            {lastExecutedJob && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
              activeTab === 'analytics'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'bg-slate-800/60 text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Source Performance & ROI
          </button>
          <button
            onClick={() => setActiveTab('agentic')}
            className={`px-3.5 py-2 rounded-xl text-xs font-medium flex items-center gap-2 transition-all ${
              activeTab === 'agentic'
                ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 ring-1 ring-purple-400'
                : 'bg-slate-800/60 text-purple-300 hover:text-white hover:bg-slate-800 border border-purple-500/20'
            }`}
          >
            <Sparkles className="w-4 h-4 text-purple-300" />
            Agentic Orchestrator (Phase 6B)
          </button>
        </div>
      </div>

      {/* TAB 1: Source Catalog */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-300">Registered Connectors & Providers</h3>
            <button
              onClick={() => handleCheckHealth()}
              className="text-xs px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Check All Health
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sources.map((s) => {
              const isHealthy = s.healthStatus === 'healthy';
              return (
                <div
                  key={s.id}
                  className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-semibold text-white text-sm">{s.name}</div>
                        <div className="text-xs text-slate-400 font-mono mt-0.5">ID: {s.id}</div>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                          isHealthy
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isHealthy ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                        {s.healthStatus}
                      </span>
                    </div>

                    {/* Capabilities */}
                    <div className="flex flex-wrap gap-1.5">
                      {s.capabilities.map((cap) => (
                        <span
                          key={cap}
                          className="px-2 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300 border border-slate-700/60 font-mono"
                        >
                          {cap.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>

                    {/* Cost Model */}
                    <div className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-xs text-slate-400 space-y-1">
                      <div className="flex justify-between">
                        <span>Cost / Record:</span>
                        <span className="text-white font-medium">
                          ${s.costModel.perRecord?.toFixed(2) || '0.00'} {s.costModel.currency}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Daily Quota:</span>
                        <span className="text-white font-medium">
                          {s.rateLimits.dailyQuota?.toLocaleString()} calls
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between mt-4">
                    <button
                      onClick={() => handleCheckHealth(s.id)}
                      className="text-xs text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors"
                    >
                      <RotateCw className="w-3 h-3" />
                      Ping Health
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                      <span>{s.isEnabled ? 'Enabled' : 'Disabled'}</span>
                      <input
                        type="checkbox"
                        checked={s.isEnabled}
                        onChange={() => handleToggleSource(s.id, s.isEnabled)}
                        className="rounded border-slate-700 bg-slate-800 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: Signal Feed */}
      {activeTab === 'signals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Category:</span>
              <select
                value={selectedSignalCategory}
                onChange={(e) => setSelectedSignalCategory(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs text-slate-300 rounded-lg px-2.5 py-1.5 focus:ring-1 focus:ring-indigo-500"
              >
                <option value="all">All Categories</option>
                <option value="hiring">Hiring Velocity</option>
                <option value="technology">Technology Stack</option>
                <option value="funding">Funding & Capital</option>
                <option value="expansion">Regional Expansion</option>
              </select>
            </div>

            <button
              onClick={() => setShowSignalModal(true)}
              className="text-xs px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-medium flex items-center gap-1.5 transition-colors self-start sm:self-auto"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              Ingest Test Signal
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredSignals.map((sig) => (
              <div
                key={sig.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-semibold text-white text-sm">{sig.companyName}</div>
                    <div className="text-xs text-indigo-400 font-mono">{sig.companyDomain}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase">
                      {sig.signalCategory}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {sig.relevanceScore} pts
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-300 line-clamp-2">{sig.signalText}</p>

                <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-800/80">
                  <span>Source: {sig.sourceId}</span>
                  <span>Confidence: {Math.round(sig.confidence * 100)}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Modal for manual ingestion */}
          {showSignalModal && (
            <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-semibold text-white">Ingest Business Signal</h3>
                  <button
                    onClick={() => setShowSignalModal(false)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>
                <form onSubmit={handleCreateSignal} className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-400">Company Name</label>
                    <input
                      type="text"
                      value={newCompanyName}
                      onChange={(e) => setNewCompanyName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Company Domain</label>
                    <input
                      type="text"
                      value={newCompanyDomain}
                      onChange={(e) => setNewCompanyDomain(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mt-1"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Signal Category</label>
                    <select
                      value={newSignalCategory}
                      onChange={(e) => setNewSignalCategory(e.target.value as any)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mt-1"
                    >
                      <option value="hiring">Hiring Velocity</option>
                      <option value="technology">Technology Stack</option>
                      <option value="funding">Funding & Capital</option>
                      <option value="expansion">Regional Expansion</option>
                      <option value="procurement">Procurement</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-slate-400">Signal Evidence Text</label>
                    <textarea
                      value={newSignalText}
                      onChange={(e) => setNewSignalText(e.target.value)}
                      rows={3}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white mt-1"
                      required
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSignalModal(false)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs text-white font-medium"
                    >
                      Ingest Signal
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Strategy Planner */}
      {activeTab === 'planner' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Plan Configuration Form */}
          <div className="lg:col-span-1 p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sliders className="w-4 h-4 text-indigo-400" />
              Sourcing Objective & Budget
            </h3>

            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400">Plan Name</label>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400">Campaign Objective</label>
                <textarea
                  value={campaignObjective}
                  onChange={(e) => setCampaignObjective(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-400">Target Yield</label>
                  <input
                    type="number"
                    value={targetYield}
                    onChange={(e) => setTargetYield(Number(e.target.value))}
                    min={5}
                    max={200}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-400">Max Budget ($)</label>
                  <input
                    type="number"
                    value={maxBudget}
                    onChange={(e) => setMaxBudget(Number(e.target.value))}
                    min={1}
                    max={500}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white mt-1"
                  />
                </div>
              </div>

              <button
                onClick={handleGeneratePreview}
                disabled={isGeneratingPlan}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                <Sparkles className="w-4 h-4" />
                {isGeneratingPlan ? 'Evaluating Utility...' : 'Generate Strategy Preview'}
              </button>
            </div>
          </div>

          {/* Strategy Plan Preview */}
          <div className="lg:col-span-2 space-y-4">
            {activePlanPreview ? (
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-white">{activePlanPreview.name}</h4>
                    <p className="text-xs text-slate-400 mt-0.5">{activePlanPreview.campaignObjective}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-xs text-slate-400">Estimated Cost</div>
                      <div className="text-sm font-bold text-emerald-400">
                        ${activePlanPreview.estimatedCost?.toFixed(2) || '0.00'}
                      </div>
                    </div>
                    <button
                      onClick={handleApproveAndExecute}
                      disabled={isExecutingPlan}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      {isExecutingPlan ? 'Executing Stages 1-8...' : 'Approve & Execute Plan'}
                    </button>
                  </div>
                </div>

                {/* Ranked Sources with Explainable Utility & Rationales */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-300">
                    Source Utility Ranking (Deterministic Utility Function)
                  </div>
                  <div className="space-y-2">
                    {activePlanPreview.selectedSources.map((s, idx) => (
                      <div
                        key={s.sourceId}
                        className="p-3.5 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3"
                      >
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-white flex items-center gap-2">
                              {s.sourceName}
                              <span className="px-2 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 uppercase">
                                Role: {s.role.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-1 italic">"{s.rationale}"</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono self-end md:self-auto">
                          <div className="text-slate-400">
                            Utility: <span className="text-indigo-400 font-bold">{s.utilityScore}/100</span>
                          </div>
                          <div className="text-slate-400">
                            Cost: <span className="text-emerald-400">${s.estimatedCost.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 8-Stage Filter Funnel Blueprint */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-300">
                    Progressive Filtering Blueprint (8 Verification Gates)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {activePlanPreview.stagesPipeline.map((st) => (
                      <div
                        key={st.stageNumber}
                        className="p-2.5 rounded-xl bg-slate-800/40 border border-slate-800 text-center space-y-1"
                      >
                        <span className="text-[10px] font-bold text-indigo-400 uppercase">
                          Stage {st.stageNumber}
                        </span>
                        <div className="text-xs font-medium text-slate-200 line-clamp-1">{st.stageName}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
                <Target className="w-10 h-10 text-slate-600 mx-auto" />
                <h4 className="text-sm font-semibold text-slate-300">No Plan Preview Active</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Configure campaign objectives, target lead yield, and budget constraints on the left, then click "Generate Strategy Preview".
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: 8-Stage Filter Funnel Monitor */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">8-Stage Progressive Filtering Pipeline Monitor</h3>
              <p className="text-xs text-slate-400">
                Stage-by-stage drop-off metrics, screening efficiencies, and categorized rejection reasons.
              </p>
            </div>
          </div>

          {lastExecutedJob ? (
            <div className="space-y-4">
              {/* Job Summary Banner */}
              <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-500/20 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="font-semibold text-white">Job ID: {lastExecutedJob.id}</span>
                    <span className="text-slate-400 ml-2">Status: {lastExecutedJob.status}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 font-mono text-slate-300">
                  <span>Sourced: {lastExecutedJob.recordsSourced}</span>
                  <span>Screened Out: {lastExecutedJob.recordsScreened}</span>
                  <span className="text-emerald-400 font-bold">Qualified: {lastExecutedJob.recordsQualified}</span>
                  <span className="text-indigo-400">Cost: ${lastExecutedJob.costIncurred.toFixed(2)}</span>
                </div>
              </div>

              {/* Stage Cards */}
              <div className="space-y-2.5">
                {Object.values(lastExecutedJob.stageCounts).map((st) => (
                  <div
                    key={st.stageNumber}
                    className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-indigo-500/20 text-indigo-400 text-xs font-bold flex items-center justify-center">
                          {st.stageNumber}
                        </span>
                        <span className="font-semibold text-white text-sm">{st.stageName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs font-mono">
                        <span className="text-slate-400">In: {st.inputCount}</span>
                        <span className="text-emerald-400">Out: {st.outputCount}</span>
                        <span className="text-rose-400">Filtered: -{st.rejectedCount}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-400 font-semibold">
                          {st.efficiencyPct}% Reduction
                        </span>
                      </div>
                    </div>

                    {/* Funnel Progress Bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-indigo-500 h-full rounded-full transition-all"
                        style={{
                          width: `${st.inputCount > 0 ? (st.outputCount / st.inputCount) * 100 : 100}%`,
                        }}
                      />
                    </div>

                    {/* Exclusions Breakdown */}
                    {Object.keys(st.exclusionBreakdown).length > 0 && (
                      <div className="pt-2 border-t border-slate-800/60">
                        <div className="text-[11px] font-semibold text-slate-400 mb-1">
                          Categorized Exclusions:
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {Object.entries(st.exclusionBreakdown).map(([reason, count]) => (
                            <span
                              key={reason}
                              className="px-2 py-0.5 rounded text-[11px] bg-slate-800/80 text-rose-300 border border-rose-500/20"
                            >
                              {reason}: <strong className="text-white">{count}</strong>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-center space-y-3">
              <Filter className="w-10 h-10 text-slate-600 mx-auto" />
              <h4 className="text-sm font-semibold text-slate-300">No Active Pipeline Execution</h4>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Go to the Strategy Planner tab and click "Approve & Execute Plan" to run candidates through the 8 stages in real time.
              </p>
            </div>
          )}
        </div>
      )}

      {/* TAB 5: Source Performance Analytics & ROI */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          {analytics ? (
            <>
              {/* Summary Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Total Sourced</span>
                    <Users className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    {analytics.totals.totalEntitiesSourced}
                  </div>
                  <div className="text-[11px] text-slate-500">Across all catalog connectors</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Qualified Leads</span>
                    <Target className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {analytics.totals.totalQualified}
                  </div>
                  <div className="text-[11px] text-slate-500">Meeting ICP threshold (≥78)</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Unit Cost / Qualified</span>
                    <DollarSign className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="text-2xl font-bold text-white">
                    ${analytics.totals.averageCostPerQualified.toFixed(2)}
                  </div>
                  <div className="text-[11px] text-slate-500">Average acquisition cost</div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-1">
                  <div className="text-xs text-slate-400 flex items-center justify-between">
                    <span>Pipeline Revenue</span>
                    <TrendingUp className="w-4 h-4 text-indigo-400" />
                  </div>
                  <div className="text-2xl font-bold text-indigo-400">
                    ${analytics.totals.totalPipelineRevenue.toLocaleString()}
                  </div>
                  <div className="text-[11px] text-slate-500">Attributed opportunity value</div>
                </div>
              </div>

              {/* Source-by-Source Comparison Table */}
              <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-4">
                <h4 className="text-sm font-semibold text-white">Source Conversion & Downstream Attribution</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400 font-medium">
                        <th className="pb-3 pl-2">Source</th>
                        <th className="pb-3">Yield</th>
                        <th className="pb-3">Duplicate %</th>
                        <th className="pb-3">Qualified</th>
                        <th className="pb-3">Cost / Lead</th>
                        <th className="pb-3">Replies</th>
                        <th className="pb-3">Meetings</th>
                        <th className="pb-3">Revenue</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {analytics.sources.map((src) => (
                        <tr key={src.sourceId} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-3 pl-2 font-medium text-white">{src.sourceName}</td>
                          <td className="py-3 font-mono text-slate-300">{src.entitiesYielded}</td>
                          <td className="py-3 font-mono text-slate-400">{src.duplicateRatePct}%</td>
                          <td className="py-3 font-mono text-emerald-400 font-bold">{src.qualifiedCount}</td>
                          <td className="py-3 font-mono text-white">${src.unitCostPerQualified.toFixed(2)}</td>
                          <td className="py-3 font-mono text-slate-300">{src.repliesAttributed}</td>
                          <td className="py-3 font-mono text-indigo-400 font-bold">{src.meetingsAttributed}</td>
                          <td className="py-3 font-mono text-emerald-400 font-medium">
                            ${src.pipelineRevenueAttributed.toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Strategic Source Recommendations */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-white">Source Recommendations</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {analytics.sources.map((src) => (
                    <div
                      key={src.sourceId}
                      className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800 flex items-start gap-3"
                    >
                      <Info className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="text-xs font-semibold text-white">{src.sourceName}</div>
                        <p className="text-xs text-slate-300 mt-1">{src.recommendation}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="p-12 text-center text-xs text-slate-400">Loading performance metrics...</div>
          )}
        </div>
      )}

      {/* TAB 6: Agentic Orchestrator (Phase 6B) */}
      {activeTab === 'agentic' && (
        <AgenticSourcingPanel onRunExecuted={onPlanExecuted} />
      )}
    </div>
  );
};
