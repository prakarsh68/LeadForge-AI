import React, { useState, useEffect } from 'react';
import type { ViewType, Lead, LeadStatus, IcpProfile, KnowledgeDocument, ActivityItem } from './types';
import { storage } from './utils/storage';
import { Sidebar } from './components/layout/Sidebar';
import { Navbar } from './components/layout/Navbar';
import { DashboardView } from './components/dashboard/DashboardView';
import { IcpSetupView } from './components/icp/IcpSetupView';
import { LeadsView } from './components/leads/LeadsView';
import { PipelineView } from './components/pipeline/PipelineView';
import { KnowledgeBaseView } from './components/knowledge/KnowledgeBaseView';
import { LeadDetailModal } from './components/leads/LeadDetailModal';

export const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [leads, setLeads] = useState<Lead[]>(() => storage.getLeads());
  const [icpProfile, setIcpProfile] = useState<IcpProfile>(() => storage.getIcp());
  const [knowledgeDocs, setKnowledgeDocs] = useState<KnowledgeDocument[]>(() => storage.getDocs());
  const [activities, setActivities] = useState<ActivityItem[]>(() => storage.getActivities());

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Sync leads to storage whenever updated
  useEffect(() => {
    storage.saveLeads(leads);
  }, [leads]);

  // Sync ICP to storage
  useEffect(() => {
    storage.saveIcp(icpProfile);
  }, [icpProfile]);

  // Sync docs to storage
  useEffect(() => {
    storage.saveDocs(knowledgeDocs);
  }, [knowledgeDocs]);

  // Sync activities to storage
  useEffect(() => {
    storage.saveActivities(activities);
  }, [activities]);

  // Add an activity helper
  const recordActivity = (
    type: ActivityItem['type'],
    title: string,
    description: string,
    badge?: string
  ) => {
    const newAct: ActivityItem = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      type,
      title,
      description,
      timestamp: 'Just now',
      badge,
    };
    setActivities((prev) => [newAct, ...prev.slice(0, 19)]);
  };

  // Update lead status (from modal, table, or kanban)
  const handleUpdateStatus = (leadId: string, newStatus: LeadStatus) => {
    let leadName = 'Lead';
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id === leadId) {
          leadName = l.name;
          return { ...l, status: newStatus };
        }
        return l;
      })
    );

    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
    }

    recordActivity(
      'stage_change',
      'Deal Stage Updated',
      `${leadName} moved to ${newStatus} stage`,
      newStatus
    );
  };

  // Add new lead (from Leads view or Pipeline view)
  const handleAddLead = (newLead: Lead) => {
    setLeads((prev) => [newLead, ...prev]);
    recordActivity(
      'discovery',
      'New Lead Ingested',
      `${newLead.name} (${newLead.company}) added to repository`,
      `${newLead.score} Fit`
    );
  };

  // Update lead notes
  const handleUpdateNotes = (leadId: string, notes: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, notes } : l))
    );
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, notes } : null));
    }
  };

  // Save updated ICP profile
  const handleSaveProfile = (updatedProfile: IcpProfile) => {
    setIcpProfile(updatedProfile);
    recordActivity(
      'score',
      'ICP Parameters Re-indexed',
      `Targeting: ${updatedProfile.name} (Cutoff: ${updatedProfile.minScoreThreshold}+)`,
      'ICP Saved'
    );
  };

  // Knowledge base actions
  const handleAddDoc = (doc: KnowledgeDocument) => {
    setKnowledgeDocs((prev) => [doc, ...prev]);
    recordActivity(
      'discovery',
      'Collateral Embedded',
      `${doc.title} vectorized into knowledge pool`,
      doc.category
    );
  };

  const handleDeleteDoc = (id: string) => {
    setKnowledgeDocs((prev) => prev.filter((d) => d.id !== id));
  };

  const handleUpdateDoc = (doc: KnowledgeDocument) => {
    setKnowledgeDocs((prev) =>
      prev.map((d) => (d.id === doc.id ? doc : d))
    );
    recordActivity(
      'score',
      'Document Re-indexed',
      `${doc.title} vector embeddings refreshed`,
      'Ready'
    );
  };

  // Trigger autonomous lead discovery scan
  const handleTriggerScan = () => {
    const scanPool: Lead[] = [
      {
        id: `lead-scan-${Date.now()}-1`,
        name: 'Camilla Moreau',
        title: 'Chief Revenue Officer',
        company: 'Vortex Automation',
        companyDomain: 'vortexauto.io',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        email: 'camilla@vortexauto.io',
        linkedin: 'https://linkedin.com',
        location: 'Paris, France',
        industry: 'Enterprise Software & Cloud',
        companySize: '150 - 300',
        score: 93,
        tier: 'high',
        status: 'New',
        dealValue: 72000,
        triggers: ['Raised €18M Series A', 'Hiring 6 SDRs in Europe'],
        notes: 'Identified via European SaaS funding registry.',
        lastActive: 'Just now',
      },
      {
        id: `lead-scan-${Date.now()}-2`,
        name: 'Arjun Nambiar',
        title: 'VP of Global Sales',
        company: 'HyperScale AI',
        companyDomain: 'hyperscale.ai',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        email: 'arjun@hyperscale.ai',
        linkedin: 'https://linkedin.com',
        location: 'Singapore',
        industry: 'AI & Data Analytics',
        companySize: '200 - 400',
        score: 91,
        tier: 'high',
        status: 'New',
        dealValue: 85000,
        triggers: ['Evaluating enterprise outbound stack', 'Snowflake partner'],
        notes: 'High intent detected from outbound benchmark report downloads.',
        lastActive: 'Just now',
      },
    ];

    setLeads((prev) => [...scanPool, ...prev]);
    recordActivity(
      'discovery',
      'Batch Discovery Completed',
      'Identified 2 high-fit accounts exceeding ICP threshold',
      '+2 Leads'
    );
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

  const totalPipelineValue = leads.reduce((acc, l) => acc + l.dealValue, 0);

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => setCurrentView(view)}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
        icpProfile={icpProfile}
        leadsCount={leads.length}
        pipelineTotal={totalPipelineValue}
        docsCount={knowledgeDocs.length}
      />

      {/* Main Content Workspace */}
      <div className="flex flex-1 flex-col min-w-0">
        <Navbar
          currentView={currentView}
          onOpenMobileMenu={() => setIsOpenMobile(true)}
          searchQuery={globalSearchQuery}
          onSearchChange={handleGlobalSearchChange}
          onTriggerScan={handleTriggerScan}
          activities={activities}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={(view) => setCurrentView(view)}
              onSelectLead={(lead) => setSelectedLead(lead)}
              leads={leads}
              icpProfile={icpProfile}
              activities={activities}
            />
          )}

          {currentView === 'icp' && (
            <IcpSetupView
              key={icpProfile.name}
              initialProfile={icpProfile}
              onSaveProfile={handleSaveProfile}
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
        </main>
      </div>

      {/* Lead Detail Modal with Stage Selector and Editable Notes */}
      <LeadDetailModal
        key={selectedLead ? selectedLead.id : 'empty'}
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onMoveToPipeline={handleMoveToPipeline}
        onUpdateStatus={handleUpdateStatus}
        onUpdateNotes={handleUpdateNotes}
      />

    </div>
  );
};

export default App;
