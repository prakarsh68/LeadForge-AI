import React, { useState, useEffect, useCallback } from 'react';
import type {
  AgenticSourcingRun,
  AgenticSourcingStep,
  ParsedCampaignIntent,
  SourcingOptimizationWeight,
  SourcingExperiment,
  AgenticSourcingStatus,
} from '../../types';
import { api } from '../../services/api';
import {
  Sparkles,
  Bot,
  Brain,
  Play,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  DollarSign,
  Layers,
  Zap,
  Clock,
  FlaskConical,
  Activity,
} from 'lucide-react';

interface AgenticSourcingPanelProps {
  onRunExecuted?: () => void;
}

export const AgenticSourcingPanel: React.FC<AgenticSourcingPanelProps> = ({
  onRunExecuted,
}) => {
  // Status & Flags
  const [status, setStatus] = useState<AgenticSourcingStatus | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<string | null>(null);

  // Intent Parsing & Run Launch
  const [rawIntent, setRawIntent] = useState<string>(
    'Discover 25 high-growth B2B fintech SaaS companies in US & UK with recent hiring in RevOps or VP Sales, verify executive contact emails, and keep total acquisition cost under $15.00.'
  );
  const [parsedIntent, setParsedIntent] = useState<ParsedCampaignIntent | null>(null);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [isLaunchingRun, setIsLaunchingRun] = useState<boolean>(false);

  // Runs & Active Run Trace
  const [runs, setRuns] = useState<AgenticSourcingRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AgenticSourcingRun | null>(null);
  const [selectedStep, setSelectedStep] = useState<AgenticSourcingStep | null>(null);

  // Self-Optimization Weights
  const [weights, setWeights] = useState<SourcingOptimizationWeight[]>([]);
  const [isRecomputing, setIsRecomputing] = useState<boolean>(false);

  // A/B Benchmark Experiments
  const [experiments, setExperiments] = useState<SourcingExperiment[]>([]);
  const [isRunningExp, setIsRunningExp] = useState<boolean>(false);
  const [sampleSize, setSampleSize] = useState<number>(200);

  // Sub-view in Agentic Panel
  const [subView, setSubView] = useState<'orchestrator' | 'weights' | 'experiments'>('orchestrator');

  const showNotification = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 4000);
  };

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [statusRes, runsRes, weightsRes, expRes] = await Promise.all([
        api.getAgenticSourcingStatus().catch(() => null),
        api.getAgenticRuns().catch(() => []),
        api.getSourcingOptimizationWeights().catch(() => []),
        api.getSourcingExperiments().catch(() => []),
      ]);

      if (statusRes) setStatus(statusRes);
      setRuns(runsRes);
      if (runsRes.length > 0) {
        setSelectedRun((prev) => prev || runsRes[0]);
        if (runsRes[0].steps && runsRes[0].steps.length > 0) {
          setSelectedStep((prev) => prev || runsRes[0].steps[0]);
        }
      }
      setWeights(weightsRes);
      setExperiments(expRes);
    } catch {
      showNotification('Failed to initialize Agentic Sourcing state.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;
    const initialize = async () => {
      try {
        const [statusRes, runsRes, weightsRes, expRes] = await Promise.all([
          api.getAgenticSourcingStatus().catch(() => null),
          api.getAgenticRuns().catch(() => []),
          api.getSourcingOptimizationWeights().catch(() => []),
          api.getSourcingExperiments().catch(() => []),
        ]);

        if (!isMounted) return;
        if (statusRes) setStatus(statusRes);
        setRuns(runsRes);
        if (runsRes.length > 0) {
          setSelectedRun((prev) => prev || runsRes[0]);
          if (runsRes[0].steps && runsRes[0].steps.length > 0) {
            setSelectedStep((prev) => prev || runsRes[0].steps[0]);
          }
        }
        setWeights(weightsRes);
        setExperiments(expRes);
      } catch {
        // Init error handled gracefully
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    void initialize();
    return () => {
      isMounted = false;
    };
  }, []);

  // Handle Intent Parse
  const handleParseIntent = async () => {
    if (!rawIntent.trim()) return;
    setIsParsing(true);
    try {
      const result = await api.parseCampaignIntent({ rawIntent: rawIntent.trim() });
      setParsedIntent(result);
      showNotification(`Campaign intent parsed via ${result.interpretationMode === 'llm_parsed' ? 'AI completion' : 'deterministic fallback'}.`);
    } catch {
      showNotification('Failed to parse campaign intent.');
    } finally {
      setIsParsing(false);
    }
  };

  // Handle Create and Execute Run
  const handleLaunchAgenticRun = async () => {
    if (!rawIntent.trim()) return;
    setIsLaunchingRun(true);
    try {
      // 1. Create run
      const newRun = await api.createAgenticRun({
        campaignIntent: rawIntent.trim(),
        name: parsedIntent ? `Agentic: ${parsedIntent.campaignObjective.slice(0, 32)}` : 'Agentic Campaign Run',
        maxBudgetCredits: parsedIntent?.budgetLimit || 15,
        targetYield: parsedIntent?.desiredCompanyCount || 25,
      });

      // 2. Execute run immediately
      const executed = await api.executeAgenticRun(newRun.id);
      setSelectedRun(executed);
      if (executed.steps && executed.steps.length > 0) {
        setSelectedStep(executed.steps[0]);
      }
      setRuns((prev) => [executed, ...prev.filter((r) => r.id !== executed.id)]);
      showNotification(`Agentic sourcing completed! Yield: ${executed.yieldAchieved} qualified leads (Cost: $${executed.budgetSpent.toFixed(2)}).`);
      if (onRunExecuted) onRunExecuted();
    } catch {
      showNotification('Failed to execute agentic sourcing run.');
    } finally {
      setIsLaunchingRun(false);
    }
  };

  // Recompute Empirical Weights
  const handleRecomputeWeights = async () => {
    setIsRecomputing(true);
    try {
      const updated = await api.recomputeOptimizationWeights();
      setWeights(updated);
      showNotification('Empirical optimization weights recomputed from Phase 5 engagement outcomes!');
    } catch {
      showNotification('Failed to recompute optimization weights.');
    } finally {
      setIsRecomputing(false);
    }
  };

  // Run A/B Experiment
  const handleRunExperiment = async () => {
    setIsRunningExp(true);
    try {
      const exp = await api.runSourcingExperiment({ sampleSize });
      setExperiments((prev) => [exp, ...prev]);
      showNotification(`A/B Benchmark concluded! Yield uplift: +${exp.upliftSummary.yieldUpliftPct}%, Cost reduction: -${exp.upliftSummary.costReductionPct}%.`);
    } catch {
      showNotification('Failed to execute A/B sourcing benchmark.');
    } finally {
      setIsRunningExp(false);
    }
  };

  const getStatusBadge = (runStatus: string) => {
    switch (runStatus) {
      case 'completed':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'running':
      case 'executing':
        return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
      case 'failed':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'cancelled':
        return 'bg-slate-100 text-slate-600 border-slate-200';
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const getStepStatusIcon = (stepStatus: string) => {
    switch (stepStatus) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-600" />;
      case 'partial':
        return <AlertTriangle className="w-4 h-4 text-amber-600" />;
      case 'skipped':
        return <Clock className="w-4 h-4 text-slate-400" />;
      case 'failed':
        return <AlertTriangle className="w-4 h-4 text-rose-600" />;
      default:
        return <Activity className="w-4 h-4 text-blue-600 animate-spin" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notice */}
      {notice && (
        <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-indigo-900 text-sm flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-indigo-600 flex-shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {/* Feature Flag Warning if disabled */}
      {status && !status.enabled && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-sm flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5 text-amber-600 flex-shrink-0" />
          <div>
            <div className="font-semibold text-amber-950">Agentic Sourcing Orchestrator Disabled</div>
            <p className="text-xs text-amber-800 mt-0.5">
              Set <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-900 font-mono">AGENTIC_SOURCING_ENABLED=true</code> in your environment to activate autonomous multi-tool planning and execution.
            </p>
          </div>
        </div>
      )}

      {/* Header & Sub-Navigation */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Phase 6B
              </span>
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Bot className="w-5 h-5 text-indigo-600" />
                Agentic Sourcing Orchestrator & Self-Optimization
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Autonomous multi-tool workflow execution, dynamic fallback routing, adaptive budget quotas, selective RAG research, and empirical learning from engagement outcomes.
            </p>
          </div>

          {/* Sub-view switcher */}
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button
              onClick={() => setSubView('orchestrator')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                subView === 'orchestrator'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Orchestrator Runs ({runs.length})
            </button>
            <button
              onClick={() => setSubView('weights')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                subView === 'weights'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Learned Weights ({weights.length})
            </button>
            <button
              onClick={() => setSubView('experiments')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                subView === 'experiments'
                  ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60 font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A/B Benchmarks ({experiments.length})
            </button>
            <button
              onClick={loadAll}
              disabled={isLoading}
              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-200 transition-colors"
              title="Refresh"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* SUB-VIEW 1: ORCHESTRATOR RUNS */}
      {subView === 'orchestrator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Natural Language Intent & Run Trigger (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <Brain className="w-4 h-4 text-indigo-600" />
                  Natural Language Campaign Intent
                </h3>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200 font-medium">
                  Dual-Mode AI / Rule
                </span>
              </div>

              <div>
                <textarea
                  value={rawIntent}
                  onChange={(e) => setRawIntent(e.target.value)}
                  rows={4}
                  className="w-full bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 resize-none font-sans"
                  placeholder="Describe target companies, signals, roles, and constraints..."
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleParseIntent}
                  disabled={isParsing || !rawIntent.trim()}
                  className="flex-1 py-2 px-3 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 border border-slate-200 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 text-indigo-600 ${isParsing ? 'animate-spin' : ''}`} />
                  {isParsing ? 'Parsing...' : 'Analyze Intent'}
                </button>
                <button
                  onClick={handleLaunchAgenticRun}
                  disabled={isLaunchingRun || !rawIntent.trim()}
                  className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 ${isLaunchingRun ? 'animate-spin' : ''}`} />
                  {isLaunchingRun ? 'Executing Sourcing...' : 'Launch Agentic Run'}
                </button>
              </div>

              {/* Parsed Intent Card */}
              {parsedIntent && (
                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs animate-fade-in">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                    <span className="font-semibold text-indigo-900">Parsed Sourcing Blueprint</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-mono font-medium">
                      {parsedIntent.interpretationMode}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500">Target Industries:</span>
                      <div className="text-slate-900 font-medium truncate">
                        {parsedIntent.targetIndustries.join(', ') || 'Any'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Target Roles:</span>
                      <div className="text-slate-900 font-medium truncate">
                        {parsedIntent.targetRoles.join(', ') || 'Any'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Target Geography:</span>
                      <div className="text-slate-900 font-medium truncate">
                        {parsedIntent.targetGeography || 'Global'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-500">Budget Limit:</span>
                      <div className="text-emerald-700 font-semibold font-mono">
                        ${parsedIntent.budgetLimit.toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {parsedIntent.buyingTriggers.length > 0 && (
                    <div>
                      <span className="text-slate-500 text-[10px]">Intent Triggers:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedIntent.buyingTriggers.map((trig, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-white text-[10px] text-indigo-700 border border-indigo-200 font-medium"
                          >
                            {trig}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {parsedIntent.recommendedSources.length > 0 && (
                    <div>
                      <span className="text-slate-500 text-[10px]">Selected Sources:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {parsedIntent.recommendedSources.map((src, idx) => (
                          <span
                            key={idx}
                            className="px-1.5 py-0.5 rounded bg-emerald-50 text-[10px] text-emerald-700 border border-emerald-200 font-medium"
                          >
                            {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Run History List */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  Past Orchestrator Runs
                </span>
                <span className="text-xs text-slate-500 font-normal">{runs.length} runs</span>
              </h3>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {runs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-500">
                    No runs yet. Launch an agentic run above to see autonomous orchestration in action.
                  </div>
                ) : (
                  runs.map((r) => {
                    const isSelected = selectedRun?.id === r.id;
                    return (
                      <div
                        key={r.id}
                        onClick={() => {
                          setSelectedRun(r);
                          if (r.steps && r.steps.length > 0) setSelectedStep(r.steps[0]);
                        }}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                            : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-900 truncate max-w-[180px]">{r.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getStatusBadge(r.status)}`}>
                            {r.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2">
                          <span>Yield: <strong className="text-emerald-700">{r.yieldAchieved}</strong> leads</span>
                          <span>Spent: <strong className="text-slate-800">${r.budgetSpent.toFixed(2)}</strong></span>
                          <span>Score: <strong className="text-indigo-700">{r.efficiencyScore}%</strong></span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Execution Trace & Step Inspection (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {selectedRun ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
                {/* Run Overview Metrics */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-200 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-bold text-slate-900">{selectedRun.name}</h3>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full border ${getStatusBadge(selectedRun.status)}`}>
                        {selectedRun.status}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1 italic line-clamp-1">
                      "{selectedRun.naturalLanguageIntent}"
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-[10px] text-slate-500">Total Spent / Limit</div>
                      <div className="text-xs font-bold text-emerald-700 font-mono">
                        ${selectedRun.budgetSpent.toFixed(2)} / ${selectedRun.budgetLimit.toFixed(2)}
                      </div>
                    </div>
                    <div className="text-right border-l border-slate-200 pl-3">
                      <div className="text-[10px] text-slate-500">Qualified Yield</div>
                      <div className="text-xs font-bold text-slate-900 font-mono">
                        {selectedRun.yieldAchieved} / {selectedRun.targetYield}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Multi-Stage Budget Allocation Gauge */}
                <div className="space-y-2 bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-700 font-medium flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      Multi-Stage Adaptive Budget Allocation (Workstream G)
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Efficiency Score: {selectedRun.efficiencyScore}%
                    </span>
                  </div>

                  {/* Segmented bar: 20% Discovery, 30% Signals, 50% Contacts */}
                  <div className="h-2 w-full bg-slate-200 rounded-full flex overflow-hidden">
                    <div
                      className="bg-sky-500 h-full"
                      style={{ width: '20%' }}
                      title="Company Discovery Quota: 20%"
                    />
                    <div
                      className="bg-indigo-500 h-full"
                      style={{ width: '30%' }}
                      title="Signal Ingestion Quota: 30%"
                    />
                    <div
                      className="bg-purple-500 h-full"
                      style={{ width: '50%' }}
                      title="Decision-Maker & Email Quota: 50%"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-sky-500" /> Discovery ($3.00)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-indigo-500" /> Signals ($4.50)
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-purple-500" /> Contacts & Verification ($7.50)
                    </span>
                  </div>
                </div>

                {/* Step Trace Timeline */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-indigo-600" />
                    Autonomous Execution Trace ({selectedRun.steps ? selectedRun.steps.length : 0} steps)
                  </h4>

                  <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                    {selectedRun.steps && selectedRun.steps.length > 0 ? (
                      selectedRun.steps.map((step) => {
                        const isCurrentStep = selectedStep?.id === step.id;
                        return (
                          <div
                            key={step.id}
                            onClick={() => setSelectedStep(step)}
                            className={`p-3 rounded-lg border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                              isCurrentStep
                                ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-200'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                            }`}
                          >
                            <div className="flex items-start gap-2.5">
                              <div className="mt-0.5">{getStepStatusIcon(step.status)}</div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-xs font-semibold text-slate-900">
                                    Step {step.stepNumber}: {step.toolName}
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-mono">
                                    {step.durationMs}ms
                                  </span>
                                </div>
                                <p className="text-xs text-slate-600 mt-1">{step.rationale}</p>
                              </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                              <span className="text-xs font-semibold text-emerald-700 font-mono">
                                ${step.costIncurred.toFixed(3)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-xs text-slate-500 text-center py-4">No steps recorded for this run.</div>
                    )}
                  </div>
                </div>

                {/* Selected Step Inspector */}
                {selectedStep && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-indigo-600" />
                        <span className="text-xs font-semibold text-slate-900">
                          Step {selectedStep.stepNumber} Inspector: <code className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 font-mono">{selectedStep.toolName}</code>
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500 font-mono">
                        Cost: ${selectedStep.costIncurred.toFixed(4)} | {selectedStep.durationMs}ms
                      </span>
                    </div>

                    <div className="text-xs space-y-2">
                      <div>
                        <span className="text-slate-500 text-[11px] block mb-1">Execution Rationale:</span>
                        <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-200">
                          {selectedStep.rationale}
                        </p>
                      </div>

                      <div>
                        <span className="text-slate-500 text-[11px] block mb-1">Output Payload Evidence:</span>
                        <pre className="bg-white p-2.5 rounded-lg border border-slate-200 text-[10px] text-slate-800 overflow-x-auto max-h-36 font-mono">
                          {JSON.stringify(selectedStep.toolOutput, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500">
                <Bot className="w-12 h-12 text-slate-300 mb-3" />
                <h4 className="text-sm font-semibold text-slate-700">No Run Selected</h4>
                <p className="text-xs max-w-sm mt-1 text-slate-500">
                  Launch a new agentic run or select a past run from the left panel to inspect the multi-tool execution trace.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-VIEW 2: LEARNED OPTIMIZATION WEIGHTS */}
      {subView === 'weights' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                Feedback-Driven Empirical Sourcing Optimization (Workstream I)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Continuous machine learning from Phase 5 outreach engagement (replies, meetings booked, pipeline revenue) to dynamically prioritize highest-ROI data sources.
              </p>
            </div>

            <button
              onClick={handleRecomputeWeights}
              disabled={isRecomputing}
              className="py-2 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 self-start sm:self-auto"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isRecomputing ? 'animate-spin' : ''}`} />
              {isRecomputing ? 'Recomputing...' : 'Recompute from Phase 5 Data'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  <th className="p-3">Source Name</th>
                  <th className="p-3">Yield Rate</th>
                  <th className="p-3">Duplicate Rate</th>
                  <th className="p-3">Reply Rate (P5)</th>
                  <th className="p-3">Meeting Rate (P5)</th>
                  <th className="p-3">Quality Multiplier</th>
                  <th className="p-3">Attributed Pipeline</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {weights.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-slate-500">
                      No optimization weights recorded. Click "Recompute from Phase 5 Data" above.
                    </td>
                  </tr>
                ) : (
                  weights.map((w) => (
                    <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="p-3 font-semibold text-slate-900">
                        {w.sourceName || w.sourceId}
                        <span className="block text-[10px] text-slate-500 font-mono font-normal">
                          {w.sourceId}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-emerald-700 font-medium">
                        {(w.empiricalYieldRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 font-mono text-amber-700 font-medium">
                        {(w.empiricalDuplicateRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 font-mono text-sky-700 font-medium">
                        {(w.empiricalReplyRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 font-mono text-indigo-700 font-medium">
                        {(w.empiricalMeetingRate * 100).toFixed(1)}%
                      </td>
                      <td className="p-3 font-mono">
                        <span
                          className={`px-2 py-0.5 rounded font-bold ${
                            w.qualityMultiplier >= 1.2
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : w.qualityMultiplier < 0.9
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {w.qualityMultiplier.toFixed(2)}x
                        </span>
                      </td>
                      <td className="p-3 font-mono font-semibold text-emerald-700">
                        ${w.totalPipelineAttributed.toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUB-VIEW 3: A/B BENCHMARK EXPERIMENTS */}
      {subView === 'experiments' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 pb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FlaskConical className="w-4 h-4 text-indigo-600" />
                A/B Sourcing Strategy Benchmark (Workstream J)
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Direct head-to-head empirical comparison: Phase 6A Static Planning vs Phase 6B Adaptive Agentic Orchestration.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <select
                value={sampleSize}
                onChange={(e) => setSampleSize(Number(e.target.value))}
                className="bg-white border border-slate-300 text-xs text-slate-700 rounded-lg px-2.5 py-2 focus:outline-none focus:border-indigo-500"
              >
                <option value={100}>Sample: 100 Prospects</option>
                <option value={200}>Sample: 200 Prospects</option>
                <option value={500}>Sample: 500 Prospects</option>
              </select>
              <button
                onClick={handleRunExperiment}
                disabled={isRunningExp}
                className="py-2 px-3.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-xs font-semibold text-white shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${isRunningExp ? 'animate-spin' : ''}`} />
                {isRunningExp ? 'Running Benchmark...' : 'Run A/B Benchmark'}
              </button>
            </div>
          </div>

          {/* Experiments List / Latest Benchmark Card */}
          {experiments.length > 0 ? (
            <div className="space-y-6">
              {experiments.map((exp) => (
                <div
                  key={exp.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">{exp.name}</h4>
                      <p className="text-xs text-slate-500 mt-0.5">{exp.description}</p>
                    </div>
                    <span className="text-xs font-mono px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-semibold">
                      Sample Size: {exp.sampleSize}
                    </span>
                  </div>

                  {/* Comparative Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Baseline Strategy (Static Phase 6A) */}
                    <div className="p-4 bg-white rounded-xl border border-slate-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                          Strategy A: Static Phase 6A
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                          Baseline
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 text-[10px]">Qualified Yield:</span>
                          <div className="font-bold text-slate-900 font-mono">
                            {exp.baselineMetrics.yieldCount} ({exp.baselineMetrics.yieldRatePct}%)
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Total Cost:</span>
                          <div className="font-bold text-amber-700 font-mono">
                            ${exp.baselineMetrics.totalCost.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Cost / Lead:</span>
                          <div className="font-bold text-slate-700 font-mono">
                            ${exp.baselineMetrics.unitCost.toFixed(3)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Filter Efficiency:</span>
                          <div className="font-bold text-slate-700 font-mono">
                            {exp.baselineMetrics.efficiencyPct}%
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Agentic Strategy (Adaptive Phase 6B) */}
                    <div className="p-4 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-950 uppercase tracking-wide flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                          Strategy B: Adaptive Phase 6B
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold">
                          Agentic
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-slate-500 text-[10px]">Qualified Yield:</span>
                          <div className="font-bold text-emerald-700 font-mono">
                            {exp.agenticMetrics.yieldCount} ({exp.agenticMetrics.yieldRatePct}%)
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Total Cost:</span>
                          <div className="font-bold text-emerald-700 font-mono">
                            ${exp.agenticMetrics.totalCost.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Cost / Lead:</span>
                          <div className="font-bold text-emerald-700 font-mono">
                            ${exp.agenticMetrics.unitCost.toFixed(3)}
                          </div>
                        </div>
                        <div>
                          <span className="text-slate-500 text-[10px]">Filter Efficiency:</span>
                          <div className="font-bold text-indigo-800 font-mono">
                            {exp.agenticMetrics.efficiencyPct}%
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Uplift Summary Row */}
                  <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <span className="font-semibold text-emerald-900 flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      Empirical Uplift:
                    </span>
                    <span className="text-emerald-800 font-mono font-bold">
                      Yield Uplift: +{exp.upliftSummary.yieldUpliftPct}%
                    </span>
                    <span className="text-emerald-800 font-mono font-bold">
                      Cost Reduction: -{exp.upliftSummary.costReductionPct}%
                    </span>
                    <span className="text-indigo-800 font-mono font-bold">
                      Efficiency Gain: +{exp.upliftSummary.efficiencyGainPct}%
                    </span>
                    <span className="text-slate-600 text-[11px] italic">
                      ROI: {exp.upliftSummary.netRoiImprovement}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-10 text-slate-500 text-xs">
              No A/B benchmark experiments recorded yet. Click "Run A/B Benchmark" above to test static planning vs agentic orchestration.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
