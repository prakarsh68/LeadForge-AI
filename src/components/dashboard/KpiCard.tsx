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
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition-all hover:border-slate-300 hover:shadow-md group">
      {/* Subtle top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />

      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {metric.title}
        </p>
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            isUp
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : isDown
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
          }`}
        >
          {isUp && <ArrowUpRight className="h-3 w-3" />}
          {isDown && <ArrowDownRight className="h-3 w-3" />}
          {!isUp && !isDown && <Activity className="h-3 w-3 animate-pulse" />}
          {metric.change}
        </span>
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-[Plus_Jakarta_Sans]">
          {metric.value}
        </span>
      </div>

      <p className="mt-2 text-xs text-slate-500 flex items-center gap-1.5 font-medium">
        <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
        {metric.subtitle}
      </p>
    </div>
  );
};
