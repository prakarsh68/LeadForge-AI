import React, { useState } from 'react';
import { defaultIcpProfile } from '../../data/mockData';
import type { IcpProfile } from '../../types';
import {
  Target,
  Save,
  Plus,
  X,
  Sliders,
  Building2,
  Users,
  Zap,
  ShieldAlert,
  Globe,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';


interface IcpSetupViewProps {
  initialProfile?: IcpProfile;
  onSaveProfile?: (profile: IcpProfile) => void;
}

export const IcpSetupView: React.FC<IcpSetupViewProps> = ({
  initialProfile = defaultIcpProfile,
  onSaveProfile,
}) => {
  const [profile, setProfile] = useState<IcpProfile>(initialProfile);
  const [activeTab, setActiveTab] = useState<'profile' | 'triggers' | 'scoring'>('profile');
  const [saveSuccess, setSaveSuccess] = useState(false);


  // New tag states
  const [newIndustry, setNewIndustry] = useState('');
  const [newRole, setNewRole] = useState('');
  const [newTrigger, setNewTrigger] = useState('');
  const [newNegative, setNewNegative] = useState('');
  const [newTech, setNewTech] = useState('');

  // Weight sliders state
  const [weights, setWeights] = useState({
    industry: 30,
    roleSeniority: 25,
    intentTriggers: 30,
    techStack: 15,
  });

  const handleAddTag = (
    field: keyof Pick<
      IcpProfile,
      'targetIndustries' | 'targetRoles' | 'buyingTriggers' | 'negativeKeywords' | 'techStack'
    >,
    value: string,
    clearInput: () => void
  ) => {
    if (!value.trim()) return;
    if (profile[field].includes(value.trim())) return;
    setProfile({
      ...profile,
      [field]: [...profile[field], value.trim()],
    });
    clearInput();
  };

  const handleRemoveTag = (
    field: keyof Pick<
      IcpProfile,
      'targetIndustries' | 'targetRoles' | 'buyingTriggers' | 'negativeKeywords' | 'techStack'
    >,
    index: number
  ) => {
    const updated = [...profile[field]];
    updated.splice(index, 1);
    setProfile({ ...profile, [field]: updated });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveProfile?.(profile);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3500);
  };

  const handleApplyPreset = (presetName: string) => {
    let preset: IcpProfile;
    if (presetName === 'fintech') {
      preset = {
        ...defaultIcpProfile,
        name: 'Enterprise FinTech & Payments ICP',
        description: 'Global financial infrastructure, neo-banks, and compliance-first payments platforms.',
        targetIndustries: ['FinTech & Payments', 'Banking Infrastructure', 'RegTech & Compliance'],
        minScoreThreshold: 82,
      };
    } else if (presetName === 'ai') {
      preset = {
        ...defaultIcpProfile,
        name: 'High-Velocity AI & ML Startups',
        description: 'Venture-backed Series Seed to Series B AI infrastructure and application companies.',
        targetIndustries: ['AI & Data Analytics', 'Developer Tooling', 'Enterprise Software & Cloud'],
        companySizeRanges: ['20 - 50', '50 - 100', '100 - 250'],
        minScoreThreshold: 75,
      };
    } else {
      preset = defaultIcpProfile;
    }
    setProfile(preset);
    onSaveProfile?.(preset);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };


  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header with Preset Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600 border border-orange-200">
              <Target className="h-4 w-4" />
            </div>
            <h2 className="text-lg font-bold text-slate-900">Ideal Customer Profile Engine</h2>
            <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800 border border-emerald-200">
              Live Scoring Model
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Define precise firmographic constraints, role hierarchies, and real-time triggers to feed autonomous discovery.
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-2 self-start md:self-auto">
          <span className="text-xs font-medium text-slate-500">Presets:</span>
          <button
            type="button"
            onClick={() => handleApplyPreset('saas')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            B2B SaaS
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('fintech')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            FinTech
          </button>
          <button
            type="button"
            onClick={() => handleApplyPreset('ai')}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            AI Startups
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'profile'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-4 w-4" />
            1. Firmographics & Roles
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('triggers')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'triggers'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Zap className="h-4 w-4" />
            2. Triggers & Tech Stack
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scoring')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'scoring'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <Sliders className="h-4 w-4" />
            3. AI Scoring Weights & Thresholds
          </button>
        </div>

        {/* Tab 1: Firmographics & Personas */}
        {activeTab === 'profile' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
            {/* Left 2 Cols: Form Fields */}
            <div className="lg:col-span-2 space-y-6">
              {/* Profile Meta Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-indigo-600" />
                  ICP Profile Overview
                </h3>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Profile Name
                    </label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Target Thesis / Description
                    </label>
                    <textarea
                      rows={2}
                      value={profile.description}
                      onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Target Industries */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900">Target Industries</h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {profile.targetIndustries.length} Selected
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {profile.targetIndustries.map((industry, index) => (
                    <span
                      key={industry}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-800"
                    >
                      {industry}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag('targetIndustries', index)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add target industry (e.g., EdTech, Logistics, DevOps)..."
                    value={newIndustry}
                    onChange={(e) => setNewIndustry(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag('targetIndustries', newIndustry, () => setNewIndustry(''));
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleAddTag('targetIndustries', newIndustry, () => setNewIndustry(''))
                    }
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Target Roles & Seniorities */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Users className="h-4 w-4 text-indigo-600" />
                    Target Decision-Maker Titles
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    {profile.targetRoles.length} Titles
                  </span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {profile.targetRoles.map((role, index) => (
                    <span
                      key={role}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-800"
                    >
                      {role}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag('targetRoles', index)}
                        className="text-purple-600 hover:text-purple-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Add target title (e.g., Head of Outbound, CRO, VP Growth)..."
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag('targetRoles', newRole, () => setNewRole(''));
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <button
                    type="button"
                    onClick={() => handleAddTag('targetRoles', newRole, () => setNewRole(''))}
                    className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Right Col: Scope Summary Card */}
            <div className="space-y-6">
              <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-indigo-100">
                  <span className="text-xs font-bold text-indigo-950 uppercase tracking-wider">
                    Addressable Market Preview
                  </span>
                  <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>

                <div>
                  <div className="text-3xl font-extrabold text-slate-900 font-mono">
                    ~4,200 <span className="text-xs text-slate-500 font-normal font-sans">Accounts</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    Estimated verified high-growth companies matching criteria in US/EU.
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-indigo-100 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Locations:</span>
                    <span className="text-slate-900 font-semibold">US, CA, UK, EU</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Company Size:</span>
                    <span className="text-slate-900 font-semibold">50 - 1,000 employees</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Annual Revenue:</span>
                    <span className="text-slate-900 font-semibold">$5M - $50M+ ARR</span>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 shadow-2xs">
                  <p className="font-semibold flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                    Optimal Density
                  </p>
                  <p className="mt-0.5 text-[11px] text-emerald-800">
                    Criteria has sufficient volume for 250+ weekly autonomous touches without exhausting pool.
                  </p>
                </div>
              </div>

              {/* Negative Disqualification List */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3 shadow-xs">
                <h3 className="text-xs font-bold text-rose-700 flex items-center gap-2 uppercase tracking-wider">
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                  Disqualification Constraints
                </h3>
                <p className="text-[11px] text-slate-500">
                  Accounts matching these tags are automatically dropped by the agent.
                </p>

                <div className="flex flex-wrap gap-1.5">
                  {profile.negativeKeywords.map((neg, index) => (
                    <span
                      key={neg}
                      className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-800"
                    >
                      {neg}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag('negativeKeywords', index)}
                        className="text-rose-600 hover:text-rose-900"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Exclude criteria (e.g. Non-profits)..."
                    value={newNegative}
                    onChange={(e) => setNewNegative(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag('negativeKeywords', newNegative, () => setNewNegative(''));
                      }
                    }}
                    className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-rose-500 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      handleAddTag('negativeKeywords', newNegative, () => setNewNegative(''))
                    }
                    className="rounded-xl border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Triggers & Tech Stack */}
        {activeTab === 'triggers' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in fade-in duration-200">
            {/* Buying Triggers */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-amber-500" />
                    Buying Triggers & Intent Signals
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Autonomous agent scans for these public signals before initiating outreach
                  </p>
                </div>
                <span className="text-xs text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded font-semibold font-mono">
                  {profile.buyingTriggers.length} Active
                </span>
              </div>

              <div className="space-y-2">
                {profile.buyingTriggers.map((trig, index) => (
                  <div
                    key={trig}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      <span className="font-semibold text-slate-800">{trig}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag('buyingTriggers', index)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Add trigger (e.g. IPO readiness, Key leadership hire, New office opened)..."
                  value={newTrigger}
                  onChange={(e) => setNewTrigger(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag('buyingTriggers', newTrigger, () => setNewTrigger(''));
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag('buyingTriggers', newTrigger, () => setNewTrigger(''))}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Tech Stack Requirements */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Globe className="h-4 w-4 text-sky-600" />
                    Required / Preferred Tech Stack
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Scraped via job postings, DNS signatures, and BuiltWith data
                  </p>
                </div>
                <span className="text-xs text-sky-800 bg-sky-50 border border-sky-200 px-2 py-0.5 rounded font-semibold font-mono">
                  {profile.techStack.length} Technologies
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {profile.techStack.map((tech, index) => (
                  <span
                    key={tech}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800"
                  >
                    {tech}
                    <button
                      type="button"
                      onClick={() => handleRemoveTag('techStack', index)}
                      className="text-sky-600 hover:text-sky-900"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  placeholder="Add technology (e.g. Stripe, AWS, Marketo, Datadog)..."
                  value={newTech}
                  onChange={(e) => setNewTech(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddTag('techStack', newTech, () => setNewTech(''));
                    }
                  }}
                  className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleAddTag('techStack', newTech, () => setNewTech(''))}
                  className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Scoring Weights & Thresholds */}
        {activeTab === 'scoring' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
            <div className="lg:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 space-y-6 shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Sliders className="h-4 w-4 text-indigo-600" />
                  Scoring Algorithm Weight Allocation
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  LeadForge computes a composite 0-100 fit score by calculating weighted dot products across these dimensions.
                </p>
              </div>

              {/* Sliders */}
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-semibold pb-1">
                    <span className="text-slate-700">Target Industry & Firmographics</span>
                    <span className="text-indigo-600 font-mono">{weights.industry}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={weights.industry}
                    onChange={(e) =>
                      setWeights({ ...weights, industry: parseInt(e.target.value) })
                    }
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold pb-1">
                    <span className="text-slate-700">Decision-Maker Seniority & Title Match</span>
                    <span className="text-purple-600 font-mono">{weights.roleSeniority}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={weights.roleSeniority}
                    onChange={(e) =>
                      setWeights({ ...weights, roleSeniority: parseInt(e.target.value) })
                    }
                    className="w-full accent-purple-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold pb-1">
                    <span className="text-slate-700">Real-Time Intent & Buying Triggers</span>
                    <span className="text-amber-600 font-mono">{weights.intentTriggers}%</span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="50"
                    value={weights.intentTriggers}
                    onChange={(e) =>
                      setWeights({ ...weights, intentTriggers: parseInt(e.target.value) })
                    }
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs font-semibold pb-1">
                    <span className="text-slate-700">Tech Stack & Ecosystem Signals</span>
                    <span className="text-sky-600 font-mono">{weights.techStack}%</span>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="30"
                    value={weights.techStack}
                    onChange={(e) =>
                      setWeights({ ...weights, techStack: parseInt(e.target.value) })
                    }
                    className="w-full accent-sky-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>

            {/* Minimum Fit Threshold */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-5 flex flex-col justify-between shadow-xs">
              <div>
                <h3 className="text-sm font-bold text-slate-900 pb-3 border-b border-slate-200">
                  Minimum Score Cutoff
                </h3>
                <p className="mt-2 text-xs text-slate-500">
                  Only prospects scoring equal to or above this value will be automatically pushed into the outreach pipeline.
                </p>

                <div className="mt-6 text-center">
                  <div className="text-5xl font-black text-emerald-700 font-mono tracking-tight">
                    {profile.minScoreThreshold}
                  </div>
                  <p className="mt-1 text-xs text-slate-500 font-medium">Minimum Fit Score / 100</p>
                </div>

                <div className="mt-6">
                  <input
                    type="range"
                    min="60"
                    max="95"
                    value={profile.minScoreThreshold}
                    onChange={(e) =>
                      setProfile({
                        ...profile,
                        minScoreThreshold: parseInt(e.target.value),
                      })
                    }
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1 font-mono font-medium">
                    <span>60 (Permissive)</span>
                    <span>95 (Strict Elite)</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 shadow-2xs">
                <span className="text-indigo-700 font-semibold">Automatic Filtering:</span>
                <p className="mt-0.5 text-[11px]">
                  Leads scoring below {profile.minScoreThreshold} are marked as Low Match and stored for future re-evaluation.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Footer Action Bar */}
        <div className="sticky bottom-4 z-20 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 hidden sm:inline font-medium">
              Configuration ready for autonomous synchronization
            </span>
            {saveSuccess && (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 animate-in fade-in">
                <CheckCircle2 className="h-3.5 w-3.5" />
                ICP Profile updated & re-indexed!
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleApplyPreset('saas')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Defaults
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-5 py-2 text-xs font-bold text-white shadow-sm transition-all active:scale-95"
            >
              <Save className="h-4 w-4" />
              Save & Apply ICP
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
