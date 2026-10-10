import React, { useState } from 'react';
import type { Lead, LeadStatus } from '../../types';
import { pipelineColumns } from '../../data/mockData';
import { KanbanCard } from './KanbanCard';
import {
  Kanban,
  Plus,
  Search,
  X,
} from 'lucide-react';

interface PipelineViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onUpdateStatus: (leadId: string, newStatus: LeadStatus) => void;
  onAddLead?: (newLead: Lead) => void;
}

export const PipelineView: React.FC<PipelineViewProps> = ({
  leads,
  onSelectLead,
  onUpdateStatus,
  onAddLead,
}) => {
  const [filterQuery, setFilterQuery] = useState('');
  const [showAddDealModal, setShowAddDealModal] = useState(false);
  const [dealError, setDealError] = useState<string | null>(null);
  const [newDealForm, setNewDealForm] = useState({
    name: '',
    company: '',
    title: '',
    dealValue: '45000',
    stage: 'New' as LeadStatus,
  });

  const [expandedColumns, setExpandedColumns] = useState<Record<string, boolean>>({});

  const toggleColumnExpand = (colId: string) => {
    setExpandedColumns((prev) => ({ ...prev, [colId]: !prev[colId] }));
  };

  const stages: LeadStatus[] = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won'];

  const handleMoveStage = (leadId: string, direction: 'prev' | 'next') => {
    const currentLead = leads.find((l) => l.id === leadId);
    if (!currentLead) return;

    const currentIndex = stages.indexOf(currentLead.status);
    if (currentIndex === -1) return;

    const targetIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (targetIndex >= 0 && targetIndex < stages.length) {
      onUpdateStatus(leadId, stages[targetIndex]);
    }
  };

  // Calculate totals
  const totalPipelineValue = leads.reduce((acc, lead) => acc + lead.dealValue, 0);
  const totalWonValue = leads
    .filter((l) => l.status === 'Won')
    .reduce((acc, lead) => acc + lead.dealValue, 0);

  const filteredLeads = leads.filter(
    (l) =>
      l.name.toLowerCase().includes(filterQuery.toLowerCase()) ||
      l.company.toLowerCase().includes(filterQuery.toLowerCase())
  );

  const handleCreateDeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDealForm.name.trim() || !newDealForm.company.trim()) {
      setDealError('Prospect Name and Company are required.');
      return;
    }

    const cleanCompany = newDealForm.company.trim();
    const cleanDomain = `${cleanCompany.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`;

    const newLeadRecord: Lead = {
      id: `lead-${Date.now()}`,
      name: newDealForm.name.trim(),
      title: newDealForm.title.trim() || 'Director of Operations',
      company: cleanCompany,
      companyDomain: cleanDomain,
      avatar: '',
      email: `contact@${cleanDomain}`,
      linkedin: 'https://linkedin.com',
      location: 'United States',
      industry: 'Enterprise Software & Cloud',
      companySize: '100 - 250',
      score: 85,
      tier: 'high',
      status: newDealForm.stage,
      dealValue: parseInt(newDealForm.dealValue) || 40000,
      triggers: ['Manually added to pipeline'],
      notes: 'High intent prospect added via pipeline quick action.',
      lastActive: 'Just now',
    };

    onAddLead?.(newLeadRecord);
    setShowAddDealModal(false);
    setDealError(null);
    setNewDealForm({
      name: '',
      company: '',
      title: '',
      dealValue: '45000',
      stage: 'New',
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner Stats */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200">
            <Kanban className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Autonomous Deal Pipeline
            </h2>
            <p className="text-xs text-slate-500">
              Active opportunities progressed by LeadForge outbound sequences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 self-start sm:self-auto">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-1.5 text-right shadow-2xs">
            <div className="text-[10px] text-slate-500 font-semibold uppercase">Total Pipeline</div>
            <div className="text-sm font-extrabold text-slate-900 font-mono">
              ${totalPipelineValue.toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-1.5 text-right shadow-2xs">
            <div className="text-[10px] text-emerald-800 font-semibold uppercase">Closed Won</div>
            <div className="text-sm font-extrabold text-emerald-700 font-mono">
              ${totalWonValue.toLocaleString()}
            </div>
          </div>

          <button
            onClick={() => setShowAddDealModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Opportunity</span>
          </button>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-xs">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter pipeline by deal or company..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="text-xs text-slate-500 hidden sm:block">
          Showing <span className="text-slate-900 font-bold">{filteredLeads.length}</span> active deals across 5 stages
        </div>
      </div>

      {/* Kanban Board Container (Horizontally Scrollable) */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-[1100px]">
          {pipelineColumns.map((col) => {
            const colLeads = filteredLeads.filter((l) => l.status === col.id);
            const colTotalVal = colLeads.reduce((sum, l) => sum + l.dealValue, 0);
            const colIndex = stages.indexOf(col.id);
            const isExpanded = !!expandedColumns[col.id];
            const visibleLeads = isExpanded ? colLeads : colLeads.slice(0, 4);
            const hasMore = colLeads.length > 4;

            // Accessible distinct column styles
            const getColHeaderStyle = (id: string) => {
              switch (id) {
                case 'New':
                  return 'border-slate-300 bg-slate-100 text-slate-800';
                case 'Contacted':
                  return 'border-sky-300 bg-sky-50 text-sky-900';
                case 'Qualified':
                  return 'border-indigo-300 bg-indigo-50 text-indigo-900';
                case 'Proposal':
                  return 'border-amber-300 bg-amber-50 text-amber-900';
                case 'Won':
                  return 'border-emerald-300 bg-emerald-50 text-emerald-900';
                default:
                  return 'border-slate-200 bg-slate-50 text-slate-800';
              }
            };

            return (
              <div
                key={col.id}
                className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-slate-100/70 p-3 min-w-[220px]"
              >
                {/* Column Header */}
                <div className={`rounded-xl border p-3 mb-3 shadow-2xs ${getColHeaderStyle(col.id)}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{col.title}</span>
                    <span className="rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700 font-mono shadow-2xs">
                      {colLeads.length}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-600 font-mono font-semibold">
                    ${colTotalVal.toLocaleString()} ARR
                  </div>
                </div>

                {/* Cards List */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[650px] pr-1">
                  {colLeads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white/50 p-6 text-center text-xs text-slate-400">
                      No active prospects in this stage
                    </div>
                  ) : (
                    <>
                      {visibleLeads.map((lead) => (
                        <KanbanCard
                          key={lead.id}
                          lead={lead}
                          onSelectLead={onSelectLead}
                          onMoveStage={handleMoveStage}
                          isFirstStage={colIndex === 0}
                          isLastStage={colIndex === stages.length - 1}
                        />
                      ))}
                      {hasMore && (
                        <button
                          type="button"
                          onClick={() => toggleColumnExpand(col.id)}
                          className="w-full py-2 px-3 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors text-center"
                        >
                          {isExpanded ? 'Show fewer deals' : `+ Show ${colLeads.length - 4} more deals`}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Quick Add Deal */}
      {showAddDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-600" />
                Add Opportunity to Pipeline
              </h3>
              <button
                onClick={() => setShowAddDealModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {dealError && (
              <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-2 text-xs font-medium text-rose-700">
                {dealError}
              </div>
            )}

            <form onSubmit={handleCreateDeal} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-medium mb-1">Prospect Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rachel Adams"
                  value={newDealForm.name}
                  onChange={(e) => setNewDealForm({ ...newDealForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Company *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Cloud Corp"
                  value={newDealForm.company}
                  onChange={(e) =>
                    setNewDealForm({ ...newDealForm, company: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Job Title</label>
                <input
                  type="text"
                  placeholder="e.g. VP of Revenue"
                  value={newDealForm.title}
                  onChange={(e) => setNewDealForm({ ...newDealForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Deal Value ($)</label>
                <input
                  type="number"
                  value={newDealForm.dealValue}
                  onChange={(e) =>
                    setNewDealForm({ ...newDealForm, dealValue: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-700 font-medium mb-1">Initial Stage</label>
                <select
                  value={newDealForm.stage}
                  onChange={(e) =>
                    setNewDealForm({ ...newDealForm, stage: e.target.value as LeadStatus })
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  {stages.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDealModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-700"
                >
                  Save Opportunity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
