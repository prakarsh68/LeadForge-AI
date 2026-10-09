import React from 'react';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import type { KpiMetric } from '../../types';


interface KpiCardProps {
  metric: KpiMetric;
}

export const KpiCard: React.FC<KpiCardProps> = ({ metric }) => {
  const isUp = metric.trend === 'up';
  const isDown = metric.trend === 'down';

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-800/80 bg-gradient-to-b from-slate-900/90 to-slate-900/50 p-5 shadow-sm transition-all hover:border-slate-700/80 hover:shadow-lg hover:shadow-indigo-500/5 group">
      {/* Subtle top glow line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {metric.title}
        </p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            isUp
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : isDown
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20'
          }`}
        >
          {isUp && <ArrowUpRight className="h-3 w-3" />}
          {isDown && <ArrowDownRight className="h-3 w-3" />}
          {!isUp && !isDown && <Activity className="h-3 w-3 animate-pulse" />}
          {metric.change}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          {metric.value}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-400 flex items-center gap-1.5">
        <span className="h-1 w-1 rounded-full bg-indigo-400/60" />
        {metric.subtitle}
      </p>
    </div>
  );
};
