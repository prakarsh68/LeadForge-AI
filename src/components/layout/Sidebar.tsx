import React from 'react';
import {
  LayoutDashboard,
  Target,
  Users,
  Kanban,
  BookOpen,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  X,
  Flame,
  Compass,
} from 'lucide-react';
import type { ViewType, IcpProfile } from '../../types';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  icpProfile?: IcpProfile;
  leadsCount?: number;
  pipelineTotal?: number;
  docsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
  icpProfile,
  leadsCount = 12,
  pipelineTotal = 645000,
  docsCount = 6,
}) => {
  const formattedPipeline =
    pipelineTotal >= 1000000
      ? `$${(pipelineTotal / 1000000).toFixed(1)}M`
      : `$${Math.round(pipelineTotal / 1000)}k`;

  const navItems: { id: ViewType; label: string; icon: React.ElementType; badge?: string }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'icp', label: 'ICP Setup', icon: Target },
    { id: 'discovery', label: 'Discovery Engine', icon: Compass, badge: 'New' },
    { id: 'leads', label: 'Leads', icon: Users, badge: `${leadsCount}` },
    { id: 'pipeline', label: 'Pipeline', icon: Kanban, badge: formattedPipeline },
    { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen, badge: `${docsCount} docs` },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-slate-800/80 bg-slate-900/95 backdrop-blur-xl transition-transform duration-300 ease-in-out lg:static lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex h-18 items-center justify-between px-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-amber-500 via-orange-500 to-indigo-600 shadow-lg shadow-orange-500/20">
              <Flame className="h-5 w-5 text-white animate-pulse" />
              <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-slate-900 bg-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-white text-lg font-[Plus_Jakarta_Sans]">
                  Lead<span className="bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Forge</span>
                </span>
                <span className="rounded bg-indigo-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/30">
                  AI
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-400">Autonomous Outbound</p>
            </div>
          </div>

          <button
            onClick={onCloseMobile}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation Section */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
          <div>
            <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
              Core Platform
            </div>
            <nav className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentView === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onSelectView(item.id);
                      onCloseMobile();
                    }}
                    className={`group relative flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600/20 to-indigo-500/10 text-white font-semibold shadow-inner border border-indigo-500/30'
                        : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                          isActive
                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                            : 'bg-slate-800/80 text-slate-400 group-hover:bg-slate-800 group-hover:text-slate-200'
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span>{item.label}</span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {item.badge && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                            isActive
                              ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/30'
                              : 'bg-slate-800 text-slate-400 group-hover:text-slate-300'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {isActive && (
                        <ChevronRight className="h-4 w-4 text-indigo-400 animate-in fade-in" />
                      )}
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Active ICP Preset Card */}
          <div
            onClick={() => {
              onSelectView('icp');
              onCloseMobile();
            }}
            className="cursor-pointer rounded-xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/90 p-3.5 shadow-sm hover:border-indigo-500/40 transition-colors"
          >
            <div className="flex items-center justify-between pb-2">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                Active ICP Profile
              </span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            </div>
            <p className="text-xs font-medium text-slate-200 truncate">
              {icpProfile?.name || 'B2B SaaS Growth & Enterprise'}
            </p>
            <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-400">
              <span>Fit Threshold:</span>
              <span className="font-semibold text-emerald-400">
                {icpProfile?.minScoreThreshold || 78}+ Score
              </span>
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
              <span>Audience Pool:</span>
              <span className="font-semibold text-slate-200">~4,200 Accounts</span>
            </div>
          </div>

          {/* AI Autonomous Engine Status */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                Agent Engine
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Autonomous
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              <div className="flex justify-between text-xs text-slate-400">
                <span>Monthly Credits</span>
                <span className="text-slate-200 font-semibold">842 / 1,000</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-amber-500"
                  style={{ width: '84.2%' }}
                />
              </div>
              <p className="text-[10px] text-slate-400">
                Resets in 12 days • High accuracy mode
              </p>
            </div>
          </div>
        </div>

        {/* Sidebar Footer User Info */}
        <div className="border-t border-slate-800/80 p-4">
          <div className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-800/50 transition-colors">
            <div className="relative">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 font-bold text-white text-xs">
                PA
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-slate-900 bg-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-slate-200 truncate">Prakarsh Awasthi</p>
              <p className="text-[11px] text-slate-400 truncate">Growth Engineering</p>
            </div>
            <span title="Verified Workspace" className="text-indigo-400">
              <ShieldCheck className="h-4 w-4" />
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};
