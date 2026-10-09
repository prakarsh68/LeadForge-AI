import React from 'react';
import { PieChart, Zap } from 'lucide-react';
import type { Lead } from '../../types';

interface TierDistributionChartProps {
  leads?: Lead[];
}

export const TierDistributionChart: React.FC<TierDistributionChartProps> = ({ leads = [] }) => {
  const total = leads.length;
  const tierACount = leads.filter((l) => l.score >= 85).length;
  const tierBCount = leads.filter((l) => l.score >= 75 && l.score < 85).length;
  const tierCCount = leads.filter((l) => l.score < 75).length;

  const tierAPct = total > 0 ? Math.round((tierACount / total) * 100) : 0;
  const tierBPct = total > 0 ? Math.round((tierBCount / total) * 100) : 0;
  const tierCPct = total > 0 ? Math.max(0, 100 - tierAPct - tierBPct) : 0;

  const distribution = [
    { label: 'Tier A (85-100 Match)', count: tierACount, percentage: tierAPct, color: 'bg-emerald-500' },
    { label: 'Tier B (75-84 Match)', count: tierBCount, percentage: tierBPct, color: 'bg-indigo-500' },
    { label: 'Tier C (<75 Match)', count: tierCCount, percentage: tierCPct, color: 'bg-amber-500' },
  ];

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white">
              ICP Fit Distribution
            </h3>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
              {total} Evaluated
            </span>
          </div>
          <PieChart className="h-4 w-4 text-slate-400" />
        </div>

        <p className="mt-2 text-xs text-slate-400">
          Distribution across ICP criteria based on current active weighting.
        </p>

        {/* Stacked Percentage Bar */}
        <div className="mt-5 h-4 w-full rounded-full overflow-hidden flex bg-slate-800 p-0.5 gap-0.5">
          {distribution.map((tier) => (
            <div
              key={tier.label}
              className={`${tier.color} h-full rounded-sm transition-all hover:opacity-90`}
              style={{ width: `${tier.percentage}%` }}
              title={`${tier.label}: ${tier.count} (${tier.percentage}%)`}
            />
          ))}
        </div>

        {/* Breakdown List */}
        <div className="mt-5 space-y-3">
          {distribution.map((tier) => (
            <div
              key={tier.label}
              className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-950/40 p-2.5 text-xs"
            >
              <div className="flex items-center gap-2.5">
                <div className={`h-2.5 w-2.5 rounded-full ${tier.color}`} />
                <span className="font-medium text-slate-200">{tier.label}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-slate-400">{tier.count} leads</span>
                <span className="font-bold text-white font-mono bg-slate-800 px-2 py-0.5 rounded">
                  {tier.percentage}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendation Alert */}
      <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-xs text-amber-200/90">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <Zap className="h-3.5 w-3.5" />
          Autonomous Recommendation
        </div>
        <p className="mt-1 text-[11px] text-amber-300/80 leading-relaxed">
          Tier A accounts convert 3.4x faster. Adjust ICP threshold to 82+ to filter lower priority SDR queues.
        </p>
      </div>
    </div>
  );
};
