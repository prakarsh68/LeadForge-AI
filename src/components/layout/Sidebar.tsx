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
  Compass,
  Send,
  Settings,
  PanelLeftClose,
  PanelLeftOpen,
  Globe,
} from 'lucide-react';
import type { ViewType, IcpProfile } from '../../types';

interface SidebarProps {
  currentView: ViewType;
  onSelectView: (view: ViewType) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  isCollapsed = false,
  onToggleCollapse,
  icpProfile,
  leadsCount = 12,
  pipelineTotal = 645000,
  docsCount = 6,
}) => {
  const formattedPipeline =
    pipelineTotal >= 1000000
      ? `$${(pipelineTotal / 1000000).toFixed(1)}M`
      : `$${Math.round(pipelineTotal / 1000)}k`;

  const navSections: {
    title: string;
    items: { id: ViewType; label: string; icon: React.ElementType; badge?: string }[];
  }[] = [
    {
      title: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'landing', label: 'Landing & Pricing', icon: Globe, badge: 'Plans' },
      ],
    },
    {
      title: 'Prospecting',
      items: [
        { id: 'discovery', label: 'Discovery Engine', icon: Compass, badge: 'Real Sourcing' },
        { id: 'leads', label: 'Leads', icon: Users, badge: `${leadsCount}` },
        { id: 'icp', label: 'ICP Setup', icon: Target },
      ],
    },
    {
      title: 'Sales',
      items: [
        { id: 'pipeline', label: 'Pipeline', icon: Kanban, badge: formattedPipeline },
        { id: 'outreach', label: 'Outreach & CRM', icon: Send },
      ],
    },
    {
      title: 'Knowledge',
      items: [
        { id: 'knowledge', label: 'Knowledge Base', icon: BookOpen, badge: `${docsCount} docs` },
      ],
    },
    {
      title: 'Settings',
      items: [
        { id: 'settings', label: 'Source Profiles & Config', icon: Settings },
      ],
    },
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm lg:hidden transition-opacity"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container: smoothly toggles width from w-72 to w-20 on desktop */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out lg:static lg:translate-x-0 shadow-xs ${
          isOpenMobile ? 'translate-x-0 w-72' : '-translate-x-full'
        } ${isCollapsed ? 'lg:w-20' : 'lg:w-72'}`}
      >
        {/* Brand Header */}
        <div className="flex h-18 items-center justify-between px-4 border-b border-slate-200/90 bg-white">
          {!isCollapsed ? (
            <>
              {/* Clickable Brand Logo & Title -> Directs to Dashboard */}
              <button
                type="button"
                onClick={() => {
                  onSelectView('dashboard');
                  onCloseMobile();
                }}
                className="group flex items-center gap-2.5 text-left cursor-pointer rounded-xl p-1 -ml-1 transition-all hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 active:scale-[0.98] min-w-0"
                title="Go to Command Dashboard"
                aria-label="LeadForge AI Dashboard"
              >
                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/90 p-1 shadow-2xs group-hover:border-orange-500/40 group-hover:scale-105 transition-all">
                  <img
                    src="/LeadForge%20AI%20Gradient%20Logo.png"
                    alt="LeadForge AI Logo"
                    className="h-full w-full object-contain filter drop-shadow-2xs"
                  />
                  <div
                    className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500 shadow-xs"
                    title="System Online"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-extrabold tracking-tight text-slate-900 text-base font-[Plus_Jakarta_Sans] group-hover:text-indigo-600 transition-colors truncate">
                      Lead<span className="bg-gradient-to-r from-orange-500 to-amber-500 bg-clip-text text-transparent">Forge</span>
                    </span>
                    <span className="rounded bg-indigo-50 px-1 py-0.2 text-[9px] font-semibold text-indigo-700 border border-indigo-200/80 shrink-0">
                      AI
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-slate-500 group-hover:text-slate-700 transition-colors truncate">Autonomous Outbound</p>
                </div>
              </button>

              <div className="flex items-center gap-1">
                {/* Desktop Collapse Button */}
                <button
                  type="button"
                  onClick={onToggleCollapse}
                  className="hidden lg:flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors cursor-pointer"
                  title="Collapse sidebar"
                  aria-label="Collapse sidebar"
                >
                  <PanelLeftClose className="h-4 w-4" />
                </button>

                {/* Mobile Close Button */}
                <button
                  onClick={onCloseMobile}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 lg:hidden cursor-pointer"
                  aria-label="Close sidebar"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </>
          ) : (
            /* Collapsed Header State: Centered Icon & Expand Button */
            <div className="flex h-full w-full items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  onSelectView('dashboard');
                  onCloseMobile();
                }}
                className="group relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 border border-slate-200/90 p-1 shadow-2xs hover:border-orange-500/40 hover:scale-105 transition-all cursor-pointer"
                title="LeadForge AI Dashboard"
                aria-label="LeadForge AI Dashboard"
              >
                <img
                  src="/LeadForge%20AI%20Gradient%20Logo.png"
                  alt="LeadForge AI Logo"
                  className="h-full w-full object-contain filter drop-shadow-2xs"
                />
                <div
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border-2 border-white bg-emerald-500 shadow-xs"
                  title="System Online"
                />
              </button>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors cursor-pointer"
                title="Expand sidebar"
                aria-label="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {/* Navigation Section */}
        <div className={`flex-1 overflow-y-auto py-4 space-y-5 ${isCollapsed ? 'px-2' : 'px-4'}`}>
          {navSections.map((section) => (
            <div key={section.title} className="space-y-1">
              {!isCollapsed ? (
                <div className="px-3 pb-1 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                  {section.title}
                </div>
              ) : (
                <div className="mx-auto my-2 h-px w-8 bg-slate-200" />
              )}
              <nav className="space-y-0.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = currentView === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        onSelectView(item.id);
                        onCloseMobile();
                      }}
                      title={item.label}
                      className={`group relative flex items-center rounded-xl transition-all duration-150 cursor-pointer ${
                        isCollapsed
                          ? 'w-full justify-center p-2.5'
                          : 'w-full justify-between px-3 py-2 text-xs font-medium'
                      } ${
                        isActive
                          ? 'bg-indigo-50/90 text-indigo-900 font-semibold border border-indigo-200/80 shadow-2xs'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className={`flex items-center gap-2.5 ${isCollapsed ? '' : 'min-w-0'}`}>
                        <div
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200/70 group-hover:text-slate-800'
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>

                      {!isCollapsed && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          {item.badge && (
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                                isActive
                                  ? 'bg-indigo-100 text-indigo-700 border border-indigo-200'
                                  : 'bg-slate-100 text-slate-600 border border-slate-200'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                          {isActive && (
                            <ChevronRight className="h-3.5 w-3.5 text-indigo-600 animate-in fade-in" />
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          ))}

          {/* Active ICP Preset Card (Full on expanded, compact icon on collapsed) */}
          {!isCollapsed ? (
            <div
              onClick={() => {
                onSelectView('icp');
                onCloseMobile();
              }}
              className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 shadow-2xs hover:border-indigo-300 hover:bg-indigo-50/30 transition-all"
            >
              <div className="flex items-center justify-between pb-2">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-700">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  Active ICP Profile
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
              <p className="text-xs font-semibold text-slate-900 truncate">
                {icpProfile?.name || 'B2B SaaS Growth & Enterprise'}
              </p>
              <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-500">
                <span>Fit Threshold:</span>
                <span className="font-semibold text-emerald-700">
                  {icpProfile?.minScoreThreshold || 78}+ Score
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                <span>Audience Pool:</span>
                <span className="font-semibold text-slate-800">~4,200 Accounts</span>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSelectView('icp')}
              title={`Active ICP: ${icpProfile?.name || 'B2B SaaS Growth'}`}
              className="flex w-full items-center justify-center rounded-xl p-2.5 text-indigo-600 hover:bg-indigo-50 transition-colors cursor-pointer"
            >
              <Sparkles className="h-4 w-4" />
            </button>
          )}

          {/* AI Autonomous Engine Status */}
          {!isCollapsed ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Agent Engine
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Autonomous
                </span>
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Monthly Credits</span>
                  <span className="text-slate-900 font-semibold">842 / 1,000</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-indigo-600 to-indigo-400"
                    style={{ width: '84.2%' }}
                  />
                </div>
                <p className="text-[10px] text-slate-500">
                  Resets in 12 days • High accuracy mode
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Sidebar Footer User Info & Expand/Collapse Toggle */}
        <div className={`border-t border-slate-200/90 bg-white ${isCollapsed ? 'p-2' : 'p-4'}`}>
          {!isCollapsed ? (
            <div className="flex items-center justify-between rounded-xl p-2 hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 min-w-0">
                <div className="relative shrink-0">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-xs shadow-xs">
                    PA
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">Prakarsh Awasthi</p>
                  <p className="text-[11px] text-slate-500 truncate">Growth Engineering</p>
                </div>
              </div>
              <span title="Verified Workspace" className="text-indigo-600 shrink-0">
                <ShieldCheck className="h-4 w-4" />
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-1">
              <div
                className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-xs shadow-xs cursor-pointer"
                title="Prakarsh Awasthi (Growth Engineering)"
              >
                PA
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-white bg-emerald-500" />
              </div>
              <button
                type="button"
                onClick={onToggleCollapse}
                className="hidden lg:flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-indigo-600 transition-colors cursor-pointer"
                title="Expand sidebar"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
