import React, { useState, useMemo } from 'react';
import { UserAvatar } from '../common/UserAvatar';

import type { Lead, LeadStatus } from '../../types';
import {
  Search,
  ArrowUpDown,
  Sparkles,
  CheckSquare,
  Square,
  CheckCircle2,
  Eye,
  Download,
  Plus,
  X,
  RotateCcw,
} from 'lucide-react';

interface LeadsViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onUpdateStatus?: (leadId: string, status: LeadStatus) => void;
  onAddLead?: (lead: Lead) => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
}

const ALL_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal',
  'Won',
  'Disqualified',
];

export const LeadsView: React.FC<LeadsViewProps> = ({
  leads,
  onSelectLead,
  onUpdateStatus,
  onAddLead,
  searchQuery: externalSearchQuery = '',
  onSearchChange,
}) => {
  const [internalSearchTerm, setInternalSearchTerm] = useState(externalSearchQuery);
  const [selectedTier, setSelectedTier] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'score' | 'value' | 'name'>('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [batchActionNotice, setBatchActionNotice] = useState<string | null>(null);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [visibleCount, setVisibleCount] = useState<number>(10);

  // New Lead Form State
  const [newLeadForm, setNewLeadForm] = useState({
    name: '',
    title: '',
    company: '',
    companyDomain: '',
    email: '',
    industry: 'Enterprise Software & Cloud',
    companySize: '100 - 250',
    dealValue: '48000',
    score: '88',
    status: 'New' as LeadStatus,
    triggers: 'High website visitor tracking activity',
    notes: 'Discovered via outbound signals.',
  });
  const [formError, setFormError] = useState<string | null>(null);

  const [prevExternalSearch, setPrevExternalSearch] = useState(externalSearchQuery);
  if (externalSearchQuery !== prevExternalSearch) {
    setPrevExternalSearch(externalSearchQuery);
    setInternalSearchTerm(externalSearchQuery);
  }


  const handleSearchChange = (term: string) => {
    setInternalSearchTerm(term);
    onSearchChange?.(term);
  };

  // Unique industries for filter
  const industries = useMemo(() => {
    return Array.from(new Set(leads.map((l) => l.industry))).filter(Boolean);
  }, [leads]);

  // Filter & Sort Logic
  const filteredLeads = useMemo(() => {
    const term = internalSearchTerm.trim().toLowerCase();
    return leads
      .filter((lead) => {
        const matchesSearch =
          !term ||
          lead.name.toLowerCase().includes(term) ||
          lead.company.toLowerCase().includes(term) ||
          lead.title.toLowerCase().includes(term) ||
          lead.companyDomain.toLowerCase().includes(term);

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
  }, [leads, internalSearchTerm, selectedTier, selectedStatus, selectedIndustry, sortBy, sortAsc]);

  const handleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0) {
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
    if (selectedLeadIds.length === 0) return;
    // Mark selected leads as 'Contacted'
    selectedLeadIds.forEach((id) => {
      onUpdateStatus?.(id, 'Contacted');
    });
    setBatchActionNotice(`Updated stage to 'Contacted' for ${selectedLeadIds.length} prospects!`);
    setTimeout(() => setBatchActionNotice(null), 3500);
    setSelectedLeadIds([]);
  };

  // Functional CSV Export
  const handleExportCsv = () => {
    const headers = [
      'Name',
      'Title',
      'Company',
      'Domain',
      'Email',
      'Industry',
      'Headcount',
      'Fit Score',
      'Stage',
      'Deal Value ($)',
      'Triggers',
    ];

    const rows = filteredLeads.map((l) => [
      `"${l.name.replace(/"/g, '""')}"`,
      `"${l.title.replace(/"/g, '""')}"`,
      `"${l.company.replace(/"/g, '""')}"`,
      `"${l.companyDomain}"`,
      `"${l.email}"`,
      `"${l.industry}"`,
      `"${l.companySize}"`,
      l.score,
      `"${l.status}"`,
      l.dealValue,
      `"${l.triggers.join('; ').replace(/"/g, '""')}"`,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `leadforge_leads_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCreateLead = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadForm.name.trim() || !newLeadForm.company.trim()) {
      setFormError('Prospect Name and Company are required.');
      return;
    }

    const cleanDomain =
      newLeadForm.companyDomain.trim() ||
      `${newLeadForm.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

    const cleanEmail =
      newLeadForm.email.trim() ||
      `${newLeadForm.name.toLowerCase().split(' ')[0]}@${cleanDomain}`;

    const scoreNum = Math.min(100, Math.max(0, parseInt(newLeadForm.score) || 80));

    const newLead: Lead = {
      id: `lead-${Date.now()}`,
      name: newLeadForm.name.trim(),
      title: newLeadForm.title.trim() || 'Decision Maker',
      company: newLeadForm.company.trim(),
      companyDomain: cleanDomain,
      avatar: '',
      email: cleanEmail,
      linkedin: `https://linkedin.com/in/${newLeadForm.name.toLowerCase().replace(/\s+/g, '-')}`,
      location: 'United States',
      industry: newLeadForm.industry,
      companySize: newLeadForm.companySize,
      score: scoreNum,
      tier: scoreNum >= 85 ? 'high' : scoreNum >= 75 ? 'medium' : 'low',
      status: newLeadForm.status,
      dealValue: parseInt(newLeadForm.dealValue) || 45000,
      triggers: newLeadForm.triggers.split(',').map((t) => t.trim()).filter(Boolean),
      notes: newLeadForm.notes.trim() || 'Added via manual repository intake.',
      lastActive: 'Just now',
    };

    onAddLead?.(newLead);
    setShowAddLeadModal(false);
    setFormError(null);
    setNewLeadForm({
      name: '',
      title: '',
      company: '',
      companyDomain: '',
      email: '',
      industry: 'Enterprise Software & Cloud',
      companySize: '100 - 250',
      dealValue: '48000',
      score: '88',
      status: 'New',
      triggers: 'High website visitor tracking activity',
      notes: 'Discovered via outbound signals.',
    });
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 90) return 'border-emerald-200 bg-emerald-50 text-emerald-800';
    if (score >= 75) return 'border-indigo-200 bg-indigo-50 text-indigo-800';
    return 'border-amber-200 bg-amber-50 text-amber-800';
  };

  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'New':
        return 'border-slate-200 bg-slate-100 text-slate-700';
      case 'Contacted':
        return 'border-sky-200 bg-sky-50 text-sky-800';
      case 'Qualified':
        return 'border-indigo-200 bg-indigo-50 text-indigo-800';
      case 'Proposal':
        return 'border-amber-200 bg-amber-50 text-amber-800';
      case 'Won':
        return 'border-emerald-200 bg-emerald-50 text-emerald-800';
      default:
        return 'border-rose-200 bg-rose-50 text-rose-800';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-300">
      {/* Top Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-xs">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by prospect name, title, or company..."
            value={internalSearchTerm}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-10 pr-8 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {internalSearchTerm && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filters and Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Fit Tier Filter */}
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
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
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            {ALL_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          {/* Industry Filter */}
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-xs text-slate-700 focus:bg-white focus:border-indigo-500 focus:outline-none cursor-pointer hidden sm:block"
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
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <ArrowUpDown className="h-3.5 w-3.5 text-indigo-600" />
            <span>
              Sort: {sortBy === 'score' ? 'Fit Score' : sortBy === 'value' ? 'Deal Size' : 'Name'}{' '}
              {sortAsc ? '↑' : '↓'}
            </span>
          </button>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCsv}
            title="Export filtered leads to CSV"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span className="hidden md:inline">Export</span>
          </button>

          {/* Add Lead Button */}
          <button
            onClick={() => setShowAddLeadModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 text-xs font-bold text-white shadow-xs transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add Lead</span>
          </button>
        </div>
      </div>

      {/* Batch Action Toolbar */}
      {selectedLeadIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/80 p-3 text-xs text-indigo-900 animate-in slide-in-from-top-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900">{selectedLeadIds.length}</span>
            <span>prospects selected</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchOutreach}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Mark as Contacted &amp; Outreach
            </button>
            <button
              onClick={() => setSelectedLeadIds([])}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 shadow-2xs"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {batchActionNotice && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          {batchActionNotice}
        </div>
      )}

      {/* Main Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            {/* Table Header */}
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <button
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Lead Persona</th>
                <th className="py-3.5 px-4">Company &amp; Headcount</th>
                <th className="py-3.5 px-4">AI Fit Score</th>
                <th className="py-3.5 px-4">Pipeline Stage</th>
                <th className="py-3.5 px-4">Buying Triggers</th>
                <th className="py-3.5 px-4">Deal Value</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-14 text-center text-slate-500">
                    <p className="text-sm font-semibold text-slate-700">
                      No leads matched your search or filter criteria.
                    </p>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                      Try clearing your search query or resetting filters to view all discovered accounts.
                    </p>
                    <button
                      onClick={() => {
                        handleSearchChange('');
                        setSelectedTier('all');
                        setSelectedStatus('all');
                        setSelectedIndustry('all');
                      }}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5 text-indigo-600" />
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              ) : (
                filteredLeads.slice(0, visibleCount).map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id);
                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-50/80 transition-colors group ${
                        isSelected ? 'bg-indigo-50/50' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleSelectOne(lead.id)}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-indigo-600" />
                          ) : (
                            <Square className="h-4 w-4 text-slate-300" />
                          )}
                        </button>
                      </td>

                      {/* Lead Persona */}
                      <td className="py-3.5 px-4">
                        <div
                          className="flex items-center gap-3 cursor-pointer"
                          onClick={() => onSelectLead(lead)}
                        >
                          <UserAvatar name={lead.name} size="md" />
                          <div>
                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                              {lead.name}
                            </div>
                            <div className="text-slate-500 text-[11px] line-clamp-1">
                              {lead.title}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Company & Domain */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-800">{lead.company}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                          <span className="font-mono text-indigo-600">{lead.companyDomain}</span>
                          <span>•</span>
                          <span>{lead.companySize} emp</span>
                        </div>
                      </td>

                      {/* AI Fit Score */}
                      <td className="py-3.5 px-4">
                        <div className="inline-flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`rounded-md border px-2 py-0.5 text-xs font-black font-mono ${getScoreBadgeColor(
                              lead.score
                            )}`}
                          >
                            {lead.score}
                          </span>
                          <span className="text-[10px] text-slate-400 font-medium">/ 100</span>
                          {lead.isQualificationStale && (
                            <span
                              className="rounded px-1.5 py-0.5 text-[9px] font-bold border border-amber-200 bg-amber-50 text-amber-800"
                              title="Lead criteria were modified after qualification. Re-qualify to update."
                            >
                              STALE
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Quick Interactive Pipeline Stage Selector */}
                      <td className="py-3.5 px-4">
                        <select
                          value={lead.status}
                          onChange={(e) =>
                            onUpdateStatus?.(lead.id, e.target.value as LeadStatus)
                          }
                          className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold focus:outline-none cursor-pointer ${getStatusBadge(
                            lead.status
                          )}`}
                        >
                          {ALL_STATUSES.map((st) => (
                            <option key={st} value={st} className="bg-white text-slate-900">
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Buying Triggers */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="flex flex-wrap gap-1">
                          {lead.triggers.slice(0, 1).map((trig, idx) => (
                            <span
                              key={idx}
                              className="rounded bg-slate-100 border border-slate-200 px-2 py-0.5 text-[11px] text-slate-700 truncate max-w-[200px]"
                              title={trig}
                            >
                              ⚡ {trig}
                            </span>
                          ))}
                          {lead.triggers.length > 1 && (
                            <span className="rounded bg-slate-100 border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-500 font-mono">
                              +{lead.triggers.length - 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Deal Value */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-emerald-700 font-mono">
                          ${lead.dealValue.toLocaleString()}
                        </span>
                        <div className="text-[10px] text-slate-400">ARR est.</div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => onSelectLead(lead)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-2xs"
                        >
                          <Eye className="h-3 w-3 text-indigo-600" />
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <span className="font-bold text-slate-900">{Math.min(visibleCount, filteredLeads.length)}</span>
            <span>of {filteredLeads.length} filtered prospects ({leads.length} total)</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {filteredLeads.length > visibleCount && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 10)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1 font-semibold text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition-colors shadow-2xs cursor-pointer"
              >
                Show 10 More Leads ({filteredLeads.length - visibleCount} remaining)
              </button>
            )}
            {visibleCount > 10 && (
              <button
                type="button"
                onClick={() => setVisibleCount(10)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
              >
                Collapse to 10
              </button>
            )}
            {filteredLeads.length > 20 && visibleCount < filteredLeads.length && (
              <button
                type="button"
                onClick={() => setVisibleCount(filteredLeads.length)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-slate-600 hover:text-indigo-600 transition-colors cursor-pointer"
              >
                Show All
              </button>
            )}
            <span className="text-[11px] text-slate-400 hidden md:inline ml-2">
              Synced with SQLite
            </span>
          </div>
        </div>
      </div>

      {/* Modal: Add New Lead */}
      {showAddLeadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl text-slate-900">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600" />
                Add Prospect to Repository
              </h3>
              <button
                onClick={() => setShowAddLeadModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {formError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2.5 text-xs font-medium text-rose-800">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateLead} className="mt-4 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Maya Lin"
                    value={newLeadForm.name}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, name: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Company Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SynthWave Dynamics"
                    value={newLeadForm.company}
                    onChange={(e) =>
                      setNewLeadForm({ ...newLeadForm, company: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Job Title</label>
                  <input
                    type="text"
                    placeholder="e.g. VP Sales Engineering"
                    value={newLeadForm.title}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, title: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Target Industry</label>
                  <select
                    value={newLeadForm.industry}
                    onChange={(e) =>
                      setNewLeadForm({ ...newLeadForm, industry: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Enterprise Software & Cloud">Enterprise Software &amp; Cloud</option>
                    <option value="AI & Data Analytics">AI &amp; Data Analytics</option>
                    <option value="FinTech & Payments">FinTech &amp; Payments</option>
                    <option value="Cybersecurity">Cybersecurity</option>
                    <option value="HealthTech & Bio">HealthTech &amp; Bio</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Fit Score (0-100)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={newLeadForm.score}
                    onChange={(e) => setNewLeadForm({ ...newLeadForm, score: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Deal Value ($)</label>
                  <input
                    type="number"
                    value={newLeadForm.dealValue}
                    onChange={(e) =>
                      setNewLeadForm({ ...newLeadForm, dealValue: e.target.value })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-900 font-mono focus:bg-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-700 font-medium mb-1">Initial Stage</label>
                  <select
                    value={newLeadForm.status}
                    onChange={(e) =>
                      setNewLeadForm({ ...newLeadForm, status: e.target.value as LeadStatus })
                    }
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-none"
                  >
                    {ALL_STATUSES.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Buying Triggers (comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. Raised Series A, Hiring 5 SDRs"
                  value={newLeadForm.triggers}
                  onChange={(e) =>
                    setNewLeadForm({ ...newLeadForm, triggers: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddLeadModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-100 shadow-2xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 transition-colors"
                >
                  Save Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
