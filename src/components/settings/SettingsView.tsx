import React, { useState, useEffect } from 'react';
import type { CrawlSourceProfile, DiscoveryProviderStatus } from '../../types';
import { api, ApiError } from '../../services/api';
import {
  Settings,
  Globe,
  ShieldCheck,
  Plus,
  Trash2,
  RefreshCw,
  Play,
  Key,
  Cpu,
  Sliders,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
} from 'lucide-react';

interface SettingsViewProps {
  onNavigateToDiscovery?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onNavigateToDiscovery }) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'connectors' | 'preferences'>('sources');
  const [profiles, setProfiles] = useState<CrawlSourceProfile[]>([]);
  const [providers, setProviders] = useState<DiscoveryProviderStatus[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New Profile Modal / Form State
  const [isCreatingProfile, setIsCreatingProfile] = useState<boolean>(false);
  const [newProfileName, setNewProfileName] = useState<string>('');
  const [newProfileDesc, setNewProfileDesc] = useState<string>('');
  const [newProfileStartUrls, setNewProfileStartUrls] = useState<string>('https://stripe.com\nhttps://ramp.com');
  const [newProfileAllowedDomains, setNewProfileAllowedDomains] = useState<string>('stripe.com\nramp.com');
  const [newProfileMaxPages, setNewProfileMaxPages] = useState<number>(20);
  const [newProfileCrawlDepth, setNewProfileCrawlDepth] = useState<number>(2);
  const [newProfileConcurrency, setNewProfileConcurrency] = useState<number>(2);
  const [newProfileDelayMs, setNewProfileDelayMs] = useState<number>(500);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Dry-Run Testing State
  const [testingProfileId, setTestingProfileId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any | null>(null);

  const showFeedback = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(null), 3500);
  };

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [profilesData, providersData] = await Promise.all([
        api.getCrawlProfiles().catch(() => []),
        api.getDiscoveryProviders().catch(() => []),
      ]);
      setProfiles(profilesData);
      setProviders(providersData);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to load settings configuration.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    Promise.all([
      api.getCrawlProfiles().catch(() => []),
      api.getDiscoveryProviders().catch(() => []),
    ]).then(([profilesData, providersData]) => {
      if (isMounted) {
        setProfiles(profilesData);
        setProviders(providersData);
        setIsLoading(false);
      }
    }).catch((err) => {
      if (isMounted) {
        setError(err instanceof ApiError ? err.message : 'Failed to load settings configuration.');
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProfileName.trim()) {
      setError('Profile name is required.');
      return;
    }

    const startUrls = newProfileStartUrls
      .split('\n')
      .map((u) => u.trim())
      .filter(Boolean);
    const allowedDomains = newProfileAllowedDomains
      .split('\n')
      .map((d) => d.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, ''))
      .filter(Boolean);

    if (startUrls.length === 0) {
      setError('At least one starting URL is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await api.saveCrawlProfile({
        name: newProfileName.trim(),
        description: newProfileDesc.trim() || undefined,
        startUrls,
        allowedDomains: allowedDomains.length > 0 ? allowedDomains : undefined,
        maxPages: newProfileMaxPages,
        crawlDepth: newProfileCrawlDepth,
        concurrency: newProfileConcurrency,
        delayMs: newProfileDelayMs,
        isActive: true,
      });

      setProfiles((prev) => [created, ...prev.filter((p) => p.id !== created.id)]);
      setIsCreatingProfile(false);
      setNewProfileName('');
      setNewProfileDesc('');
      showFeedback(`Source profile "${created.name}" created successfully.`);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to save crawl profile.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProfile = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete profile "${name}"?`)) return;
    try {
      await api.deleteCrawlProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      showFeedback(`Profile "${name}" removed.`);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete profile.');
    }
  };

  const handleTestDryRun = async (profile: CrawlSourceProfile) => {
    setTestingProfileId(profile.id);
    setTestResult(null);
    setError(null);
    try {
      const targetDomain = profile.allowedDomains[0] || 'stripe.com';
      const result = await api.runCrawleeDryRun({
        domain: targetDomain,
        profileId: profile.id,
        maxPages: profile.maxPages,
        crawlDepth: profile.crawlDepth,
      });
      setTestResult(result);
      showFeedback(`Dry-run verification completed for ${targetDomain}.`);
    } catch (err: any) {
      setError(err instanceof ApiError ? err.message : 'Dry-run testing failed.');
    } finally {
      setTestingProfileId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-xs">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-[Plus_Jakarta_Sans]">
                Platform Settings & Connectors
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                Configuration
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Manage Crawlee public source profiles, external API connectors, rate limits, and platform safety controls.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onNavigateToDiscovery && (
            <button
              onClick={onNavigateToDiscovery}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 hover:border-indigo-200 transition-colors shadow-2xs cursor-pointer"
            >
              <Globe className="h-3.5 w-3.5 text-indigo-600" />
              Discovery Engine
            </button>
          )}
          <button
            onClick={loadData}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-2xs cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Notifications */}
      {notice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-800 shadow-xs">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800 shadow-xs">
          <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Section Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('sources')}
          className={`flex items-center gap-2 pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'sources'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Globe className="h-4 w-4" />
          Crawl Source Profiles
          <span className="rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 text-[10px] font-bold">
            {profiles.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('connectors')}
          className={`flex items-center gap-2 pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'connectors'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Key className="h-4 w-4" />
          Connector Health & APIs
          <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-bold">
            {providers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex items-center gap-2 pb-3 text-xs font-semibold border-b-2 transition-colors cursor-pointer ${
            activeTab === 'preferences'
              ? 'border-indigo-600 text-indigo-700'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Integrations & Safety Guardrails
        </button>
      </div>

      {/* TAB 1: CRAWL SOURCE PROFILES */}
      {activeTab === 'sources' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Configured Crawl Source Profiles</h2>
              <p className="text-xs text-slate-500">
                Permitted domains and seed URLs crawled by Crawlee with bounded depth, politeness delays, and SSRF boundary safeguards.
              </p>
            </div>
            <button
              onClick={() => setIsCreatingProfile(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Source Profile
            </button>
          </div>

          {/* Create Modal / Slide-out */}
          {isCreatingProfile && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-5 shadow-xs space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-indigo-100 pb-3">
                <div className="flex items-center gap-2 text-sm font-bold text-indigo-950">
                  <Globe className="h-4 w-4 text-indigo-600" />
                  Define New Crawl Source Profile
                </div>
                <button
                  onClick={() => setIsCreatingProfile(false)}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Cancel
                </button>
              </div>

              <form onSubmit={handleCreateProfile} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Profile Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Modern B2B FinTech Catalog"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Permitted websites for financial technology vendors"
                      value={newProfileDesc}
                      onChange={(e) => setNewProfileDesc(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Seed Starting URLs (one per line) *
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={newProfileStartUrls}
                      onChange={(e) => setNewProfileStartUrls(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Allowed Domain Boundaries (one per line)
                    </label>
                    <textarea
                      rows={3}
                      value={newProfileAllowedDomains}
                      onChange={(e) => setNewProfileAllowedDomains(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-3 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Max Pages (1-100)</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={newProfileMaxPages}
                      onChange={(e) => setNewProfileMaxPages(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Depth Limit (1-3)</label>
                    <input
                      type="number"
                      min={1}
                      max={3}
                      value={newProfileCrawlDepth}
                      onChange={(e) => setNewProfileCrawlDepth(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Concurrency (1-4)</label>
                    <input
                      type="number"
                      min={1}
                      max={4}
                      value={newProfileConcurrency}
                      onChange={(e) => setNewProfileConcurrency(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-600">Delay (ms)</label>
                    <input
                      type="number"
                      min={200}
                      max={5000}
                      step={100}
                      value={newProfileDelayMs}
                      onChange={(e) => setNewProfileDelayMs(Number(e.target.value))}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingProfile(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Profile'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Test Dry Run Result Preview */}
          {testResult && (
            <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-4 text-xs space-y-2 animate-in fade-in">
              <div className="flex items-center justify-between">
                <span className="font-bold text-sky-900 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-sky-600" />
                  Dry-Run Simulation Output: {testResult.targetDomain}
                </span>
                <button
                  onClick={() => setTestResult(null)}
                  className="text-sky-700 hover:text-sky-950 font-bold"
                >
                  Close
                </button>
              </div>
              <p className="text-sky-800">{testResult.notes}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
                <div className="rounded-lg bg-white p-2 border border-sky-200 text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Projected Pages</div>
                  <div className="font-bold text-slate-900 text-sm">{testResult.projectedPlan.estimatedPages}</div>
                </div>
                <div className="rounded-lg bg-white p-2 border border-sky-200 text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Signals Estimated</div>
                  <div className="font-bold text-indigo-600 text-sm">{testResult.projectedPlan.estimatedSignals}</div>
                </div>
                <div className="rounded-lg bg-white p-2 border border-sky-200 text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Contacts Estimated</div>
                  <div className="font-bold text-emerald-700 text-sm">{testResult.projectedPlan.estimatedCandidates}</div>
                </div>
                <div className="rounded-lg bg-white p-2 border border-sky-200 text-center">
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Credit Cost</div>
                  <div className="font-bold text-slate-900 text-sm">0 (Free)</div>
                </div>
              </div>
            </div>
          )}

          {/* Profiles Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className="rounded-2xl border border-slate-200 bg-white p-4.5 shadow-2xs space-y-3 hover:border-slate-300 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 text-sm">{profile.name}</h3>
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{profile.description}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        title="Delete profile"
                        onClick={() => handleDeleteProfile(profile.id, profile.name)}
                        className="rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <span className="font-semibold text-slate-600 block text-[11px]">Start URLs:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {profile.startUrls.map((u, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded bg-slate-50 px-2 py-0.5 text-[11px] font-mono text-slate-700 border border-slate-200"
                          >
                            <ExternalLink className="h-2.5 w-2.5 text-slate-400" />
                            {u.replace(/^https?:\/\//, '').slice(0, 28)}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <span className="font-semibold text-slate-600 block text-[11px]">Permitted Scope:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {profile.allowedDomains.map((d, i) => (
                          <span
                            key={i}
                            className="rounded bg-indigo-50/60 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200/60"
                          >
                            *.{d}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
                  <div className="flex items-center gap-3">
                    <span>Max {profile.maxPages} pgs</span>
                    <span>Depth: {profile.crawlDepth}</span>
                    <span>Delay: {profile.delayMs}ms</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleTestDryRun(profile)}
                      disabled={testingProfileId === profile.id}
                      className="inline-flex items-center gap-1 font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                    >
                      <Play className="h-3 w-3" />
                      {testingProfileId === profile.id ? 'Simulating...' : 'Dry-Run Test'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: CONNECTOR HEALTH & APIS */}
      {activeTab === 'connectors' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Registered Sourcing Connectors</h2>
            <div className="divide-y divide-slate-100">
              {providers.map((p) => (
                <div key={p.id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 border border-slate-200 text-slate-700 font-bold text-sm">
                      {p.id === 'crawlee_web' ? 'CW' : p.id === 'hunter' ? 'H' : 'LF'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">{p.displayName}</span>
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                          {p.mode} mode
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{p.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.capabilities.map((cap, i) => (
                          <span
                            key={i}
                            className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                          >
                            {cap.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 sm:self-center">
                    {p.isConfigured ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                        Online & Ready
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
                        Requires Configuration
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: INTEGRATIONS & SAFETY */}
      {activeTab === 'preferences' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Cpu className="h-4 w-4 text-indigo-600" />
              AI Intelligence Model
            </div>
            <p className="text-xs text-slate-500">
              Configured LLM inference for Knowledge Base RAG citations, campaign intent parsing, and outreach sequences.
            </p>
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-600">Active Provider</span>
                <span className="font-semibold text-slate-900">OpenAI Compatible (Local/Remote)</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Model Name</span>
                <span className="font-semibold text-slate-900">gemini-2.5-flash / gpt-4o-mini</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Semantic Embeddings</span>
                <span className="font-semibold text-slate-900">text-embedding-3-small</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-2xs space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Data Safety & Ingestion Guardrails
            </div>
            <p className="text-xs text-slate-500">
              Deterministic safeguards to prevent duplicate outreach, unwanted domain crawls, and unauthorized syncs.
            </p>
            <div className="space-y-2 text-xs">
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" defaultChecked disabled className="rounded text-indigo-600" />
                <span>Strict SSRF protection on all crawler seed URLs</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" defaultChecked disabled className="rounded text-indigo-600" />
                <span>Deterministic duplicate email rejection before CRM ingestion</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" defaultChecked disabled className="rounded text-indigo-600" />
                <span>Human review approval required before email sequence sending</span>
              </label>
              <label className="flex items-center gap-2 text-slate-700">
                <input type="checkbox" defaultChecked disabled className="rounded text-indigo-600" />
                <span>Preserve field-level provenance and source URL citations</span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
