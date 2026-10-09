import React, { useState, useMemo } from 'react';
import type { Lead, LeadStatus } from '../../types';
import {
  Search,
  ArrowUpDown,
  Sparkles,
  CheckSquare,
  Square,
  CheckCircle2,
  Eye,
} from 'lucide-react';

interface LeadsViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onUpdateStatus?: (leadId: string, status: LeadStatus) => void;
}

export const LeadsView: React.FC<LeadsViewProps> = ({
  leads,
  onSelectLead,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'value' | 'name'>('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [batchActionNotice, setBatchActionNotice] = useState<string | null>(null);


  // Unique industries for filter
  const industries = useMemo(() => {
    return Array.from(new Set(leads.map((l) => l.industry)));
  }, [leads]);

  // Filter & Sort Logic
  const filteredLeads = useMemo(() => {
    return leads
      .filter((lead) => {
        const matchesSearch =
          lead.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.company.toLowerCase().includes(searchTerm.toLowerCase()) ||
          lead.title.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesTier =
          selectedTier === 'all' ||
          (selectedTier === 'high' && lead.score >= 85) ||
          (selectedTier === 'medium' && lead.score >= 75 && lead.score < 85) ||
          (selectedTier === 'low' && lead.score < 75);

        const matchesStatus =
          selectedStatus === 'all' || lead.status === selectedStatus;

        const matchesIndustry =
          selectedIndustry === 'all' || lead.industry === selectedIndustry;

        return matchesSearch && matchesTier && matchesStatus && matchesIndustry;
      })
      .sort((a, b) => {
        let comp = 0;
        if (sortBy === 'score') comp = b.score - a.score;
        else if (sortBy === 'value') comp = b.dealValue - a.dealValue;
        else comp = a.name.localeCompare(b.name);

        return sortAsc ? -comp : comp;
      });
  }, [leads, searchTerm, selectedTier, selectedStatus, selectedIndustry, sortBy, sortAsc]);

  const handleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    if (selectedLeadIds.includes(id)) {
      setSelectedLeadIds(selectedLeadIds.filter((item) => item !== id));
    } else {
      setSelectedLeadIds([...selectedLeadIds, id]);
    }
  };

  const handleBatchOutreach = () => {
    setBatchActionNotice(`Enqueued AI outreach sequences for ${selectedLeadIds.length} prospects!`);
    setTimeout(() => setBatchActionNotice(null), 3000);
    setSelectedLeadIds([]);
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400';
    if (score >= 75) return 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400';
    return 'border-amber-500/40 bg-amber-500/10 text-amber-400';
  };

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'New':
        return 'border-slate-700 bg-slate-800 text-slate-300';
      case 'Contacted':
        return 'border-sky-500/30 bg-sky-500/10 text-sky-400';
      case 'Qualified':
        return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400';
      case 'Proposal':
        return 'border-amber-500/30 bg-amber-500/10 text-amber-400';
      case 'Won':
        return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400';
      default:
        return 'border-rose-500/30 bg-rose-500/10 text-rose-400';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-4 sm:p-5 backdrop-blur-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by prospect name, title, or company..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-800 bg-slate-950/80 pl-10 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Fit Tier Filter */}
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All Fit Scores</option>
            <option value="high">Tier A (85+ Score)</option>
            <option value="medium">Tier B (75-84 Score)</option>
            <option value="low">Tier C (&lt;75 Score)</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="New">New Discovered</option>
            <option value="Contacted">Outreach Sent</option>
            <option value="Qualified">ICP Qualified</option>
            <option value="Proposal">Proposal</option>
            <option value="Won">Closed Won</option>
          </select>

          {/* Industry Filter */}
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-300 focus:border-indigo-500 focus:outline-none hidden sm:block"
          >
            <option value="all">All Industries</option>
            {industries.map((ind) => (
              <option key={ind} value={ind}>
                {ind}
              </option>
            ))}
          </select>

          {/* Sort By Toggle */}
          <button
            onClick={() => {
              setSortAsc(!sortAsc);
              if (sortBy === 'score') setSortBy('value');
              else if (sortBy === 'value') setSortBy('name');
              else setSortBy('score');
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800 transition-colors"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-indigo-400" />
            <span>Sort: {sortBy === 'score' ? 'Fit Score' : sortBy === 'value' ? 'Deal Size' : 'Name'} {sortAsc ? '↑' : '↓'}</span>
          </button>

        </div>
      </div>

      {/* Batch Action Toolbar */}
      {selectedLeadIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-500/30 bg-indigo-950/40 p-3 text-xs text-indigo-200 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{selectedLeadIds.length}</span>
            <span>prospects selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchOutreach}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-500 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Trigger AI Multichannel Sequence
            </button>
            <button
              onClick={() => setSelectedLeadIds([])}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1.5 text-xs text-slate-300 hover:text-white"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {batchActionNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-950/30 p-3 text-xs font-semibold text-emerald-400 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4" />
          {batchActionNotice}
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Table Header */}
            <thead className="border-b border-slate-800/80 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <button
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-slate-200"
                  >
                    {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-indigo-400" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Lead Persona</th>
                <th className="py-3.5 px-4">Company & Headcount</th>
                <th className="py-3.5 px-4">AI Fit Score</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Buying Triggers</th>
                <th className="py-3.5 px-4">Deal Value</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-800/60">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <p className="text-sm">No leads matched your search or filter criteria.</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Try resetting filters or adjusting your ICP score threshold.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-800/40 transition-colors group ${
                        isSelected ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleSelectOne(lead.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-indigo-400" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-600" />
                          )}
                        </button>
                      </td>

                      {/* Lead Persona */}
                      <td className="py-3.5 px-4">
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => onSelectLead(lead)}
                        >
                          <img
                            src={lead.avatar}
                            alt={lead.name}
                            className="h-9 w-9 rounded-full object-cover border border-slate-700 shrink-0"
                          />
                          <div>
                            <div className="font-bold text-white group-hover:text-indigo-300 transition-colors flex items-center gap-1.5">
                              {lead.name}
                            </div>
                            <div className="text-slate-400 text-[11px] line-clamp-1">
                              {lead.title}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Company & Domain */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-200">{lead.company}</div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <span>{lead.companyDomain}</span>
                          <span>•</span>
                          <span>{lead.companySize} emp</span>
                        </div>
                      </td>

                      {/* AI Fit Score */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs font-black font-mono ${getScoreBadgeColor(
                              lead.score
                            )}`}
                          >
                            {lead.score}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">/ 100</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getStatusBadge(
                            lead.status
                          )}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {lead.status}
                        </span>
                      </td>

                      {/* Buying Triggers */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {lead.triggers.slice(0, 1).map((trig, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-slate-800/80 border border-slate-700/80 px-2 py-0.5 text-[11px] text-slate-300 truncate max-w-[200px]"
                              title={trig}
                            >
                              ⚡ {trig}
                            </span>
                          ))}
                          {lead.triggers.length > 1 && (
                            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
                              +{lead.triggers.length - 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Deal Value */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-emerald-400 font-mono">
                          ${lead.dealValue.toLocaleString()}
                        </span>
                        <div className="text-[10px] text-slate-400">ARR est.</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800/80 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
                        >
                          <Eye className="h-3 w-3 text-indigo-400" />
                          Inspect
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-800/80 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <span className="font-bold text-white">{filteredLeads.length}</span>
            <span>of {leads.length} discovered prospects</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-slate-400">
              Updated continuously via Autonomous Scraping Agents
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
