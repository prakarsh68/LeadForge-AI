import React, { useState } from 'react';
import {
  Sparkles,
  Check,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  ShieldCheck,
  Globe,
  Database,
  Cpu,
  Mail,
  Zap,
  Target,
  Lock,
  Layers,
  HelpCircle,
} from 'lucide-react';
import type { ViewType } from '../../types';

interface LandingPageViewProps {
  onNavigate: (view: ViewType) => void;
}

interface PricingTier {
  id: string;
  name: string;
  badge: string;
  priceMonthly: string;
  period: string;
  isPopular?: boolean;
  description: string;
  rules: string[];
  ctaText: string;
  targetView: ViewType;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({ onNavigate }) => {
  // Track which pricing cards are expanded to reveal their full rules and inclusions
  // By default, cards only present the card with price and month details.
  const [expandedTiers, setExpandedTiers] = useState<Record<string, boolean>>({
    growth: false, // all start collapsed as requested: "just present card with price and month details, make them clickable when someone clicks all the other rules for that particular subscription"
  });

  const [selectedPlanFeedback, setSelectedPlanFeedback] = useState<string | null>(null);

  const toggleTier = (tierId: string) => {
    setExpandedTiers((prev) => ({
      ...prev,
      [tierId]: !prev[tierId],
    }));
  };

  const expandAll = () => {
    const allExpanded: Record<string, boolean> = {};
    pricingTiers.forEach((tier) => {
      allExpanded[tier.id] = true;
    });
    setExpandedTiers(allExpanded);
  };

  const collapseAll = () => {
    setExpandedTiers({});
  };

  const allAreExpanded = Object.keys(expandedTiers).length === 5 && Object.values(expandedTiers).every(Boolean);

  const pricingTiers: PricingTier[] = [
    {
      id: 'free',
      name: 'Free',
      badge: 'Get started',
      priceMonthly: '₹0',
      period: '/month',
      description: 'Best for students, freelancers and product evaluation.',
      rules: [
        '1 user and 1 ICP profile',
        'Limited Crawlee pages and candidate discovery',
        'Basic deterministic ICP scoring',
        'Limited AI research credits',
        'Dry-run mode and lead export',
        'Email drafts, no automated sending',
      ],
      ctaText: 'Get Started Free',
      targetView: 'dashboard',
    },
    {
      id: 'starter',
      name: 'Starter',
      badge: 'Individual',
      priceMonthly: '₹1,499',
      period: '/month',
      description: 'For founders and individual sales professionals.',
      rules: [
        '1 user and multiple ICP configurations',
        'Higher Crawlee and sourcing limits',
        'Source Intelligence and qualification',
        'Limited RAG research and personalized email drafts',
        'Basic outreach sequences and analytics',
        'Source provenance and CSV export',
      ],
      ctaText: 'Select Starter Plan',
      targetView: 'discovery',
    },
    {
      id: 'growth',
      name: 'Growth',
      badge: 'Recommended',
      priceMonthly: '₹4,999',
      period: '/month',
      isPopular: true,
      description: 'For startups and small sales teams.',
      rules: [
        'Up to 5 users',
        'Higher sourcing and contact-resolution allowances',
        'Agentic Sourcing and adaptive source selection',
        'More RAG research and AI personalization',
        'Three-step outreach sequences and engagement tracking',
        'HubSpot synchronization and source-performance analytics',
      ],
      ctaText: 'Start Growth Tier',
      targetView: 'discovery',
    },
    {
      id: 'scale',
      name: 'Scale',
      badge: 'Growing teams',
      priceMonthly: '₹14,999',
      period: '/month',
      description: 'For sales teams operating multiple campaigns.',
      rules: [
        'Up to 10 users',
        'Larger crawling and research allowances',
        'Advanced sourcing experiments and reporting',
        'Multiple active campaigns and configurable workflows',
        'Advanced CRM synchronization and team controls',
        'Priority support and higher execution limits',
      ],
      ctaText: 'Choose Scale Tier',
      targetView: 'pipeline',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      badge: 'Custom pricing',
      priceMonthly: 'Custom',
      period: '/month',
      description:
        'For organizations needing higher volumes, dedicated integrations, custom source policies, stronger access controls, and contractual support requirements.',
      rules: [
        'Unlimited users and dedicated Crawlee scraper clusters',
        'Custom domain discovery policies and robots.txt governance',
        'Two-way bi-directional HubSpot & Salesforce CRM sync',
        'Enterprise Knowledge Graph & proprietary document embeddings',
        'SOC2 compliance reports, SSO/SAML, and audit trails',
        'Dedicated account manager and 24/7 SLA engineering support',
      ],
      ctaText: 'Contact Enterprise Sales',
      targetView: 'settings',
    },
  ];

  const handleSelectPlan = (tier: PricingTier) => {
    setSelectedPlanFeedback(`Selected ${tier.name} Plan (${tier.priceMonthly}${tier.period}). Redirecting to ${tier.targetView}...`);
    setTimeout(() => {
      onNavigate(tier.targetView);
    }, 900);
  };

  return (
    <div className="space-y-16 pb-16 animate-in fade-in duration-300">
      {/* Toast Feedback */}
      {selectedPlanFeedback && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-xl border border-indigo-200 bg-white p-4 text-xs font-bold text-indigo-900 shadow-xl animate-in slide-in-from-top-2">
          <Zap className="h-4 w-4 text-indigo-600 animate-bounce" />
          <span>{selectedPlanFeedback}</span>
        </div>
      )}

      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-b from-white via-indigo-50/20 to-slate-50 p-6 sm:p-12 shadow-xs">
        <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-indigo-100/50 blur-3xl pointer-events-none" />
        <div className="absolute -left-20 -bottom-20 h-80 w-80 rounded-full bg-orange-100/40 blur-3xl pointer-events-none" />

        <div className="relative mx-auto max-w-4xl text-center space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/80 px-4 py-1 text-xs font-semibold text-indigo-700 shadow-2xs">
            <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
            <span>Autonomous Outbound Intelligence Engine</span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 font-[Plus_Jakarta_Sans] leading-tight">
            Stop Buying Stale Lists. <br className="hidden sm:inline" />
            <span className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-orange-500 bg-clip-text text-transparent">
              Crawl Real Public Web Data.
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm sm:text-base text-slate-600 leading-relaxed">
            LeadForge AI combines <strong className="text-slate-900">Crawlee-powered web discovery</strong>,{' '}
            <strong className="text-slate-900">deterministic ICP qualification</strong>, and{' '}
            <strong className="text-slate-900">Knowledge RAG personalization</strong> into one autonomous sales platform.
            Zero hallucinated leads, full provenance tracking, and compliant multichannel outreach.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('dashboard')}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-95 cursor-pointer"
            >
              <span>Launch Command Dashboard</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            <a
              href="#pricing"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-6 py-3 text-xs sm:text-sm font-bold text-slate-700 shadow-2xs transition-all cursor-pointer"
            >
              <span>View Business Model & Pricing</span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </a>
          </div>

