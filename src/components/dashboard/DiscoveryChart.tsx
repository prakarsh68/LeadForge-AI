import React, { useState } from 'react';
import { discoveryChartData } from '../../data/mockData';
import { TrendingUp, Sparkles } from 'lucide-react';


export const DiscoveryChart: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | '90D'>('7D');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const maxVal = Math.max(...discoveryChartData.map((d) => d.total));

  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-800/60">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-white">
              Lead Discovery & Qualification Velocity
            </h3>
            <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-300 border border-indigo-500/20">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Volume of raw accounts identified vs. ICP Qualified leads
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-800/80 p-1 border border-slate-700/60 self-start sm:self-auto">
          {(['7D', '30D', '90D'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setTimeframe(period)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                timeframe === period
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-indigo-500/40 border border-indigo-400/60" />
            <span>Raw Leads Found</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-emerald-500 border border-emerald-400 shadow-xs shadow-emerald-500/50" />
            <span className="text-emerald-300 font-medium">ICP Qualified (Fit ≥ 78)</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-400">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>+24% qualification rate</span>
        </div>
      </div>

      {/* Custom Bar Visualization */}
      <div className="mt-6 flex h-48 sm:h-56 items-end gap-2 sm:gap-6 px-2">
        {discoveryChartData.map((item, index) => {
          const totalHeightPercent = (item.total / maxVal) * 100;
          const qualHeightPercent = (item.qualified / item.total) * 100;
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={item.day}
              className="group relative flex flex-1 flex-col items-center h-full justify-end"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute -top-12 z-20 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-100 shadow-xl">
                  <div>{item.day}: <span className="text-white font-bold">{item.total} total</span></div>
                  <div className="text-emerald-400">{item.qualified} ICP Qualified ({Math.round((item.qualified/item.total)*100)}%)</div>
                </div>
              )}

              {/* Bar Stack */}
              <div
                className="w-full max-w-[42px] rounded-t-lg overflow-hidden bg-indigo-950/40 border border-indigo-500/30 flex flex-col justify-end transition-all duration-300 group-hover:border-indigo-400 group-hover:shadow-lg group-hover:shadow-indigo-500/20"
                style={{ height: `${totalHeightPercent}%` }}
              >
                {/* Qualified portion */}
                <div
                  className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-t-sm transition-all duration-500"
                  style={{ height: `${qualHeightPercent}%` }}
                />
              </div>

              {/* Day Label */}
              <span
                className={`mt-2 text-xs font-semibold transition-colors ${
                  isHovered ? 'text-indigo-300' : 'text-slate-400'
                }`}
              >
                {item.day}
              </span>
            </div>
          );
        })}
      </div>

      {/* Chart Footer Highlight */}
      <div className="mt-5 pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          Autonomous pipeline ingest rate peaking on Thursday (89 qualified accounts)
        </span>
        <span className="text-[11px] text-slate-400 font-mono">Target: 500 / wk</span>
      </div>
    </div>
  );
};
