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
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80',
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Kanban className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-white">
              Autonomous Deal Pipeline
            </h2>
            <p className="text-xs text-slate-400">
              Active opportunities progressed by LeadForge outbound sequences
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 self-start sm:self-auto">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 px-3.5 py-1.5 text-right">
            <div className="text-[10px] text-slate-400 font-semibold uppercase">Total Pipeline</div>
            <div className="text-sm font-extrabold text-white font-mono">
              ${totalPipelineValue.toLocaleString()}
            </div>
          </div>

          <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/30 px-3.5 py-1.5 text-right">
            <div className="text-[10px] text-emerald-400 font-semibold uppercase">Closed Won</div>
            <div className="text-sm font-extrabold text-emerald-400 font-mono">
              ${totalWonValue.toLocaleString()}
            </div>
          </div>

          <button
            onClick={() => setShowAddDealModal(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 px-3.5 py-2 text-xs font-bold text-white shadow-md shadow-indigo-600/30 transition-all active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Opportunity</span>
          </button>
        </div>
      </div>

      {/* Search Filter Bar */}
      <div className="flex items-center justify-between rounded-xl border border-slate-800/80 bg-slate-900/60 p-3">
        <div className="relative w-full max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Filter pipeline by deal or company..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-800 bg-slate-950/80 pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="text-xs text-slate-400 hidden sm:block">
          Showing <span className="text-white font-bold">{filteredLeads.length}</span> active deals across 5 stages
        </div>
      </div>

      {/* Kanban Board Container (Horizontally Scrollable) */}
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-[1100px]">
          {pipelineColumns.map((col) => {
            const colLeads = filteredLeads.filter((l) => l.status === col.id);
            const colTotalVal = colLeads.reduce((sum, l) => sum + l.dealValue, 0);
            const colIndex = stages.indexOf(col.id);

            return (
              <div
                key={col.id}
                className="flex flex-1 flex-col rounded-2xl border border-slate-800/80 bg-slate-950/40 p-3 min-w-[220px]"
              >
                {/* Column Header */}
                <div className={`rounded-xl border p-3 mb-3 ${col.color}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-100">{col.title}</span>
                    <span className="rounded-md bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold text-white font-mono">
                      {colLeads.length}
                    </span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-300 font-mono font-medium">
                    ${colTotalVal.toLocaleString()} ARR
                  </div>
                </div>

                {/* Cards List */}
                <div className="flex-1 space-y-3 overflow-y-auto max-h-[650px] pr-1">
                  {colLeads.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-xs text-slate-500">
                      No active prospects in this stage
                    </div>
                  ) : (
                    colLeads.map((lead) => (
                      <KanbanCard
                        key={lead.id}
                        lead={lead}
                        onSelectLead={onSelectLead}
                        onMoveStage={handleMoveStage}
                        isFirstStage={colIndex === 0}
                        isLastStage={colIndex === stages.length - 1}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Quick Add Deal */}
      {showAddDealModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-400" />
                Add Opportunity to Pipeline
              </h3>
              <button
                onClick={() => setShowAddDealModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {dealError && (
              <div className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2 text-xs font-medium text-rose-300">
                {dealError}
              </div>
            )}

            <form onSubmit={handleCreateDeal} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Prospect Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Rachel Adams"
                  value={newDealForm.name}
                  onChange={(e) => setNewDealForm({ ...newDealForm, name: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Company *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme Cloud Corp"
                  value={newDealForm.company}
                  onChange={(e) =>
                    setNewDealForm({ ...newDealForm, company: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Job Title</label>
                <input
                  type="text"
                  placeholder="e.g. VP of Revenue"
                  value={newDealForm.title}
                  onChange={(e) => setNewDealForm({ ...newDealForm, title: e.target.value })}
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Deal Value ($)</label>
                <input
                  type="number"
                  value={newDealForm.dealValue}
                  onChange={(e) =>
                    setNewDealForm({ ...newDealForm, dealValue: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Initial Stage</label>
                <select
                  value={newDealForm.stage}
                  onChange={(e) =>
                    setNewDealForm({ ...newDealForm, stage: e.target.value as LeadStatus })
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-white focus:border-indigo-500 focus:outline-none"
                >
                  {stages.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddDealModal(false)}
                  className="rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-1.5 text-xs text-slate-300 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-indigo-500"
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
