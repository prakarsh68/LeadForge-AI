import React, { useState } from 'react';
import { TrendingUp, Sparkles } from 'lucide-react';

const chartDataByTimeframe = {
  '7D': [
    { label: 'Mon', total: 42, qualified: 28 },
    { label: 'Tue', total: 68, qualified: 45 },
    { label: 'Wed', total: 95, qualified: 68 },
    { label: 'Thu', total: 120, qualified: 89 },
    { label: 'Fri', total: 110, qualified: 76 },
    { label: 'Sat', total: 64, qualified: 42 },
    { label: 'Sun', total: 85, qualified: 64 },
  ],
  '30D': [
    { label: 'W1', total: 280, qualified: 195 },
    { label: 'W2', total: 340, qualified: 242 },
    { label: 'W3', total: 420, qualified: 310 },
    { label: 'W4', total: 388, qualified: 281 },
  ],
  '90D': [
    { label: 'M1', total: 1150, qualified: 820 },
    { label: 'M2', total: 1420, qualified: 1040 },
    { label: 'M3', total: 1680, qualified: 1290 },
  ],
};

export const DiscoveryChart: React.FC = () => {
  const [timeframe, setTimeframe] = useState<'7D' | '30D' | '90D'>('7D');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const activeData = chartDataByTimeframe[timeframe];
  const maxVal = Math.max(...activeData.map((d) => d.total));

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">
              Lead Discovery &amp; Qualification Velocity
            </h3>
            <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 border border-indigo-200">
              Live Feed
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Volume of raw accounts identified vs. ICP Qualified leads ({timeframe} window)
          </p>
        </div>

        {/* Timeframe selector */}
        <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 border border-slate-200 self-start sm:self-auto">
          {(['7D', '30D', '90D'] as const).map((period) => (
            <button
              key={period}
              onClick={() => {
                setTimeframe(period);
                setHoveredIndex(null);
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                timeframe === period
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-slate-200 border border-slate-300" />
            <span>Raw Leads Found</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-indigo-600 border border-indigo-700" />
            <span className="text-indigo-900 font-medium">ICP Qualified</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-700 font-medium">
          <TrendingUp className="h-3.5 w-3.5" />
          <span>+24% qualification rate</span>
        </div>
      </div>

      {/* Custom Bar Visualization */}
      <div className="mt-6 flex h-48 sm:h-56 items-end gap-3 sm:gap-6 px-2 justify-around">
        {activeData.map((item, index) => {
          const totalHeightPercent = (item.total / maxVal) * 100;
          const qualHeightPercent = (item.qualified / item.total) * 100;
          const isHovered = hoveredIndex === index;

          return (
            <div
              key={item.label}
              className="group relative flex flex-1 flex-col items-center h-full justify-end max-w-[64px]"
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Tooltip on hover */}
              {isHovered && (
                <div className="absolute -top-12 z-20 whitespace-nowrap rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-100 shadow-xl pointer-events-none">
                  <div>
                    {item.label}: <span className="text-white font-bold">{item.total} total</span>
                  </div>
                  <div className="text-emerald-400">
                    {item.qualified} ICP Qualified ({Math.round((item.qualified / item.total) * 100)}%)
                  </div>
                </div>
              )}

              {/* Bar Stack */}
              <div
                className="w-full rounded-t-lg overflow-hidden bg-slate-100 border border-slate-200 flex flex-col justify-end transition-all duration-300 group-hover:border-indigo-300"
                style={{ height: `${totalHeightPercent}%` }}
              >
                {/* Qualified portion */}
                <div
                  className="w-full bg-indigo-600 rounded-t-sm transition-all duration-500 group-hover:bg-indigo-700"
                  style={{ height: `${qualHeightPercent}%` }}
                />
              </div>

              {/* Day/Period Label */}
              <span
                className={`mt-2 text-xs font-semibold transition-colors ${
                  isHovered ? 'text-indigo-600' : 'text-slate-500'
                }`}
              >
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Chart Footer Highlight */}
      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          Autonomous pipeline ingest rate peaking during mid-week sprints
        </span>
        <span className="text-[11px] text-slate-500 font-mono">Window: {timeframe}</span>
      </div>
    </div>
  );
};