          {/* Key Value Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 border-t border-slate-200/80 text-left">
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-2xs">
              <div className="flex items-center gap-2 text-indigo-600 font-bold text-xs">
                <Globe className="h-4 w-4" /> Crawlee Web Engine
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Real Cheerio web crawling from live company sites</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-2xs">
              <div className="flex items-center gap-2 text-emerald-600 font-bold text-xs">
                <ShieldCheck className="h-4 w-4" /> Deterministic ICP
              </div>
              <p className="text-[11px] text-slate-500 mt-1">100% audit-proof rules engine without LLM guessing</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-2xs">
              <div className="flex items-center gap-2 text-orange-600 font-bold text-xs">
                <Cpu className="h-4 w-4" /> Knowledge RAG
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Grounds outbound pitches in your actual collateral</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-2xs">
              <div className="flex items-center gap-2 text-purple-600 font-bold text-xs">
                <Database className="h-4 w-4" /> SQLite + HubSpot
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Persistent durable pipeline with deduplication</p>
            </div>
          </div>
        </div>
      </section>

      {/* System Architecture & Core Engine Breakdown */}
      <section className="space-y-6">
        <div className="text-center max-w-2xl mx-auto space-y-2">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <Layers className="h-3.5 w-3.5 text-slate-500" />
            Enterprise Pipeline Architecture
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-[Plus_Jakarta_Sans]">
            How LeadForge AI Generates Revenue
          </h2>
          <p className="text-xs sm:text-sm text-slate-500">
            A continuous, verifiable source-to-deal pipeline designed for reliability and zero data hallucinations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600">
              <Globe className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">1. Autonomous Web Crawling</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Using Crawlee and Cheerio, LeadForge visits permitted target domains (e.g. <code className="text-indigo-600 font-mono text-[11px]">ramp.com</code>, <code className="text-indigo-600 font-mono text-[11px]">stripe.com</code>), parsing team pages, leadership directories, and metadata with strict SSRF controls.
              </p>
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Real HTTP extraction (no mock lists)
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Full source URL and timestamp provenance
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Automatic cross-source deduplication
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-emerald-300 hover:shadow-md transition-all space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600">
              <Target className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">2. Deterministic ICP Scoring</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Candidates are scored from 0 to 100 using a strict rules-based engine. Industry match (35%), seniority (25%), company size (20%), and tech triggers (20%) are calculated mathematically without stochastic LLM variation.
              </p>
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Audit breakdown for each scored dimension
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Freshness tracking and staleness flags
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Customizable weights and fit thresholds
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs hover:border-orange-300 hover:shadow-md transition-all space-y-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 border border-orange-200 text-orange-600">
              <Mail className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">3. RAG Outreach & Pipeline</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Qualified leads enter the sales pipeline. LeadForge retrieves relevant collateral from your Knowledge Base via vector embeddings and drafts contextual 3-step sequences with human-in-the-loop approval.
              </p>
            </div>
            <ul className="text-xs text-slate-600 space-y-1.5 pt-2 border-t border-slate-100">
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Citations linked to your uploaded collateral
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Dry-run safety controls & opt-out suppression
              </li>
              <li className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" /> Direct sync to HubSpot CRM and Kanban board
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Subscription & Business Model Section */}
      <section id="pricing" className="space-y-8 scroll-mt-24">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-5">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 border border-indigo-200 px-3 py-1 text-[11px] font-bold text-indigo-700">
              <Zap className="h-3.5 w-3.5 text-indigo-600" />
              Transparent Business Model
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-[Plus_Jakarta_Sans]">
              LeadForge AI Subscription Plans
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Select the plan that matches your pipeline velocity. Click any tier card to reveal all inclusions, crawling allowances, and functional rules.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
            <button
              type="button"
              onClick={allAreExpanded ? collapseAll : expandAll}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
            >
              {allAreExpanded ? (
                <>
                  <ChevronUp className="h-3.5 w-3.5 text-slate-500" /> Collapse All Details
                </>
              ) : (
                <>
                  <ChevronDown className="h-3.5 w-3.5 text-slate-500" /> Expand All Details
                </>
              )}
            </button>
          </div>
        </div>

        {/* 5-Card Interactive Pricing Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-5 items-start">
          {pricingTiers.map((tier) => {
            const isExpanded = !!expandedTiers[tier.id];

            return (
              <div
                key={tier.id}
                onClick={() => toggleTier(tier.id)}
                className={`relative flex flex-col rounded-2xl border transition-all duration-200 cursor-pointer select-none ${
                  tier.isPopular
                    ? 'border-indigo-500 bg-white ring-2 ring-indigo-500/20 shadow-md hover:border-indigo-600 hover:shadow-lg'
                    : 'border-slate-200 bg-white shadow-xs hover:border-indigo-300 hover:shadow-md'
                }`}
              >
                {/* Popular Tier Highlight Header Badge */}
                {tier.isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-600 to-indigo-700 px-3 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-sm">
                    Most Popular
                  </div>
                )}

                {/* Always-Visible Card Summary (Price & Month Details) */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-slate-900">{tier.name}</h3>
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 mt-1">
                        {tier.badge}
                      </span>
                    </div>

                    <div
                      className={`flex h-7 w-7 items-center justify-center rounded-lg transition-colors ${
                        isExpanded ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'
                      }`}
                      title={isExpanded ? 'Collapse rules' : 'Click to view all rules'}
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </div>

                  {/* Price & Period Block */}
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-mono">
                        {tier.priceMonthly}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{tier.period}</span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {tier.id === 'free' ? 'No credit card required' : tier.id === 'enterprise' ? 'Billed annually' : 'Billed monthly in INR'}
                    </p>
                  </div>

                  {/* Click to Expand Trigger Indicator */}
                  <div className="pt-2">
                    <div
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-colors ${
                        isExpanded
                          ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                          : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      <span>{isExpanded ? 'Hide Tier Rules' : 'Click to View Rules'}</span>
                      {isExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Expandable Rules & Inclusions (Revealed on Click) */}
                {isExpanded && (
                  <div
                    className="border-t border-slate-100 p-5 bg-slate-50/70 rounded-b-2xl space-y-4 animate-in fade-in duration-200"
                    onClick={(e) => e.stopPropagation()} // allow clicks inside without immediately toggling
                  >
                    <div>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Target Audience
                      </div>
                      <p className="text-xs font-semibold text-slate-700 mt-1 leading-snug">
                        {tier.description}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Included Rules & Features
                      </div>
                      <ul className="space-y-2 text-xs text-slate-600">
                        {tier.rules.map((rule, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <span className="leading-snug">{rule}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-2 border-t border-slate-200">
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(tier)}
                        className={`w-full rounded-xl py-2 px-3 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                          tier.isPopular
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'
                            : 'bg-slate-900 text-white hover:bg-slate-800 active:scale-95'
                        }`}
                      >
                        {tier.ctaText}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature Comparison / Transparency Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                Enterprise Compliance & Sourcing Guarantees
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                All LeadForge subscriptions include strict ethical scraping governance and safety controls
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span>Full Robots.txt Compliance</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 text-xs text-slate-600">
            <div className="flex items-start gap-2.5">
              <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600 border border-indigo-100">
                <Globe className="h-4 w-4" />
              </div>
              <div>
                <strong className="text-slate-900 block">Strict Domain Whitelisting</strong>
                Crawl jobs only execute against domains explicitly configured and approved in your source profiles.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600 border border-emerald-100">
                <Target className="h-4 w-4" />
              </div>
              <div>
                <strong className="text-slate-900 block">Deterministic Audit Trails</strong>
                Every candidate score includes formula weights, extracted text evidence, and timestamped provenance.
              </div>
            </div>
            <div className="flex items-start gap-2.5">
              <div className="rounded-lg bg-orange-50 p-2 text-orange-600 border border-orange-100">
                <Lock className="h-4 w-4" />
              </div>
              <div>
                <strong className="text-slate-900 block">Suppression & Opt-Out</strong>
                Outreach engine blocks restricted domains, blacklisted contacts, and respects unsubscribe requests.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Frequently Asked Questions */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1.5">
          <div className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
            <HelpCircle className="h-3.5 w-3.5 text-slate-500" /> FAQ
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 font-[Plus_Jakarta_Sans]">
            Frequently Asked Questions
          </h2>
          <p className="text-xs text-slate-500">
            Answers to common questions about Crawlee integration, subscription tiers, and lead generation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
            <h4 className="text-xs font-bold text-slate-900">How does Crawlee extract public leads?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Crawlee executes headless HTTP requests using Cheerio against target company websites (such as about, leadership, and team pages). It securely extracts structured contact names, titles, and public email formats while enforcing concurrency and robots.txt rules.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
            <h4 className="text-xs font-bold text-slate-900">Are leads fabricated or generated with mock data?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              No. LeadForge AI runs real Crawlee workers and stores candidates in persistent SQLite tables. Staged candidates display exact source URLs, timestamps, and confidence ratings before being ingested into your CRM pipeline.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
            <h4 className="text-xs font-bold text-slate-900">Can I upgrade or downgrade tiers anytime?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Yes. All paid tiers (Starter, Growth, Scale) can be switched seamlessly. Upgrading increases your crawling allowances, concurrent jobs, and RAG knowledge document limits immediately.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-2xs space-y-1.5">
            <h4 className="text-xs font-bold text-slate-900">Does LeadForge integrate with our existing CRM?</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Yes. Qualified leads and pipeline opportunities synchronize directly with HubSpot CRM. You can also export leads to CSV or push deals into the built-in LeadForge Kanban pipeline.
            </p>
          </div>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="rounded-3xl border border-indigo-200 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-8 sm:p-12 text-white text-center space-y-5 shadow-lg">
        <div className="max-w-2xl mx-auto space-y-3">
          <span className="rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-indigo-200 border border-white/20">
            Autonomous Pipeline Ready
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight font-[Plus_Jakarta_Sans]">
            Ready to Supercharge Your Outbound Pipeline?
          </h2>
          <p className="text-xs sm:text-sm text-indigo-200 leading-relaxed">
            Experience real web crawling, deterministic ICP scoring, and AI-grounded outreach. Start for free or test our live discovery engine.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => onNavigate('dashboard')}
            className="inline-flex items-center gap-2 rounded-xl bg-white hover:bg-slate-100 px-6 py-3 text-xs sm:text-sm font-bold text-indigo-950 shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
          >
            <span>Open Command Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onNavigate('discovery')}
            className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 px-6 py-3 text-xs sm:text-sm font-bold text-white transition-all cursor-pointer"
          >
            <Globe className="h-4 w-4" />
            <span>Test Discovery Engine</span>
          </button>
        </div>
      </section>
    </div>
  );
};
