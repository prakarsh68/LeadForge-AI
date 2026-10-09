import React from 'react';
import { KpiCard } from './KpiCard';
import { DiscoveryChart } from './DiscoveryChart';
import { TierDistributionChart } from './TierDistributionChart';
import { RecentActivity } from './RecentActivity';
import type { ViewType, Lead, IcpProfile, ActivityItem, KpiMetric, PipelineSummary } from '../../types';
import {
  Sparkles,
  ArrowRight,
  Target,
  Users,
  Kanban,
  BookOpen,
  Building,
  ExternalLink,
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (view: ViewType) => void;
  onSelectLead: (lead: Lead) => void;
  leads?: Lead[];
  icpProfile?: IcpProfile;
  activities?: ActivityItem[];
  pipelineSummary?: PipelineSummary | null;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onNavigate,
  onSelectLead,
  leads = [],
  icpProfile,
  activities = [],
  pipelineSummary,
}) => {
  // Dynamic calculation of KPIs
  const totalLeadsCount = leads.length;
  const minThreshold = icpProfile?.minScoreThreshold ?? 78;
  const highFitCount = leads.filter((l) => l.score >= minThreshold).length;
  const highFitPercent = totalLeadsCount > 0 ? Math.round((highFitCount / totalLeadsCount) * 100) : 0;

  const activePipelineValue = pipelineSummary
    ? pipelineSummary.totalPipelineValue
    : leads
        .filter((l) => l.status !== 'Disqualified')
        .reduce((sum, l) => sum + l.dealValue, 0);

  const convertedCount = leads.filter(
    (l) => l.status === 'Won' || l.status === 'Proposal' || l.status === 'Qualified'
  ).length;
  const conversionRate = pipelineSummary
    ? `${pipelineSummary.winRate}%`
    : `${totalLeadsCount > 0 ? ((convertedCount / totalLeadsCount) * 100).toFixed(1) : '0.0'}%`;

  const totalOppsCount = pipelineSummary ? pipelineSummary.totalOpportunities : leads.filter((l) => l.status !== 'Disqualified').length;

  const dynamicKpis: KpiMetric[] = [
    {
      id: 'kpi-1',
      title: 'Discovered Leads',
      value: totalLeadsCount.toLocaleString(),
      change: '+18.4%',
      trend: 'up',
      subtitle: `${leads.filter((l) => l.status === 'New').length} new in discovery queue`,
    },
    {
      id: 'kpi-2',
      title: `High-Fit Matches (${minThreshold}+)`,
      value: highFitCount.toString(),
      change: `+${highFitPercent}%`,
      trend: 'up',
      subtitle: `${highFitPercent}% meet active ICP criteria`,
    },
    {
      id: 'kpi-3',
      title: 'Active Pipeline Value',
      value: `$${activePipelineValue.toLocaleString()}`,
      change: '+12.8%',
      trend: 'up',
      subtitle: `${totalOppsCount} active opportunities`,
    },
    {
      id: 'kpi-4',
      title: 'Pipeline Win Rate',
      value: conversionRate,
      change: '+4.1%',
      trend: 'up',
      subtitle: `${convertedCount} closed or active proposals`,
    },
    {
      id: 'kpi-5',
      title: 'Backend Sync Status',
      value: 'Live',
      change: 'Synced',
      trend: 'neutral',
      subtitle: 'SQLite WAL mode operational',
    },
  ];

  // Top 3 high match leads from actual leads array
  const topLeads = [...leads]
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Hero Welcome Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-950/70 via-slate-900/90 to-purple-950/50 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        {/* Glow orbs in background */}
        <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-indigo-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-64 w-64 rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-300 mb-3">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" />
              Autonomous Lead Engine Online
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white font-[Plus_Jakarta_Sans]">
              Good morning! <span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">LeadForge</span> identified {highFitCount} high-intent leads today.
            </h2>
            <p className="mt-2 text-sm text-slate-300 leading-relaxed">
              Targeting <span className="text-white font-medium">{icpProfile?.name || 'B2B SaaS Growth & Enterprise'}</span>. 
              Average ICP fit score threshold is <strong className="text-emerald-400">{minThreshold}+ Score</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('icp')}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-all shadow-sm active:scale-95"
            >
              <Target className="h-4 w-4 text-indigo-400" />
              Tweak ICP Parameters
            </button>
            <button
              onClick={() => onNavigate('leads')}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 px-4 py-2.5 text-xs font-semibold text-white shadow-lg shadow-indigo-600/30 transition-all active:scale-95"
            >
              <Users className="h-4 w-4 text-white" />
              Review {leads.length} Discovered Leads
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {dynamicKpis.map((kpi) => (
          <KpiCard key={kpi.id} metric={kpi} />
        ))}
      </div>

      {/* Main Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <DiscoveryChart />
        </div>
        <div>
          <TierDistributionChart leads={leads} />
        </div>
      </div>

      {/* Spotlight: High Priority Leads Preview */}
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/60 gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-400" />
              Top Priority High-Fit Prospects
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Top prospects exceeding ICP match score with active buying triggers ready for outreach
            </p>
          </div>
          <button
            onClick={() => onNavigate('leads')}
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors self-start sm:self-auto"
          >
            Explore all {leads.length} leads <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {topLeads.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No prospects found. Run a discovery scan or adjust ICP criteria.
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {topLeads.map((lead) => (
              <div
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className="group cursor-pointer rounded-xl border border-slate-800/80 bg-slate-950/60 p-4 transition-all hover:border-indigo-500/50 hover:bg-slate-900/80 hover:shadow-lg hover:shadow-indigo-500/10 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={lead.avatar}
                        alt={lead.name}
                        className="h-10 w-10 rounded-full object-cover border border-slate-700"
                      />
                      <div>
                        <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                          {lead.name}
                        </h4>
                        <p className="text-xs text-slate-400 line-clamp-1">{lead.title}</p>
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <span className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-extrabold text-emerald-400 font-mono">
                        {lead.score}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">ICP Fit</span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-300">
                    <Building className="h-3.5 w-3.5 text-slate-400" />
                    <span className="font-semibold text-slate-200">{lead.company}</span>
                    <span className="text-slate-400">•</span>
                    <span className="text-slate-400">{lead.companySize} emp</span>
                  </div>

                  {/* Primary Trigger Badge */}
                  <div className="mt-3">
                    <span className="inline-block rounded-md bg-indigo-950/60 border border-indigo-500/30 px-2 py-1 text-[11px] text-indigo-300 font-medium truncate max-w-full">
                      ⚡ {lead.triggers?.[0] || 'High buying intent signal'}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="font-bold text-emerald-400 font-mono">
                    ${lead.dealValue.toLocaleString()} ARR
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-indigo-400 group-hover:translate-x-0.5 transition-transform">
                    View Profile <ExternalLink className="h-3 w-3" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Autonomous Stream & Quick Nav */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivity onNavigate={onNavigate} activities={activities} />
        </div>

        {/* Quick Workflow Cards */}
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
          <div>
            <h3 className="text-base font-bold text-white pb-3 border-b border-slate-800/60">
              Autonomous Modules
            </h3>
            <p className="mt-2 text-xs text-slate-400">
              Jump straight into active pipelines and knowledge configuration:
            </p>

            <div className="mt-4 space-y-2.5">
              <button
                onClick={() => onNavigate('pipeline')}
                className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 hover:border-slate-700 hover:bg-slate-800/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                    <Kanban className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                      Sales Pipeline Kanban
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      5 active stages • ${activePipelineValue.toLocaleString()} value
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
              </button>

              <button
                onClick={() => onNavigate('knowledge')}
                className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 hover:border-slate-700 hover:bg-slate-800/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
                    <BookOpen className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-emerald-300 transition-colors">
                      Knowledge Base
                    </h4>
                    <p className="text-[11px] text-slate-400">Collateral and context docs</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
              </button>

              <button
                onClick={() => onNavigate('icp')}
                className="w-full flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-3 hover:border-slate-700 hover:bg-slate-800/50 transition-all text-left group"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-600/20 text-orange-400 border border-orange-500/30">
                    <Target className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-white group-hover:text-orange-300 transition-colors">
                      Tune ICP Weighting
                    </h4>
                    <p className="text-[11px] text-slate-400">Threshold: {minThreshold}+ Fit</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-white transition-colors" />
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-center">
            <span className="text-xs text-slate-400">Need to integrate custom CRM?</span>
            <div className="mt-1 flex items-center justify-center gap-2 text-xs font-semibold text-indigo-400 cursor-pointer hover:underline">
              <span>View Webhook Connectors</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
