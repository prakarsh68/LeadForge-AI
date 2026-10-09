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

  // Agentic Dispatch & Model State
  const [showAgenticModal, setShowAgenticModal] = useState<boolean>(false);
  const [agenticLeadId, setAgenticLeadId] = useState<string>('');
  const [agenticCustomPrompt, setAgenticCustomPrompt] = useState<string>('');
  const [agenticAutoCrm, setAgenticAutoCrm] = useState<boolean>(true);
  const [isAgenticSending, setIsAgenticSending] = useState<boolean>(false);
  const [agenticResult, setAgenticResult] = useState<any | null>(null);
  const [showAgenticResultModal, setShowAgenticResultModal] = useState<boolean>(false);

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
      const updatedSeq: OutreachSequence =
        (result && (result as any).id)
          ? (result as any)
          : ((result as any)?.sequence || (result as any)?.data);

      if (updatedSeq && updatedSeq.id) {
        setSequences((prev) => prev.map((s) => (s.id === seqId ? updatedSeq : s)));
      } else {
        const reloaded = await api.getOutreachSequence(seqId);
        setSequences((prev) => prev.map((s) => (s.id === seqId ? reloaded : s)));
      }

      showToast(`Step message successfully dispatched! ID: ${(result as any)?.messageId || 'simulated'}`);
      // Refresh analytics
      api.getOutreachAnalytics().then((a) => setAnalytics(a)).catch(() => {});
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      setErrorMessage(`Dispatch failed: ${err.message}`);
    }
  };

  const handleAgenticSend = async (options?: { seqId?: string; leadId?: string }) => {
    setIsAgenticSending(true);
    setErrorMessage(null);
    try {
      const targetSeqId = options?.seqId || (showAgenticModal ? undefined : selectedSequenceId || undefined);
      const targetLeadId = options?.leadId || agenticLeadId || (options?.seqId ? undefined : currentSequence?.leadId);

      const res = await api.agenticSendOutreach({
        sequenceId: targetSeqId,
        leadId: targetLeadId,
        customInstructions: agenticCustomPrompt || undefined,
        autoSyncCrm: agenticAutoCrm,
      });

      if (res.sequence) {
        setSequences((prev) => {
          const exists = prev.some((s) => s.id === res.sequence!.id);
          return exists
            ? prev.map((s) => (s.id === res.sequence!.id ? res.sequence! : s))
            : [res.sequence!, ...prev];
        });
        setSelectedSequenceId(res.sequence.id);
      }

      setAgenticResult(res);
      setShowAgenticModal(false);
      setShowAgenticResultModal(true);
      showToast(`Agentic model successfully dispatched message to ${res.recipientEmail}!`);

      // Refresh analytics and CRM status
      api.getOutreachAnalytics().then((a) => setAnalytics(a)).catch(() => {});
      api.getCrmStatus().then((st) => setCrmStatus(st)).catch(() => {});
      if (onRefreshLeads) onRefreshLeads();
    } catch (err: any) {
      setErrorMessage(`Agentic dispatch failed: ${err.message}`);
    } finally {
      setIsAgenticSending(false);
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
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
              <Send className="h-6 w-6 text-indigo-600" />
              Sales Engagement & Automated Outreach
            </h1>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-800 border border-indigo-200">
              Phase 5
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            Personalized evidence-grounded 3-step sequences, human approval controls, durable follow-ups, and HubSpot CRM synchronization.
          </p>
        </div>

        {/* Global Controls & Sync status */}
        <div className="flex flex-wrap items-center gap-2.5">
          {crmStatus && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs shadow-2xs">
              <Database className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-slate-600 font-medium">HubSpot:</span>
              <span className={crmStatus.isConfigured ? 'text-emerald-700 font-semibold' : 'text-slate-500 font-medium'}>
                {crmStatus.mode === 'real' ? 'Live Connected' : 'Demo Boundary'}
              </span>
            </div>
          )}

          <button
            onClick={loadData}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-2xs"
            title="Refresh outreach data"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>

          <button
            onClick={() => {
              setAgenticLeadId(currentSequence?.leadId || leads[0]?.id || '');
              setShowAgenticModal(true);
            }}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-bold text-white shadow-sm transition-all cursor-pointer"
            title="Launch autonomous agent to formulate grounded copy, verify deliverability, dispatch message, and sync CRM"
          >
            <Sparkles className="h-4 w-4 text-amber-300" />
            Autonomous Agentic Send
          </button>

          <button
            onClick={() => setShowEnrollModal(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-xs font-bold text-white shadow-sm hover:bg-indigo-700 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            Enroll Lead Sequence
          </button>
        </div>
      </div>

      {/* Notifications */}
      {actionNotice && (
        <div className="flex items-center gap-2.5 p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50 text-xs font-medium text-emerald-800 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>{actionNotice}</span>
        </div>
      )}
      {errorMessage && (
        <div className="flex items-center justify-between p-3.5 rounded-2xl border border-rose-200 bg-rose-50 text-xs font-medium text-rose-800 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-600 hover:text-rose-800 font-bold">
            Dismiss
          </button>
        </div>
      )}

      {/* KPI Funnel Header Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">Sequences</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{analytics?.funnel.enrolled ?? sequences.length}</div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
            <Layers className="h-3 w-3 text-indigo-600" />
            Active: {sequences.filter((s) => s.status === 'active' || s.status === 'approved').length}
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">Emails Sent</div>
          <div className="mt-1 text-2xl font-black text-slate-900">
            {(analytics?.funnel.step1Sent ?? 0) + (analytics?.funnel.step2Sent ?? 0) + (analytics?.funnel.step3Sent ?? 0)}
          </div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" />
            {analytics?.rates.deliveryRate ?? 100}% Delivered
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">Open Rate</div>
          <div className="mt-1 text-2xl font-black text-slate-900">{analytics?.rates.openRate ?? 0}%</div>
          <div className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
            <Mail className="h-3 w-3 text-sky-600" />
            {analytics?.funnel.opened ?? 0} Unique Opens
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">Reply Rate</div>
          <div className="mt-1 text-2xl font-black text-emerald-700">{analytics?.rates.replyRate ?? 0}%</div>
          <div className="mt-1 text-[11px] text-emerald-700 font-medium flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {analytics?.funnel.replied ?? 0} Replies
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">Meetings Booked</div>
          <div className="mt-1 text-2xl font-black text-amber-700">{analytics?.funnel.meetingBooked ?? 0}</div>
          <div className="mt-1 text-[11px] text-amber-800 font-medium flex items-center gap-1">
            <Award className="h-3 w-3" />
            {analytics?.rates.meetingRate ?? 0}% Meeting Conv.
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="text-[11px] font-semibold tracking-wider uppercase text-slate-500">Suppression</div>
          <div className="mt-1 text-2xl font-black text-slate-700">{suppressionList.length}</div>
          <div className="mt-1 text-[11px] text-rose-700 font-medium flex items-center gap-1">
            <ShieldAlert className="h-3 w-3" />
            Bounces & Opt-Outs
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex border-b border-slate-200 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('sequences')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'sequences' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Sequences & Review ({sequences.length})
        </button>
        <button
          onClick={() => setActiveTab('campaigns')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'campaigns' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Campaigns ({campaigns.length})
        </button>
        <button
          onClick={() => setActiveTab('suppression')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'suppression' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Suppression & Opt-Outs ({suppressionList.length})
        </button>
        <button
          onClick={() => setActiveTab('analytics')}
          className={`pb-3 relative transition-colors ${
            activeTab === 'analytics' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-800'
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
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter lead or subject..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-2.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-700 focus:outline-none focus:border-indigo-500"
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
                <div className="p-8 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 text-xs bg-white">
                  No outreach sequences match your filters.
                </div>
              ) : (
                filteredSequences.map((seq) => {
                  const isSelected = seq.id === currentSequence?.id;
                  const leadName = seq.lead?.name || 'Unassigned Lead';
                  const company = seq.lead?.company || 'Company';
                  const statusColors: Record<string, string> = {
                    draft: 'bg-slate-100 text-slate-700 border-slate-200',
                    approved: 'bg-indigo-50 text-indigo-800 border-indigo-200',
                    scheduled: 'bg-sky-50 text-sky-800 border-sky-200',
                    active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                    completed: 'bg-blue-50 text-blue-800 border-blue-200',
                    stopped_on_reply: 'bg-purple-50 text-purple-800 border-purple-200',
                    stopped_on_opt_out: 'bg-rose-50 text-rose-800 border-rose-200',
                    failed: 'bg-rose-50 text-rose-800 border-rose-200',
                    paused: 'bg-amber-50 text-amber-800 border-amber-200',
                  };

                  return (
                    <div
                      key={seq.id}
                      onClick={() => handleSelectSequence(seq.id)}
                      className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-50/50 shadow-sm'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-sm text-slate-900">{leadName}</div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            statusColors[seq.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          {seq.status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="text-xs text-slate-500 mt-0.5">{company}</div>

                      <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-slate-700">Step {seq.currentStep} of {seq.maxSteps}</span>
                          <span className="text-slate-300">•</span>
                          <span>{seq.messages?.length || 0} drafts ready</span>
                        </div>

                        {seq.nextScheduledAt && (
                          <div className="flex items-center gap-1 text-slate-500">
                            <Clock className="h-3 w-3 text-sky-600" />
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
              <div className="p-5 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-5">
                {/* Lead Header & Actions Bar */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">{currentSequence.lead?.name}</h2>
                      {currentSequence.lead && (
                        <button
                          onClick={() => onSelectLead?.(currentSequence.lead!)}
                          className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold inline-flex items-center gap-0.5"
                        >
                          View Lead <ExternalLink className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">
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
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : opportunityScore.readinessTier === 'medium'
                            ? 'bg-amber-50 text-amber-800 border-amber-300'
                            : 'bg-slate-100 text-slate-700 border-slate-200'
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
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50 shadow-2xs"
                    >
                      <Database className="h-3.5 w-3.5 text-amber-500" />
                      {isSyncingCrm ? 'Syncing...' : 'Sync HubSpot'}
                    </button>
                  </div>
                </div>

                {/* Sequence Lifecycle Control Bar */}
                <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500 font-medium">Sequence Status:</span>
                    <span className="font-bold text-slate-800 uppercase tracking-wider text-[11px] px-2 py-0.5 rounded bg-white border border-slate-200 shadow-2xs">
                      {currentSequence.status.replace(/_/g, ' ')}
                    </span>
                    {currentSequence.stopReason && (
                      <span className="text-slate-500 italic">({currentSequence.stopReason})</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Agentic 1-Click Send & CRM Sync */}
                    {currentSequence.status !== 'completed' && currentSequence.status !== 'cancelled' && (
                      <button
                        onClick={() => handleAgenticSend({ seqId: currentSequence.id, leadId: currentSequence.leadId })}
                        disabled={isAgenticSending}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold transition-all shadow-xs disabled:opacity-50 text-xs cursor-pointer"
                        title="Agentic Send: Validates compliance, crafts grounded copy, dispatches email, and syncs HubSpot CRM"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                        {isAgenticSending ? 'Agent Sending & Syncing...' : `Agentic Send Step ${currentSequence.currentStep} & Sync CRM`}
                      </button>
                    )}

                    {currentSequence.status === 'draft' && (
                      <button
                        onClick={() => handleApproveSequence(currentSequence.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Approve & Launch
                      </button>
                    )}

                    {(currentSequence.status === 'approved' || currentSequence.status === 'active') && (
                      <>
                        <button
                          onClick={() => handleSendNow(currentSequence.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors shadow-xs"
                        >
                          <Send className="h-3.5 w-3.5" />
                          Send Step {currentSequence.currentStep} Now
                        </button>

                        <button
                          onClick={() => handlePauseSequence(currentSequence.id)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-colors"
                        >
                          <PauseCircle className="h-3.5 w-3.5 text-amber-500" />
                          Pause
                        </button>
                      </>
                    )}

                    {currentSequence.status === 'paused' && (
                      <button
                        onClick={() => handleResumeSequence(currentSequence.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-colors"
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
                            ? 'border-indigo-500 bg-indigo-50/70 text-indigo-950 font-bold shadow-2xs'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-[11px] font-bold uppercase tracking-wider">{stepLabels[stepNum - 1]}</div>
                        <div className="mt-1 flex items-center justify-between text-xs">
                          <span className="capitalize text-[11px] text-slate-500">{stepMsg?.status || 'Draft'}</span>
                          {stepMsg?.sentAt && <CheckCircle2 className="h-3 w-3 text-emerald-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Message Step Draft Editor */}
                {currentMessage ? (
                  <div className="space-y-4 pt-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Subject Line</label>
                      <input
                        type="text"
                        value={editingSubject}
                        onChange={(e) => setEditingSubject(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">Message Body (Plain Text / HTML Grounded)</label>
                        <button
                          onClick={handleSaveMessageEdits}
                          disabled={isSavingMessage}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors disabled:opacity-50"
                        >
                          {isSavingMessage ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                      <textarea
                        rows={9}
                        value={editingBody}
                        onChange={(e) => setEditingBody(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-800 font-mono leading-relaxed focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    {/* Evidence Inspector Drawer */}
                    <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/30 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                          <Sparkles className="h-4 w-4 text-indigo-600" />
                          Personalization Evidence Inspector
                        </span>
                        <span className="text-[10px] text-indigo-700 uppercase font-semibold">
                          Grounding References ({currentMessage.personalizationEvidence?.length || 0})
                        </span>
                      </div>

                      {currentMessage.personalizationEvidence && currentMessage.personalizationEvidence.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {currentMessage.personalizationEvidence.map((ev, idx) => (
                            <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-white text-[11px] space-y-1 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-slate-800 truncate">{ev.title}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 uppercase font-semibold">
                                  {ev.type.replace(/_/g, ' ')}
                                </span>
                              </div>
                              <p className="text-slate-600 line-clamp-2 italic">"{ev.excerpt}"</p>
                              <div className="text-[10px] text-slate-400">Confidence: {Math.round(ev.confidence * 100)}%</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">No specific evidence attached to this step draft.</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="p-6 text-center text-xs text-slate-500">No message drafted for Step {selectedStepNumber}.</div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center rounded-2xl border border-dashed border-slate-300 text-slate-500 text-sm bg-white">
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
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">Configured Outreach Campaigns</h3>
            <button
              onClick={() => setShowCampaignModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              New Campaign
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {campaigns.map((camp) => (
              <div key={camp.id} className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{camp.name}</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
                    {camp.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{camp.description || 'No description provided.'}</p>
                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-600">
                  <span>Enrolled: {camp.stats?.totalSequences || 0}</span>
                  <span>Sent: {camp.stats?.sentCount || 0}</span>
                  <span className="text-emerald-700 font-semibold">Replies: {camp.stats?.replyRate || 0}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: Suppression List */}
      {activeTab === 'suppression' && (
        <div className="space-y-4">
          <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Compliance & Suppression List</h3>
                <p className="text-xs text-slate-500">
                  Emails in this registry are strictly barred from receiving outbound messages. Automatically enforced on pre-send.
                </p>
              </div>

              <form onSubmit={handleAddSuppression} className="flex items-center gap-2">
                <input
                  type="email"
                  placeholder="prospect@company.com"
                  value={newSuppressionEmail}
                  onChange={(e) => setNewSuppressionEmail(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-xs font-bold text-white transition-colors shadow-sm"
                >
                  Add Opt-Out
                </button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 px-3">Email Address</th>
                    <th className="py-2.5 px-3">Reason</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3">Date Added</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {suppressionList.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.email}</td>
                      <td className="py-2.5 px-3 capitalize text-slate-500">{item.reason}</td>
                      <td className="py-2.5 px-3 text-slate-400">{item.source}</td>
                      <td className="py-2.5 px-3 text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          onClick={() => handleRemoveSuppression(item.id, item.email)}
                          className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
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
            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-2 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Delivery & Bounce Rate</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-slate-900">{analytics.rates.deliveryRate}%</span>
                <span className="text-xs text-rose-600">({analytics.rates.bounceRate}% bounce)</span>
              </div>
              <p className="text-xs text-slate-500">Percentage of dispatched emails successfully delivered to mailboxes.</p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-2 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Engagement & Response</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-emerald-700">{analytics.rates.replyRate}%</span>
                <span className="text-xs text-slate-500">reply rate</span>
              </div>
              <p className="text-xs text-slate-500">
                Average velocity to first reply: <strong className="text-slate-800">{analytics.velocity.averageDaysToFirstReply} days</strong>
              </p>
            </div>

            <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-2 shadow-xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Meeting Conversion</span>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-amber-700">{analytics.rates.meetingRate}%</span>
                <span className="text-xs text-slate-500">booked</span>
              </div>
              <p className="text-xs text-slate-500">
                Average velocity to booked meeting: <strong className="text-slate-800">{analytics.velocity.averageDaysToMeeting} days</strong>
              </p>
            </div>
          </div>

          {/* Source-to-Outcome Attribution Table */}
          <div className="p-5 rounded-2xl border border-slate-200 bg-white space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-indigo-600" />
                Source-to-Outcome Attribution Breakdown
              </h3>
              <span className="text-xs text-slate-500">Performance segmented by Discovery Provider & ICP Tier</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="py-2.5 px-3">Source Provider</th>
                    <th className="py-2.5 px-3">ICP Fit Tier</th>
                    <th className="py-2.5 px-3">Enrolled Leads</th>
                    <th className="py-2.5 px-3">Replies</th>
                    <th className="py-2.5 px-3">Reply Rate</th>
                    <th className="py-2.5 px-3">Meetings</th>
                    <th className="py-2.5 px-3 text-right">Meeting Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {analytics.attribution.map((attr, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800 capitalize">{attr.sourceProvider}</td>
                      <td className="py-2.5 px-3 capitalize">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            attr.tier === 'high'
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : attr.tier === 'medium'
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-slate-100 text-slate-700 border border-slate-200'
                          }`}
                        >
                          {attr.tier}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-slate-800 font-bold">{attr.leadCount}</td>
                      <td className="py-2.5 px-3 text-slate-600">{attr.replyCount}</td>
                      <td className="py-2.5 px-3 font-semibold text-emerald-700">{attr.replyRate}%</td>
                      <td className="py-2.5 px-3 text-slate-600">{attr.meetingCount}</td>
                      <td className="py-2.5 px-3 text-right font-bold text-amber-700">{attr.meetingRate}%</td>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-lg p-6 rounded-2xl border border-slate-200 bg-white shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-600" />
              Enroll Lead into 3-Step Sequence
            </h3>
            <p className="text-xs text-slate-500">
              Select an account from your leads database. LeadForge will extract triggers and collateral excerpts to assemble grounded sequence drafts.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Target Lead</label>
                <select
                  value={enrollLeadId}
                  onChange={(e) => setEnrollLeadId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Custom Strategic Instructions (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Focus on series B expansion and Snowflake integration bottleneck..."
                  value={enrollCustomPrompt}
                  onChange={(e) => setEnrollCustomPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEnrollLead}
                disabled={!enrollLeadId || isEnrolling}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-colors disabled:opacity-50 shadow-sm"
              >
                {isEnrolling ? 'Generating Sequence...' : 'Generate 3-Step Draft'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Opportunity Score Factors */}
      {showScoreModal && opportunityScore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-xl p-6 rounded-2xl border border-slate-200 bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                <h3 className="text-base font-bold text-slate-900">Explainable Opportunity Scoring Breakdown</h3>
              </div>
              <button
                onClick={() => setShowScoreModal(false)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div>
                <span className="text-xs text-slate-500">Conversion Readiness</span>
                <div className="text-2xl font-black text-slate-900">{opportunityScore.score} / 100</div>
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-bold uppercase border ${
                  opportunityScore.readinessTier === 'high'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : opportunityScore.readinessTier === 'medium'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {opportunityScore.readinessTier} Readiness
              </span>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Scoring Pillars (100% Weight)</h4>
              {opportunityScore.factors.map((factor, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-white text-xs space-y-1 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-800">{factor.name}</span>
                    <span className="text-indigo-600 font-bold">
                      +{factor.contribution} pts (weight {factor.weight}%)
                    </span>
                  </div>
                  <p className="text-slate-600">{factor.summary}</p>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowScoreModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Campaign */}
      {showCampaignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <form
            onSubmit={handleCreateCampaign}
            className="w-full max-w-md p-6 rounded-2xl border border-slate-200 bg-white shadow-2xl space-y-4"
          >
            <h3 className="text-base font-bold text-slate-900">Create New Outreach Campaign</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campaign Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 FinTech Enterprise Expansion"
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Targeting series B payments companies with RevOps bottlenecks"
                  value={newCampaignDesc}
                  onChange={(e) => setNewCampaignDesc(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowCampaignModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white shadow-sm"
              >
                Create Campaign
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal: Autonomous Agentic Outreach */}
      {showAgenticModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-xl p-6 rounded-2xl border border-purple-200 bg-white shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-50 border border-purple-200 text-purple-600">
                  <Sparkles className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Autonomous Agentic Outreach & CRM Dispatch</h3>
                  <p className="text-xs text-purple-700">Phase 5 + 6B Autonomous Multichannel Execution</p>
                </div>
              </div>
              <button
                onClick={() => setShowAgenticModal(false)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            <p className="text-xs text-slate-600">
              The LeadForge AI Agent will evaluate lead triggers, retrieve collateral citations via RAG, verify CAN-SPAM deliverability, dispatch the message via the email provider, and synchronize CRM pipeline stages.
            </p>

            <div className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Select Target Prospect</label>
                <select
                  value={agenticLeadId}
                  onChange={(e) => setAgenticLeadId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:border-purple-500"
                >
                  <option value="">-- Choose Prospect --</option>
                  {leads.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} — {l.company} ({l.email || 'No email'}, {l.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selected Lead Profile Snapshot */}
              {(() => {
                const sel = leads.find((l) => l.id === agenticLeadId);
                if (!sel) return null;
                return (
                  <div className="p-3 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-1.5">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{sel.name} • {sel.title}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200">
                        {sel.tier.toUpperCase()} ICP ({sel.score}/100)
                      </span>
                    </div>
                    <div className="text-slate-500 flex items-center gap-2">
                      <span>Email: <strong className={sel.email ? 'text-emerald-700' : 'text-rose-700'}>{sel.email || 'Missing'}</strong></span>
                      <span>•</span>
                      <span>Company: {sel.company}</span>
                    </div>
                    {sel.triggers && sel.triggers.length > 0 && (
                      <div className="text-[11px] text-amber-700 font-medium">
                        Buying Trigger: {sel.triggers[0]}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Strategic Guidance / Prompt Overrides (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Highlight series B revenue expansion, emphasize 3-minute setup, and ask for a 10-minute intro..."
                  value={agenticCustomPrompt}
                  onChange={(e) => setAgenticCustomPrompt(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <input
                  type="checkbox"
                  id="agenticAutoCrm"
                  checked={agenticAutoCrm}
                  onChange={(e) => setAgenticAutoCrm(e.target.checked)}
                  className="rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="agenticAutoCrm" className="text-xs text-slate-700 flex items-center gap-1.5 cursor-pointer font-medium">
                  <Database className="h-3.5 w-3.5 text-amber-500" />
                  Automatically synchronize contact, stage, and deal records to HubSpot CRM upon send
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-200">
              <button
                onClick={() => setShowAgenticModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAgenticSend({ leadId: agenticLeadId })}
                disabled={!agenticLeadId || isAgenticSending}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-xs font-bold text-white transition-all disabled:opacity-50 cursor-pointer shadow-sm"
              >
                <Sparkles className="h-4 w-4 text-amber-300" />
                {isAgenticSending ? 'Executing Agentic Pipeline...' : 'Execute Agentic Send & CRM Sync'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Agentic Execution Result & Trace */}
      {showAgenticResultModal && agenticResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in">
          <div className="w-full max-w-2xl p-6 rounded-2xl border border-emerald-200 bg-white shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Autonomous Agentic Outreach Dispatched</h3>
                  <p className="text-xs text-emerald-700">Message successfully transmitted & CRM state updated</p>
                </div>
              </div>
              <button
                onClick={() => setShowAgenticResultModal(false)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Close
              </button>
            </div>

            {/* Quick Summary Pill Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Recipient</span>
                <span className="font-semibold text-slate-900 truncate block">{agenticResult.recipientEmail}</span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Sequence Step</span>
                <span className="font-semibold text-indigo-700 block">Step {agenticResult.stepNumber} of 3</span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Provider ID</span>
                <span className="font-semibold text-sky-700 truncate block">{agenticResult.messageId || 'simulated'}</span>
              </div>
              <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">HubSpot CRM</span>
                <span className="font-semibold text-amber-700 block">
                  {agenticResult.crmRecord ? 'Synchronized' : 'Skipped'}
                </span>
              </div>
            </div>

            {/* Agentic Execution Trace List */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-purple-600" />
                Agentic Pipeline Execution Trace ({agenticResult.trace?.length || 0} stages)
              </h4>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {(agenticResult.trace || []).map((t: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-xl border border-slate-200 bg-slate-50 flex items-start gap-2.5 text-xs"
                  >
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-800">{t.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {new Date(t.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{t.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Message Preview */}
            <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-500">Dispatched Message Content</span>
                <span className="text-indigo-700 font-semibold">{agenticResult.emailSubject}</span>
              </div>
              <p className="text-slate-700 text-xs leading-relaxed italic bg-white p-2.5 rounded-lg border border-slate-200">
                "{agenticResult.emailPreview}..."
              </p>
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setShowAgenticResultModal(false)}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs font-bold text-white transition-colors cursor-pointer shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

