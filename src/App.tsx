import React, { useState, useEffect, useCallback } from 'react';
import type { ViewType, Lead, LeadStatus, IcpProfile, KnowledgeDocument, ActivityItem, PipelineSummary } from './types';
import { api, ApiError } from './services/api';
import { storage } from './utils/storage';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { IcpSetupView } from './components/icp/IcpSetupView';
import { LeadsView } from './components/leads/LeadsView';
import { PipelineView } from './components/pipeline/PipelineView';
import { KnowledgeBaseView } from './components/knowledge/KnowledgeBaseView';
import { DiscoveryView } from './components/discovery/DiscoveryView';
import { OutreachView } from './components/outreach/OutreachView';
import { SettingsView } from './components/settings/SettingsView';
import { LandingPageView } from './components/landing/LandingPageView';
import { LeadDetailModal } from './components/leads/LeadDetailModal';
import { AlertTriangle, RefreshCw, X, CheckCircle2 } from 'lucide-react';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [leads, setLeads] = useState<Lead[]>(() => storage.getLeads());
  const [icpProfile, setIcpProfile] = useState<IcpProfile>(() => storage.getIcp());
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>(() => storage.getDocs());
  const [activities, setActivities] = useState<ActivityItem[]>(() => storage.getActivities());
  const [pipelineSummary, setPipelineSummary] = useState<PipelineSummary | null>(null);

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Loading and Network States
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isBackendConnected, setIsBackendConnected] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const showNotice = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 3500);
  };

  // Refresh from backend on user request
  const refreshFromBackend = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [leadsData, activeIcp, docsData, activitiesData, summaryData] = await Promise.all([
        api.getLeads().catch(() => null),
        api.getActiveIcp().catch(() => null),
        api.getKnowledgeDocs().catch(() => null),
        api.getActivities({ limit: 20 }).catch(() => null),
        api.getPipelineSummary().catch(() => null),
      ]);

      if (leadsData && leadsData.leads) {
        setLeads(leadsData.leads);
        storage.saveLeads(leadsData.leads);
      }
      if (activeIcp) {
        setIcpProfile(activeIcp);
        storage.saveIcp(activeIcp);
      }
      if (docsData) {
        setKnowledgeDocs(docsData);
        storage.saveDocs(docsData);
      }
      if (activitiesData) {
        setActivities(activitiesData);
        storage.saveActivities(activitiesData);
      }
      if (summaryData) {
        setPipelineSummary(summaryData);
      }

      setIsBackendConnected(true);
      showNotice('Synchronized with backend SQLite database.');
    } catch (err: any) {
      console.error('[API Connection Error]:', err);
      setIsBackendConnected(false);
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : 'Unable to connect to backend REST server. Displaying local cache.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load on mount
  useEffect(() => {
    let isMounted = true;

    async function initialFetch() {
      try {
        const [leadsData, activeIcp, docsData, activitiesData, summaryData] = await Promise.all([
          api.getLeads().catch(() => null),
          api.getActiveIcp().catch(() => null),
          api.getKnowledgeDocs().catch(() => null),
          api.getActivities({ limit: 20 }).catch(() => null),
          api.getPipelineSummary().catch(() => null),
        ]);

        if (!isMounted) return;

        if (leadsData && leadsData.leads) {
          setLeads(leadsData.leads);
          storage.saveLeads(leadsData.leads);
        }
        if (activeIcp) {
          setIcpProfile(activeIcp);
          storage.saveIcp(activeIcp);
        }
        if (docsData) {
          setKnowledgeDocs(docsData);
          storage.saveDocs(docsData);
        }
        if (activitiesData) {
          setActivities(activitiesData);
          storage.saveActivities(activitiesData);
        }
        if (summaryData) {
          setPipelineSummary(summaryData);
        }

        setIsBackendConnected(true);
      } catch (err: any) {
        if (!isMounted) return;
        setIsBackendConnected(false);
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : 'Unable to connect to backend REST server. Displaying local cache.'
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void initialFetch();

    return () => {
      isMounted = false;
    };
  }, []);

  // Lead status transition with API persistence & stage synchronization
  const handleUpdateStatus = async (leadId: string, newStatus: LeadStatus) => {
    const prevLeads = [...leads];
    let leadTarget = leads.find((l) => l.id === leadId);

    // Optimistically update UI
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    try {
      const updated = await api.updateLead(leadId, { status: newStatus });
      setLeads((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(updated);
      }
      storage.saveLeads(leads);

      // Refresh dependent activities and pipeline metrics
      const [freshActivities, freshSummary] = await Promise.all([
        api.getActivities({ limit: 20 }).catch(() => null),
        api.getPipelineSummary().catch(() => null),
      ]);
      if (freshActivities) {
        setActivities(freshActivities);
        storage.saveActivities(freshActivities);
      }
      if (freshSummary) {
        setPipelineSummary(freshSummary);
      }

      showNotice(`Lead stage updated to ${newStatus}`);
    } catch (err: any) {
      // Revert optimistic update on error
      setLeads(prevLeads);
      if (selectedLead && selectedLead.id === leadId && leadTarget) {
        setSelectedLead(leadTarget);
      }
      setErrorMessage(`Failed to update status: ${err.message}`);
    }
  };

  // Add new lead with API persistence
  const handleAddLead = async (newLead: Lead) => {
    try {
      const created = await api.createLead({
        name: newLead.name,
        title: newLead.title,
        company: newLead.company,
        companyDomain: newLead.companyDomain,
        avatar: newLead.avatar,
        email: newLead.email,
        linkedin: newLead.linkedin,
        location: newLead.location,
        industry: newLead.industry,
        companySize: newLead.companySize,
        score: newLead.score,
        tier: newLead.tier,
        status: newLead.status,
        dealValue: newLead.dealValue,
        triggers: newLead.triggers,
        notes: newLead.notes,
      });

      setLeads((prev) => {
        const next = [created, ...prev];
        storage.saveLeads(next);
        return next;
      });

      const [freshActivities, freshSummary] = await Promise.all([
        api.getActivities({ limit: 20 }).catch(() => null),
        api.getPipelineSummary().catch(() => null),
      ]);
      if (freshActivities) {
        setActivities(freshActivities);
        storage.saveActivities(freshActivities);
      }
      if (freshSummary) {
        setPipelineSummary(freshSummary);
      }

      showNotice(`Lead "${created.name}" created and synced.`);
    } catch (err: any) {
      setErrorMessage(`Failed to create lead: ${err.message}`);
    }
  };

  // Update notes on lead
  const handleUpdateNotes = async (leadId: string, notes: string) => {
    try {
      const updated = await api.updateLead(leadId, { notes });
      setLeads((prev) => {
        const next = prev.map((l) => (l.id === leadId ? updated : l));
        storage.saveLeads(next);
        return next;
      });
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(updated);
      }
      showNotice('Lead notes updated.');
    } catch (err: any) {
      setErrorMessage(`Failed to update notes: ${err.message}`);
    }
  };

  // Delete lead
  const handleDeleteLead = async (leadId: string) => {
    try {
      await api.deleteLead(leadId);
      setLeads((prev) => {
        const next = prev.filter((l) => l.id !== leadId);
        storage.saveLeads(next);
        return next;
      });
      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(null);
      }

      const freshSummary = await api.getPipelineSummary().catch(() => null);
      if (freshSummary) setPipelineSummary(freshSummary);

      showNotice('Lead removed successfully.');
    } catch (err: any) {
      setErrorMessage(`Failed to delete lead: ${err.message}`);
    }
  };

  // Qualify lead via deterministic explainable ICP scoring engine
  const handleQualifyLead = async (leadId: string) => {
    try {
      const { qualification, lead: updatedLead } = await api.qualifyLead(leadId);
      setLeads((prev) => {
        const next = prev.map((l) => (l.id === leadId ? updatedLead : l));
        storage.saveLeads(next);
        return next;
      });

      if (selectedLead && selectedLead.id === leadId) {
        setSelectedLead(updatedLead);
      }

      const [freshActivities, freshSummary] = await Promise.all([
        api.getActivities({ limit: 20 }).catch(() => null),
        api.getPipelineSummary().catch(() => null),
      ]);
      if (freshActivities) {
        setActivities(freshActivities);
        storage.saveActivities(freshActivities);
      }
      if (freshSummary) {
        setPipelineSummary(freshSummary);
      }

      showNotice(`Lead qualified: ${qualification.overallScore}/100 (${qualification.tier.toUpperCase()})`);
      return qualification;
    } catch (err: any) {
      setErrorMessage(`Failed to qualify lead: ${err.message}`);
      throw err;
    }
  };

  // Save updated ICP profile with single-active guarantee
  const handleSaveProfile = async (updatedProfile: IcpProfile) => {
    try {
      let saved: IcpProfile;
      if (updatedProfile.id) {
        saved = await api.updateIcpProfile(updatedProfile.id, {
          ...updatedProfile,
          isActive: true,
        });
      } else if (icpProfile.id) {
        saved = await api.updateIcpProfile(icpProfile.id, {
          ...updatedProfile,
          isActive: true,
        });
      } else {
        saved = await api.createIcpProfile({
          ...updatedProfile,
          isActive: true,
        });
      }

      setIcpProfile(saved);
      storage.saveIcp(saved);

      const freshActivities = await api.getActivities({ limit: 20 }).catch(() => null);
      if (freshActivities) {
        setActivities(freshActivities);
        storage.saveActivities(freshActivities);
      }

      showNotice('ICP profile saved & scoring criteria activated.');
    } catch (err: any) {
      setErrorMessage(`Failed to save ICP profile: ${err.message}`);
    }
  };

  // Knowledge base document actions
  const handleAddDoc = async (doc: KnowledgeDocument) => {
    try {
      const created = await api.createKnowledgeDoc({
        title: doc.title,
        category: doc.category,
        type: doc.type,
        sizeOrTokens: doc.sizeOrTokens,
        status: doc.status,
        summary: doc.summary,
      });

      setKnowledgeDocs((prev) => {
        const next = [created, ...prev];
        storage.saveDocs(next);
        return next;
      });

      const freshActivities = await api.getActivities({ limit: 20 }).catch(() => null);
      if (freshActivities) {
        setActivities(freshActivities);
        storage.saveActivities(freshActivities);
      }

      showNotice(`Document "${created.title}" added to Knowledge Base.`);
    } catch (err: any) {
      setErrorMessage(`Failed to add document: ${err.message}`);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await api.deleteKnowledgeDoc(id);
      setKnowledgeDocs((prev) => {
        const next = prev.filter((d) => d.id !== id);
        storage.saveDocs(next);
        return next;
      });
      showNotice('Document removed.');
    } catch (err: any) {
      setErrorMessage(`Failed to delete document: ${err.message}`);
    }
  };

  const handleUpdateDoc = async (doc: KnowledgeDocument) => {
    try {
      const updated = await api.updateKnowledgeDoc(doc.id, doc);
      setKnowledgeDocs((prev) => {
        const next = prev.map((d) => (d.id === doc.id ? updated : d));
        storage.saveDocs(next);
        return next;
      });
      showNotice(`Document "${updated.title}" updated.`);
    } catch (err: any) {
      setErrorMessage(`Failed to update document: ${err.message}`);
    }
  };

  // Trigger autonomous lead discovery scan with backend persistence
  const handleTriggerScan = async () => {
    const scanPool = [
      {
        name: 'Camilla Moreau',
        title: 'Chief Revenue Officer',
        company: 'Vortex Automation',
        companyDomain: 'vortexauto.io',
        avatar: '',
        email: 'camilla@vortexauto.io',
        linkedin: 'https://linkedin.com/in/camilla-moreau',
        location: 'Paris, France',
        industry: 'Enterprise Software & Cloud',
        companySize: '150 - 300',
        score: 93,
        status: 'New' as LeadStatus,
        dealValue: 72000,
        triggers: ['Raised €18M Series A', 'Hiring 6 SDRs in Europe'],
        notes: 'Discovered through enterprise SaaS funding registry scan.',
      },
      {
        name: 'Arjun Nambiar',
        title: 'VP of Global Sales',
        company: 'HyperScale AI',
        companyDomain: 'hyperscale.ai',
        avatar: '',
        email: 'arjun@hyperscale.ai',
        linkedin: 'https://linkedin.com/in/arjun-nambiar',
        location: 'Singapore',
        industry: 'AI & Data Analytics',
        companySize: '200 - 400',
        score: 91,
        status: 'New' as LeadStatus,
        dealValue: 85000,
        triggers: ['Evaluating enterprise outbound stack', 'Snowflake partner'],
        notes: 'High intent detected from outbound benchmark report downloads.',
      },
    ];

    try {
      const createdLeads: Lead[] = [];
      for (const lead of scanPool) {
        const saved = await api.createLead(lead);
        createdLeads.push(saved);
      }

      setLeads((prev) => {
        const next = [...createdLeads, ...prev];
        storage.saveLeads(next);
        return next;
      });

      const [freshActivities, freshSummary] = await Promise.all([
        api.getActivities({ limit: 20 }).catch(() => null),
        api.getPipelineSummary().catch(() => null),
      ]);
      if (freshActivities) {
        setActivities(freshActivities);
        storage.saveActivities(freshActivities);
      }
      if (freshSummary) {
        setPipelineSummary(freshSummary);
      }

      showNotice(`Batch scan completed: ${createdLeads.length} accounts ingested into SQLite.`);
    } catch (err: any) {
      setErrorMessage(`Scan ingestion failed: ${err.message}`);
    }
  };

  // Global search input handler
  const handleGlobalSearchChange = (query: string) => {
    setGlobalSearchQuery(query);
    if (query.trim() && currentView !== 'leads') {
      setCurrentView('leads');
    }
  };

  const handleMoveToPipeline = () => {
    setCurrentView('pipeline');
  };

  const totalPipelineValue = pipelineSummary
    ? pipelineSummary.totalPipelineValue
    : leads.reduce((acc, l) => acc + l.dealValue, 0);

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => setCurrentView(view)}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        icpProfile={icpProfile}
        leadsCount={leads.length}
        pipelineTotal={totalPipelineValue}
        docsCount={knowledgeDocs.length}
      />

      {/* Main Content Workspace */}
      <div className="flex flex-1 flex-col min-w-0 bg-slate-50">
        <Navbar
          currentView={currentView}
          onOpenMobileMenu={() => setIsOpenMobile(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          searchQuery={globalSearchQuery}
          onSearchChange={handleGlobalSearchChange}
          onTriggerScan={handleTriggerScan}
          activities={activities}
          isBackendConnected={isBackendConnected}
          onRetryConnection={refreshFromBackend}
        />

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-center justify-between rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
              <span className="font-medium">{errorMessage}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={refreshFromBackend}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer shadow-2xs"
              >
                <RefreshCw className="h-3 w-3" />
                Retry
              </button>
              <button
                onClick={() => setErrorMessage(null)}
                className="rounded-lg p-1 text-rose-500 hover:text-rose-800 hover:bg-rose-100 transition-colors cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Global Feedback Notice */}
        {feedbackNotice && (
          <div className="mx-4 sm:mx-6 lg:mx-8 mt-4 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-semibold text-emerald-800 shadow-xs animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{feedbackNotice}</span>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {isLoading && leads.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-4">
              <RefreshCw className="h-8 w-8 text-indigo-600 animate-spin" />
              <p className="text-sm font-semibold text-slate-600">Loading LeadForge repository...</p>
            </div>
          ) : (
            <>
              {currentView === 'dashboard' && (
                <DashboardView
                  onNavigate={(view) => setCurrentView(view)}
                  onSelectLead={(lead) => setSelectedLead(lead)}
                  leads={leads}
                  icpProfile={icpProfile}
                  activities={activities}
                  pipelineSummary={pipelineSummary}
                />
              )}

              {currentView === 'icp' && (
                <IcpSetupView
                  key={icpProfile.id || icpProfile.name}
                  initialProfile={icpProfile}
                  onSaveProfile={handleSaveProfile}
                />
              )}

              {currentView === 'discovery' && (
                <DiscoveryView
                  onCandidatesIngested={async () => {
                    const [leadsData, summaryData, activitiesData] = await Promise.all([
                      api.getLeads().catch(() => null),
                      api.getPipelineSummary().catch(() => null),
                      api.getActivities({ limit: 20 }).catch(() => null),
                    ]);
                    if (leadsData && leadsData.leads) {
                      setLeads(leadsData.leads);
                      storage.saveLeads(leadsData.leads);
                    }
                    if (summaryData) {
                      setPipelineSummary(summaryData);
                    }
                    if (activitiesData) {
                      setActivities(activitiesData);
                      storage.saveActivities(activitiesData);
                    }
                    showNotice('Candidates successfully ingested into CRM and Sales Pipeline.');
                  }}
                  onNavigateToLeads={() => setCurrentView('leads')}
                />
              )}

              {currentView === 'leads' && (
                <LeadsView
                  leads={leads}
                  onSelectLead={(lead) => setSelectedLead(lead)}
                  onUpdateStatus={handleUpdateStatus}
                  onAddLead={handleAddLead}
                  searchQuery={globalSearchQuery}
                  onSearchChange={setGlobalSearchQuery}
                />
              )}

              {currentView === 'pipeline' && (
                <PipelineView
                  leads={leads}
                  onSelectLead={(lead) => setSelectedLead(lead)}
                  onUpdateStatus={handleUpdateStatus}
                  onAddLead={handleAddLead}
                />
              )}

              {currentView === 'knowledge' && (
                <KnowledgeBaseView
                  documents={knowledgeDocs}
                  onAddDocument={handleAddDoc}
                  onDeleteDocument={handleDeleteDoc}
                  onUpdateDocument={handleUpdateDoc}
                />
              )}

              {currentView === 'outreach' && (
                <OutreachView
                  leads={leads}
                  onSelectLead={(lead) => setSelectedLead(lead)}
                  onRefreshLeads={refreshFromBackend}
                />
              )}

              {currentView === 'landing' && (
                <LandingPageView
                  onNavigate={(view) => setCurrentView(view)}
                />
              )}

              {currentView === 'settings' && (
                <SettingsView
                  onNavigateToDiscovery={() => setCurrentView('discovery')}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Lead Detail Modal with Stage Selector, Editable Notes, Deletion, and ICP Scoring */}
      <LeadDetailModal
        key={selectedLead ? selectedLead.id : 'empty'}
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onMoveToPipeline={handleMoveToPipeline}
        onUpdateStatus={handleUpdateStatus}
        onUpdateNotes={handleUpdateNotes}
        onDeleteLead={handleDeleteLead}
        onQualifyLead={handleQualifyLead}
      />
    </div>
  );
};

export default App;
