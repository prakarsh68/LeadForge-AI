import React from 'react';
import {
  Sparkles,
  Mail,
  TrendingUp,
  Search,
  Clock,
  ArrowRight,
} from 'lucide-react';
import type { ViewType, ActivityItem } from '../../types';

interface RecentActivityProps {
  onNavigate: (view: ViewType) => void;
  activities?: ActivityItem[];
}

export const RecentActivity: React.FC<RecentActivityProps> = ({
  onNavigate,
  activities = [],
}) => {
  const getIcon = (type: string) => {
    switch (type) {
      case 'score':
        return <Sparkles className="h-4 w-4 text-emerald-600" />;
      case 'outreach':
        return <Mail className="h-4 w-4 text-indigo-600" />;
      case 'stage_change':
        return <TrendingUp className="h-4 w-4 text-amber-600" />;
      default:
        return <Search className="h-4 w-4 text-sky-600" />;
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Autonomous Activity Stream
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time actions executed by LeadForge autonomous workers
          </p>
        </div>
        <button
          onClick={() => onNavigate('leads')}
          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
        >
          View all leads <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="mt-4 divide-y divide-slate-100">
        {activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No autonomous activities recorded yet.
          </div>
        ) : (
          activities.slice(0, 5).map((act) => (
            <div
              key={act.id}
              className="flex items-start justify-between gap-3 py-3.5 hover:bg-slate-50/80 px-2 rounded-xl transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 shadow-2xs">
                  {getIcon(act.type)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-900">{act.title}</h4>
                    {act.badge && (
                      <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
                        {act.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">{act.description}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400 font-medium">
                <Clock className="h-3 w-3" />
                <span>{act.timestamp}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
