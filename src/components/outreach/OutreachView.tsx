import React, { useState, useEffect, useCallback } from 'react';
import {
  Send,
  Mail,
  CheckCircle2,
  Clock,
  AlertCircle,
  PauseCircle,
  Play,
  Sparkles,
  ShieldAlert,
  Database,
  BarChart3,
  TrendingUp,
  Award,
  Layers,
  Search,
  Plus,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import type {
  Lead,
  OutreachCampaign,
  OutreachSequence,
  SuppressionItem,
  OpportunityScore,
  OutreachAnalytics,
  CrmStatus,
} from '../../types';
import { api } from '../../services/api';

interface OutreachViewProps {
  leads: Lead[];
  onSelectLead?: (lead: Lead) => void;
  onRefreshLeads?: () => void;
}

export const OutreachView: React.FC<OutreachViewProps> = ({
  leads,
  onSelectLead,
  onRefreshLeads,
}) => {
  const [activeTab, setActiveTab] = useState<'sequences' | 'campaigns' | 'suppression' | 'analytics'>('sequences');

  // Campaigns & Sequences State
  const [campaigns, setCampaigns] = useState<OutreachCampaign[]>([]);
  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(null);
  const [selectedStepNumber, setSelectedStepNumber] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected Message Editing State
  const [editingSubject, setEditingSubject] = useState<string>('');
  const [editingBody, setEditingBody] = useState<string>('');
  const [isSavingMessage, setIsSavingMessage] = useState<boolean>(false);

  // Suppression & Compliance State
  const [suppressionList, setSuppressionList] = useState<SuppressionItem[]>([]);
  const [newSuppressionEmail, setNewSuppressionEmail] = useState<string>('');

  // Analytics & CRM State
  const [analytics, setAnalytics] = useState<OutreachAnalytics | null>(null);
  const [crmStatus, setCrmStatus] = useState<CrmStatus | null>(null);

  // Opportunity Score Inspection
  const [opportunityScore, setOpportunityScore] = useState<OpportunityScore | null>(null);
  const [showScoreModal, setShowScoreModal] = useState<boolean>(false);

  // Modals & Operations
  const [showEnrollModal, setShowEnrollModal] = useState<boolean>(false);
  const [enrollLeadId, setEnrollLeadId] = useState<string>('');
  const [enrollCustomPrompt, setEnrollCustomPrompt] = useState<string>('');
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);

  const [showCampaignModal, setShowCampaignModal] = useState<boolean>(false);
  const [newCampaignName, setNewCampaignName] = useState<string>('');
  const [newCampaignDesc, setNewCampaignDesc] = useState<string>('');

  const [isSyncingCrm, setIsSyncingCrm] = useState<boolean>(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 3500);
  };

  const loadData = useCallback(async () => {
    setErrorMessage(null);
    try {
      const [camps, seqs, supp, an, crm] = await Promise.all([
        api.getOutreachCampaigns().catch(() => []),
        api.getOutreachSequences().catch(() => []),
        api.getSuppressionList().catch(() => []),
        api.getOutreachAnalytics().catch(() => null),
        api.getCrmStatus().catch(() => null),
      ]);

      setCampaigns(camps);
      setSequences(seqs);
      setSuppressionList(supp);
      if (an) setAnalytics(an);
      if (crm) setCrmStatus(crm);

      if (seqs.length > 0 && !selectedSequenceId) {
        setSelectedSequenceId(seqs[0].id);
        const firstMsg = seqs[0].messages?.find((m) => m.stepNumber === 1);
        if (firstMsg) {
          setEditingSubject(firstMsg.subject || '');
          setEditingBody(firstMsg.bodyText || '');
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load outreach workspace');
    }
  }, [selectedSequenceId]);

  useEffect(() => {
    let ignore = false;
    async function fetchAll() {
      try {
        const [camps, seqs, supp, an, crm] = await Promise.all([
          api.getOutreachCampaigns().catch(() => []),
          api.getOutreachSequences().catch(() => []),
          api.getSuppressionList().catch(() => []),
          api.getOutreachAnalytics().catch(() => null),
          api.getCrmStatus().catch(() => null),
        ]);
        if (ignore) return;
        setCampaigns(camps);
        setSequences(seqs);
        setSuppressionList(supp);
        if (an) setAnalytics(an);
        if (crm) setCrmStatus(crm);

        if (seqs.length > 0 && !selectedSequenceId) {
          setSelectedSequenceId(seqs[0].id);
          const firstMsg = seqs[0].messages?.find((m) => m.stepNumber === 1);
          if (firstMsg) {
            setEditingSubject(firstMsg.subject || '');
            setEditingBody(firstMsg.bodyText || '');
          }
        }
      } catch (err: any) {
        if (!ignore) setErrorMessage(err.message || 'Failed to load outreach workspace');
      }
    }
    void fetchAll();
    return () => {
      ignore = true;
    };
  }, [selectedSequenceId]);

  // Currently selected sequence
  const currentSequence = sequences.find((s) => s.id === selectedSequenceId) || sequences[0] || null;
  const currentMessage = currentSequence?.messages?.find((m) => m.stepNumber === selectedStepNumber) || currentSequence?.messages?.[0] || null;

  const handleSelectSequence = (seqId: string) => {
    setSelectedSequenceId(seqId);
    const seq = sequences.find((s) => s.id === seqId);
    const msg = seq?.messages?.find((m) => m.stepNumber === selectedStepNumber) || seq?.messages?.[0];
    if (msg) {
      setEditingSubject(msg.subject || '');
      setEditingBody(msg.bodyText || '');
    }
  };

  const handleSelectStep = (stepNum: number) => {
    setSelectedStepNumber(stepNum);
    const msg = currentSequence?.messages?.find((m) => m.stepNumber === stepNum);
    if (msg) {
      setEditingSubject(msg.subject || '');
      setEditingBody(msg.bodyText || '');
    }
  };

  // Load opportunity score for selected sequence's lead
  useEffect(() => {
    let ignore = false;
    const leadId = currentSequence?.leadId;
    if (leadId) {
      api
        .getOpportunityScore(leadId)
        .then((sc) => {
          if (!ignore) setOpportunityScore(sc);
        })
        .catch(() => {
          if (!ignore) setOpportunityScore(null);
        });
    }
    return () => {
      ignore = true;
    };
  }, [currentSequence?.leadId]);

  // Action Handlers
  const handleApproveSequence = async (seqId: string) => {
    try {
      const updated = await api.approveOutreachSequence(seqId);
      setSequences((prev) => prev.map((s) => (s.id === seqId ? updated : s)));
      showToast('Sequence approved and scheduled for automated delivery.');
    } catch (err: any) {
      setErrorMessage(`Failed to approve: ${err.message}`);
    }
  };

  const handlePauseSequence = async (seqId: string) => {
    try {
      const updated = await api.pauseOutreachSequence(seqId);
      setSequences((prev) => prev.map((s) => (s.id === seqId ? updated : s)));
      showToast('Sequence execution paused.');
    } catch (err: any) {
      setErrorMessage(`Failed to pause: ${err.message}`);
    }
  };

  const handleResumeSequence = async (seqId: string) => {
    try {
      const updated = await api.resumeOutreachSequence(seqId);
      setSequences((prev) => prev.map((s) => (s.id === seqId ? updated : s)));
      showToast('Sequence resumed.');
    } catch (err: any) {
      setErrorMessage(`Failed to resume: ${err.message}`);
    }
  };

  const handleSendNow = async (seqId: string) => {
    try {
      const result = await api.sendOutreachSequenceNow(seqId);
      setSequences((prev) => prev.map((s) => (s.id === seqId ? result.data : s)));
      showToast(`Step message successfully dispatched! ID: ${result.messageId || 'simulated'}`);
      // Refresh analytics
      api.getOutreachAnalytics().then((a) => setAnalytics(a)).catch(() => {});
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      setErrorMessage(`Dispatch failed: ${err.message}`);
    }
  };

  const handleSaveMessageEdits = async () => {
    if (!currentSequence || !currentMessage) return;
    setIsSavingMessage(true);
    try {
      await api.updateOutreachMessage(currentSequence.id, currentMessage.stepNumber, {
        subject: editingSubject,
        bodyText: editingBody,
      });
      // Refresh sequence
      const updatedSeq = await api.getOutreachSequence(currentSequence.id);
      setSequences((prev) => prev.map((s) => (s.id === updatedSeq.id ? updatedSeq : s)));
      showToast('Message step updated successfully.');
    } catch (err: any) {
      setErrorMessage(`Failed to save edits: ${err.message}`);
    } finally {
      setIsSavingMessage(false);
    }
  };

  const handleEnrollLead = async () => {
    if (!enrollLeadId) return;
    setIsEnrolling(true);
    try {
      const newSeq = await api.createOutreachSequence({
        leadId: enrollLeadId,
        campaignId: campaigns[0]?.id || undefined,
        generateDrafts: true,
        customInstructions: enrollCustomPrompt || undefined,
      });
      setSequences((prev) => [newSeq, ...prev]);
      setSelectedSequenceId(newSeq.id);
      setShowEnrollModal(false);
      setEnrollLeadId('');
      setEnrollCustomPrompt('');
      showToast('Lead enrolled with 3 evidence-grounded sequence drafts.');
    } catch (err: any) {
      setErrorMessage(`Failed to enroll lead: ${err.message}`);
    } finally {
      setIsEnrolling(false);
    }
  };

  const handleSyncToCrm = async (leadId: string) => {
    setIsSyncingCrm(true);
    try {
      const record = await api.syncLeadToCrm(leadId);
      showToast(`Synchronized with HubSpot CRM (${record.syncStatus}). External ID: ${record.externalContactId || 'Synced'}`);
      api.getCrmStatus().then((st) => setCrmStatus(st)).catch(() => {});
    } catch (err: any) {
      setErrorMessage(`CRM sync error: ${err.message}`);
    } finally {
      setIsSyncingCrm(false);
    }
  };

  const handleAddSuppression = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSuppressionEmail || !newSuppressionEmail.includes('@')) return;
    try {
      const item = await api.addSuppressionItem({
        email: newSuppressionEmail.trim().toLowerCase(),
        reason: 'manual',
        source: 'user_console',
      });
      setSuppressionList((prev) => [item, ...prev]);
      setNewSuppressionEmail('');
      showToast(`Added ${item.email} to suppression list.`);
    } catch (err: any) {
      setErrorMessage(`Failed to suppress email: ${err.message}`);
    }
  };

  const handleRemoveSuppression = async (id: string, email: string) => {
    try {
      await api.removeSuppressionItem(id);
      setSuppressionList((prev) => prev.filter((item) => item.id !== id));
      showToast(`Removed ${email} from suppression list.`);
    } catch (err: any) {
      setErrorMessage(`Failed to remove: ${err.message}`);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCampaignName.trim()) return;
    try {
      const created = await api.createOutreachCampaign({
        name: newCampaignName.trim(),
        description: newCampaignDesc.trim(),
        status: 'active',
      });
      setCampaigns((prev) => [created, ...prev]);
      setShowCampaignModal(false);
      setNewCampaignName('');
      setNewCampaignDesc('');
      showToast(`Campaign "${created.name}" created.`);
    } catch (err: any) {
      setErrorMessage(`Failed to create campaign: ${err.message}`);
    }
  };

  // Filter sequences
  const filteredSequences = sequences.filter((seq) => {
    if (statusFilter !== 'all' && seq.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchLead = seq.lead?.name.toLowerCase().includes(q) || seq.lead?.company.toLowerCase().includes(q);
      const matchSub = seq.messages?.some((m) => m.subject.toLowerCase().includes(q));
      if (!matchLead && !matchSub) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner & Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
              <Send className="h-6 w-6 text-indigo-400" />
              Sales Engagement & Automated Outreach
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Phase 5
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Personalized evidence-grounded 3-step sequences, human approval controls, durable follow-ups, and HubSpot CRM synchronization.
          </p>
        </div>

        {/* Global Controls & Sync status */}
        <div className="flex flex-wrap items-center gap-2.5">
          {crmStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-700/60 bg-slate-900/60 text-xs">
              <Database className="h-3.5 w-3.5 text-amber-400" />
              <span className="text-slate-300">HubSpot:</span>
              <span className={crmStatus.isConfigured ? 'text-emerald-400 font-semibold' : 'text-slate-400 font-medium'}>
                {crmStatus.mode === 'real' ? 'Live Connected' : 'Demo Boundary'}
              </span>
            </div>
          )}

          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700/60 bg-slate-800 text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-700/80 transition-all"
            title="Refresh outreach data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            onClick={() => setShowEnrollModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 hover:from-indigo-500 hover:to-indigo-400 transition-all"
          >
            <Plus className="h-4 w-4" />
            Enroll Lead Sequence
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionNotice && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl border border-emerald-500/30 bg-emerald-950/40 text-xs font-medium text-emerald-300 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-rose-500/30 bg-rose-950/40 text-xs font-medium text-rose-300 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-rose-200">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Funnel Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Sequences</div>
          <div className="mt-1 text-2xl font-black text-white">{analytics?.funnel.enrolled ?? sequences.length}</div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <Layers className="h-3 w-3 text-indigo-400" />
            Active: {sequences.filter((s) => s.status === 'active' || s.status === 'approved').length}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Emails Sent</div>
          <div className="mt-1 text-2xl font-black text-white">
            {(analytics?.funnel.step1Sent ?? 0) + (analytics?.funnel.step2Sent ?? 0) + (analytics?.funnel.step3Sent ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {analytics?.rates.deliveryRate ?? 100}% Delivered
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Open Rate</div>
          <div className="mt-1 text-2xl font-black text-white">{analytics?.rates.openRate ?? 0}%</div>
          <div className="mt-1 text-[11px] text-slate-400 flex items-center gap-1">
            <Mail className="h-3 w-3 text-cyan-400" />
            {analytics?.funnel.opened ?? 0} Unique Opens
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Reply Rate</div>
          <div className="mt-1 text-2xl font-black text-emerald-400">{analytics?.rates.replyRate ?? 0}%</div>
          <div className="mt-1 text-[11px] text-emerald-400 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {analytics?.funnel.replied ?? 0} Replies
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Meetings Booked</div>
          <div className="mt-1 text-2xl font-black text-amber-400">{analytics?.funnel.meetingBooked ?? 0}</div>
          <div className="mt-1 text-[11px] text-amber-400 flex items-center gap-1">
            <Award className="h-3 w-3" />
            {analytics?.rates.meetingRate ?? 0}% Meeting Conv.
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-800/80 bg-slate-900/60 backdrop-blur-sm">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-400">Suppression</div>
          <div className="mt-1 text-2xl font-black text-slate-300">{suppressionList.length}</div>
          <div className="mt-1 text-[11px] text-rose-400 flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" />
            Bounces & Opt-Outs
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('sequences')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'sequences' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Sequences & Review ({sequences.length})
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'campaigns' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab('suppression')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'suppression' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Suppression & Opt-Outs ({suppressionList.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'analytics' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          Analytics & Performance
        </button>
      </div>

      {/* TAB 1: Sequences & Review */}
      {activeTab === 'sequences' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Sequences Queue Column (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Filter lead or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-800 bg-slate-900/80 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">All Statuses</option>
                <option value="draft">Draft</option>
                <option value="approved">Approved</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="stopped_on_reply">Replied</option>
                <option value="stopped_on_opt_out">Opted Out</option>
                <option value="failed">Failed</option>
              </select>
            </div>

            {/* Sequence Cards List */}
            <div className="space-y-2.5 max-h-[750px] overflow-y-auto pr-1">
              {filteredSequences.length === 0 ? (
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-800 text-slate-500 text-xs">
                  No outreach sequences match your filters.
                </div>
              ) : (
                filteredSequences.map((seq) => {
                  const isSelected = seq.id === currentSequence?.id;
                  const leadName = seq.lead?.name || 'Unassigned Lead';
                  const company = seq.lead?.company || 'Company';
                  const statusColors: Record<string, string> = {
                    draft: 'bg-slate-800 text-slate-300 border-slate-700',
                    approved: 'bg-indigo-950/60 text-indigo-300 border-indigo-700/50',
                    scheduled: 'bg-cyan-950/60 text-cyan-300 border-cyan-700/50',
                    active: 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50',
                    completed: 'bg-blue-950/60 text-blue-300 border-blue-700/50',
                    stopped_on_reply: 'bg-purple-950/60 text-purple-300 border-purple-700/50',
                    stopped_on_opt_out: 'bg-rose-950/60 text-rose-300 border-rose-700/50',
                    failed: 'bg-rose-950/60 text-rose-300 border-rose-700/50',
                    paused: 'bg-amber-950/60 text-amber-300 border-amber-700/50',
                  };

                  return (
                    <div
                      key={seq.id}
                      onClick={() => handleSelectSequence(seq.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-500/80 bg-indigo-950/20 shadow-lg shadow-indigo-950/30'
                          : 'border-slate-800/80 bg-slate-900/50 hover:border-slate-700 hover:bg-slate-900/80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-white">{leadName}</div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            statusColors[seq.status] || 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {seq.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="text-xs text-slate-400 mt-0.5">{company}</div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-300">Step {seq.currentStep} of {seq.maxSteps}</span>
                          <span className="text-slate-600">•</span>
                          <span>{seq.messages?.length || 0} drafts ready</span>
                        </div>

                        {seq.nextScheduledAt && (
                          <div className="flex items-center gap-1 text-slate-400">
                            <Clock className="h-3 w-3 text-cyan-400" />
                            Next: {new Date(seq.nextScheduledAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Sequence Editor & Evidence Inspector Column (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            {currentSequence ? (
              <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/70 backdrop-blur-sm space-y-5">
                {/* Lead Header & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-800 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-white">{currentSequence.lead?.name}</h2>
                      {currentSequence.lead && (
                        <button
                          onClick={() => onSelectLead?.(currentSequence.lead!)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-0.5"
                        >
                          View Lead <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-400">
                      {currentSequence.lead?.title} • {currentSequence.lead?.company} ({currentSequence.lead?.industry})
                    </p>
                  </div>

                  {/* Top Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Opportunity Score Pill */}
                    {opportunityScore && (
                      <button
                        onClick={() => setShowScoreModal(true)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-colors ${
                          opportunityScore.readinessTier === 'high'
                            ? 'bg-emerald-950/50 text-emerald-300 border-emerald-500/40'
                            : opportunityScore.readinessTier === 'medium'
                            ? 'bg-amber-950/50 text-amber-300 border-amber-500/40'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                        title="Click to inspect explainable scoring factors"
                      >
                        <Award className="h-3.5 w-3.5" />
                        Score: {opportunityScore.score}/100 ({opportunityScore.readinessTier})
                      </button>
                    )}

                    {/* HubSpot CRM Sync */}
                    <button
                      onClick={() => handleSyncToCrm(currentSequence.leadId)}
                      disabled={isSyncingCrm}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-slate-700 bg-slate-800 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      <Database className="h-3.5 w-3.5 text-amber-400" />
                      {isSyncingCrm ? 'Syncing...' : 'Sync HubSpot'}
                    </button>
                  </div>
                </div>

                {/* Sequence Lifecycle Control Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">Sequence Status:</span>
                    <span className="font-bold text-white uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-slate-800">
                      {currentSequence.status.replace(/_/g, ' ')}
                    </span>
                    {currentSequence.stopReason && (
                      <span className="text-slate-400 italic">({currentSequence.stopReason})</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {currentSequence.status === 'draft' && (
                      <button
                        onClick={() => handleApproveSequence(currentSequence.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve & Launch
                      </button>
                    )}

                    {(currentSequence.status === 'approved' || currentSequence.status === 'active') && (
                      <>
                        <button
                          onClick={() => handleSendNow(currentSequence.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send Step {currentSequence.currentStep} Now
                        </button>

                        <button
                          onClick={() => handlePauseSequence(currentSequence.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 hover:bg-slate-800 text-slate-300 transition-colors"
                        >
                          <PauseCircle className="h-3.5 w-3.5 text-amber-400" />
                          Pause
                        </button>
                      </>
                    )}

                    {currentSequence.status === 'paused' && (
                      <button
                        onClick={() => handleResumeSequence(currentSequence.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-colors"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Resume Sequence
                      </button>
                    )}
                  </div>
                </div>

                {/* 3 Step Tabs Navigation */}
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((stepNum) => {
                    const isStepSelected = selectedStepNumber === stepNum;
                    const stepMsg = currentSequence.messages?.find((m) => m.stepNumber === stepNum);
                    const stepLabels = ['Step 1: Hook & Value Prop', 'Step 2: Social Proof & ROI', 'Step 3: Breakaway Inquiry'];

                    return (
                      <button
                        key={stepNum}
                        onClick={() => handleSelectStep(stepNum)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          isStepSelected
                            ? 'border-indigo-500 bg-indigo-950/40 text-white'
                            : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider">{stepLabels[stepNum - 1]}</div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="capitalize text-[11px] text-slate-300">{stepMsg?.status || 'Draft'}</span>
                          {stepMsg?.sentAt && <CheckCircle2 className="h-3 w-3 text-emerald-400" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Message Step Draft Editor */}
                {currentMessage ? (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">Subject Line</label>
                      <input
                        type="text"
                        value={editingSubject}
                        onChange={(e) => setEditingSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs font-medium text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-300">Message Body (Plain Text / HTML Grounded)</label>
                        <button
                          onClick={handleSaveMessageEdits}
                          disabled={isSavingMessage}
                          className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                        >
                          {isSavingMessage ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                      <textarea
                        rows={9}
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-slate-200 font-mono leading-relaxed focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Evidence Inspector Drawer */}
                    <div className="p-4 rounded-xl border border-indigo-950/80 bg-indigo-950/20 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-indigo-400" />
                          Personalization Evidence Inspector
                        </span>
                        <span className="text-[10px] text-indigo-400/80 uppercase font-semibold">
                          Grounding References ({currentMessage.personalizationEvidence?.length || 0})
                        </span>
                      </div>

                      {currentMessage.personalizationEvidence && currentMessage.personalizationEvidence.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {currentMessage.personalizationEvidence.map((ev, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/80 text-[11px] space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-200 truncate">{ev.title}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800/50 uppercase">
                                  {ev.type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <p className="text-slate-400 line-clamp-2 italic">"{ev.excerpt}"</p>
                              <div className="text-[10px] text-slate-500">Confidence: {Math.round(ev.confidence * 100)}%</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No specific evidence attached to this step draft.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-400">No message drafted for Step {selectedStepNumber}.</div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-800 text-slate-500 text-sm">
                Select a sequence from the left queue to inspect and edit outreach messages.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: Campaigns */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configured Outreach Campaigns</h3>
            <button
              onClick={() => setShowCampaignModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
            >
              <Plus className="h-3.5 w-3.5" />
              New Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((camp) => (
              <div key={camp.id} className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{camp.name}</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-950/60 text-emerald-400 border border-emerald-800">
                    {camp.status}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-2">{camp.description || 'No description provided.'}</p>
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-300">
                  <span>Enrolled: {camp.stats?.totalSequences || 0}</span>
                  <span>Sent: {camp.stats?.sentCount || 0}</span>
                  <span className="text-emerald-400 font-semibold">Replies: {camp.stats?.replyRate || 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Suppression List */}
      {activeTab === 'suppression' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Compliance & Suppression List</h3>
                <p className="text-xs text-slate-400">
                  Emails in this registry are strictly barred from receiving outbound messages. Automatically enforced on pre-send.
                </p>
              </div>

              <form onSubmit={handleAddSuppression} className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="prospect@company.com"
                  value={newSuppressionEmail}
                  onChange={(e) => setNewSuppressionEmail(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-bold text-white transition-colors"
                >
                  Add Opt-Out
                </button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Date Added</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {suppressionList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-slate-200">{item.email}</td>
                      <td className="py-2.5 px-3 capitalize text-slate-400">{item.reason}</td>
                      <td className="py-2.5 px-3 text-slate-500">{item.source}</td>
                      <td className="py-2.5 px-3 text-slate-500">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleRemoveSuppression(item.id, item.email)}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Analytics & Performance */}
      {activeTab === 'analytics' && analytics && (
        <div className="space-y-6">
          {/* Conversion Rates & Velocity */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Delivery & Bounce Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{analytics.rates.deliveryRate}%</span>
                <span className="text-xs text-rose-400">({analytics.rates.bounceRate}% bounce)</span>
              </div>
              <p className="text-xs text-slate-400">Percentage of dispatched emails successfully delivered to mailboxes.</p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Engagement & Response</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-400">{analytics.rates.replyRate}%</span>
                <span className="text-xs text-slate-400">reply rate</span>
              </div>
              <p className="text-xs text-slate-400">
                Average velocity to first reply: <strong>{analytics.velocity.averageDaysToFirstReply} days</strong>
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Meeting Conversion</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-400">{analytics.rates.meetingRate}%</span>
                <span className="text-xs text-slate-400">booked</span>
              </div>
              <p className="text-xs text-slate-400">
                Average velocity to booked meeting: <strong>{analytics.velocity.averageDaysToMeeting} days</strong>
              </p>
            </div>
          </div>

          {/* Source-to-Outcome Attribution Table */}
          <div className="p-5 rounded-2xl border border-slate-800 bg-slate-900/60 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-400" />
                Source-to-Outcome Attribution Breakdown
              </h3>
              <span className="text-xs text-slate-400">Performance segmented by Discovery Provider & ICP Tier</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="py-2.5 px-3">Source Provider</th>
                    <th className="py-2.5 px-3">ICP Fit Tier</th>
                    <th className="py-2.5 px-3">Enrolled Leads</th>
                    <th className="py-2.5 px-3">Replies</th>
                    <th className="py-2.5 px-3">Reply Rate</th>
                    <th className="py-2.5 px-3">Meetings</th>
                    <th className="py-2.5 px-3 text-right">Meeting Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {analytics.attribution.map((attr, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/30">
                      <td className="py-2.5 px-3 font-semibold text-slate-200 capitalize">{attr.sourceProvider}</td>
                      <td className="py-2.5 px-3 capitalize">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            attr.tier === 'high'
                              ? 'bg-emerald-950 text-emerald-400'
                              : attr.tier === 'medium'
                              ? 'bg-amber-950 text-amber-400'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {attr.tier}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 font-bold">{attr.leadCount}</td>
                      <td className="py-2.5 px-3 text-slate-300">{attr.replyCount}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-400">{attr.replyRate}%</td>
                      <td className="py-2.5 px-3 text-slate-300">{attr.meetingCount}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-400">{attr.meetingRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Enroll Lead */}
      {showEnrollModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-400" />
              Enroll Lead into 3-Step Sequence
            </h3>
            <p className="text-xs text-slate-400">
              Select an account from your leads database. LeadForge will extract triggers and collateral excerpts to assemble grounded sequence drafts.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Select Target Lead</label>
                <select
                  value={enrollLeadId}
                  onChange={(e) => setEnrollLeadId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Choose Lead --</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} — {l.company} ({l.tier} tier, {l.status})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Custom Strategic Instructions (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Focus on series B expansion and Snowflake integration bottleneck..."
                  value={enrollCustomPrompt}
                  onChange={(e) => setEnrollCustomPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollLead}
                disabled={!enrollLeadId || isEnrolling}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition-colors disabled:opacity-50"
              >
                {isEnrolling ? 'Generating Sequence...' : 'Generate 3-Step Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Opportunity Score Factors */}
      {showScoreModal && opportunityScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-xl p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-400" />
                <h3 className="text-base font-bold text-white">Explainable Opportunity Scoring Breakdown</h3>
              </div>
              <button
                onClick={() => setShowScoreModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <span className="text-xs text-slate-400">Conversion Readiness</span>
                <div className="text-2xl font-black text-white">{opportunityScore.score} / 100</div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                  opportunityScore.readinessTier === 'high'
                    ? 'bg-emerald-950 text-emerald-400 border-emerald-800'
                    : opportunityScore.readinessTier === 'medium'
                    ? 'bg-amber-950 text-amber-400 border-amber-800'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {opportunityScore.readinessTier} Readiness
              </span>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Scoring Pillars (100% Weight)</h4>
              {opportunityScore.factors.map((factor, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-800 bg-slate-950/40 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-200">{factor.name}</span>
                    <span className="text-indigo-400 font-bold">
                      +{factor.contribution} pts (weight {factor.weight}%)
                    </span>
                  </div>
                  <p className="text-slate-400">{factor.summary}</p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                onClick={() => setShowScoreModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-bold text-white hover:bg-slate-700"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Campaign */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-in fade-in">
          <form
            onSubmit={handleCreateCampaign}
            className="w-full max-w-md p-6 rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-white">Create New Outreach Campaign</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 FinTech Enterprise Expansion"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Targeting series B payments companies with RevOps bottlenecks"
                  value={newCampaignDesc}
                  onChange={(e) => setNewCampaignDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-700 bg-slate-950 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCampaignModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-700 text-xs font-semibold text-slate-300 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white"
              >
                Create Campaign
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

