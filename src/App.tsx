import React, { useState } from 'react';
import type { ViewType, Lead, LeadStatus } from './types';
import { mockLeads } from './data/mockData';
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
  const [leads, setLeads] = useState<Lead[]>(mockLeads);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isOpenMobile, setIsOpenMobile] = useState(false);

  // Update lead status
  const handleUpdateStatus = (leadId: string, newStatus: LeadStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );
    if (selectedLead && selectedLead.id === leadId) {
      setSelectedLead((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
  };

  const handleMoveToPipeline = (_leadId: string) => {
    setCurrentView('pipeline');
  };


  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onSelectView={(view) => setCurrentView(view)}
        isOpenMobile={isOpenMobile}
        onCloseMobile={() => setIsOpenMobile(false)}
      />

      {/* Main Content Workspace */}
      <div className="flex flex-1 flex-col min-w-0">
        <Navbar
          currentView={currentView}
          onOpenMobileMenu={() => setIsOpenMobile(true)}
        />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {currentView === 'dashboard' && (
            <DashboardView
              onNavigate={(view) => setCurrentView(view)}
              onSelectLead={(lead) => setSelectedLead(lead)}
            />
          )}

          {currentView === 'icp' && <IcpSetupView />}

          {currentView === 'leads' && (
            <LeadsView
              leads={leads}
              onSelectLead={(lead) => setSelectedLead(lead)}
              onUpdateStatus={handleUpdateStatus}
            />
          )}

          {currentView === 'pipeline' && (
            <PipelineView
              leads={leads}
              onSelectLead={(lead) => setSelectedLead(lead)}
              onUpdateStatus={handleUpdateStatus}
            />
          )}

          {currentView === 'knowledge' && <KnowledgeBaseView />}
        </main>
      </div>

      {/* Lead Detail Modal */}
      <LeadDetailModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onMoveToPipeline={handleMoveToPipeline}
      />
    </div>
  );
};

export default App;
