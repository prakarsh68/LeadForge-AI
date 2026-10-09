import type {
  Lead,
  LeadStatus,
  IcpProfile,
  KnowledgeDocument,
  KnowledgeChunk,
  KnowledgeSearchResult,
  KnowledgeAskResult,
  KnowledgeConfig,
  ActivityItem,
  Opportunity,
  PipelineSummary,
  ApiResponse,
  QualificationResult,
  DiscoveryProviderStatus,
  DiscoveryJob,
  DiscoveredCandidate,
  IngestBatchResult,
  OutreachCampaign,
  OutreachSequence,
  OutreachMessage,
  EngagementEvent,
  SuppressionItem,
  CrmSyncRecord,
  OpportunityScore,
  OutreachAnalytics,
  CrmStatus,
  SourceRegistryItem,
  SourceSignal,
  SourcingPlan,
  SourcingJob,
  SourceIntelligenceAnalytics,
  AgenticSourcingRun,
  ParsedCampaignIntent,
  SourcingOptimizationWeight,
  SourcingExperiment,
  AgenticSourcingStatus,
} from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export class ApiError extends Error {
  status?: number;
  details?: any;

  constructor(message: string, status?: number, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };

  // Only set application/json if body is not FormData
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
  } catch (error: any) {
    throw new ApiError(
      `Unable to connect to LeadForge server at ${API_BASE_URL}. Ensure the backend is running.`,
      0,
      error
    );
  }

  let json: ApiResponse<T>;
  const text = await response.text();
  try {
    json = text ? JSON.parse(text) : { success: response.ok, data: null as any };
  } catch {
    throw new ApiError(`Invalid server response from ${endpoint}: ${text.slice(0, 100)}`, response.status);
  }

  if (!response.ok || json.success === false) {
    const errorMsg = json.error || json.message || `Request failed with status ${response.status}`;
    throw new ApiError(errorMsg, response.status, json);
  }

  return json.data;
}

export const api = {
  baseUrl: API_BASE_URL,

  // Health check
  async getHealth() {
    return request<any>('/api/health');
  },

  // Leads API
  async getLeads(filters: {
    search?: string;
    status?: string;
    industry?: string;
    tier?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  } = {}): Promise<{ leads: Lead[]; total: number }> {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.status) params.set('status', filters.status);
    if (filters.industry) params.set('industry', filters.industry);
    if (filters.tier) params.set('tier', filters.tier);
    if (filters.sortBy) params.set('sortBy', filters.sortBy);
    if (filters.sortOrder) params.set('sortOrder', filters.sortOrder);
    if (filters.limit !== undefined) params.set('limit', String(filters.limit));
    if (filters.offset !== undefined) params.set('offset', String(filters.offset));

    const qs = params.toString();
    const endpoint = `/api/leads${qs ? `?${qs}` : ''}`;
    const data = await request<Lead[]>(endpoint);
    return {
      leads: data,
      total: data.length,
    };
  },

  async getLead(id: string): Promise<Lead> {
    return request<Lead>(`/api/leads/${encodeURIComponent(id)}`);
  },

  async createLead(leadData: Partial<Lead> & { name: string; company: string; email: string }): Promise<Lead> {
    return request<Lead>('/api/leads', {
      method: 'POST',
      body: JSON.stringify(leadData),
    });
  },

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    return request<Lead>(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteLead(id: string): Promise<void> {
    await request<void>(`/api/leads/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async qualifyLead(id: string): Promise<{ qualification: QualificationResult; lead: Lead }> {
    return request<{ qualification: QualificationResult; lead: Lead }>(`/api/leads/${encodeURIComponent(id)}/qualify`, {
      method: 'POST',
    });
  },

  async getLeadQualification(id: string): Promise<QualificationResult> {
    return request<QualificationResult>(`/api/leads/${encodeURIComponent(id)}/qualification`);
  },

  // ICP Profiles API
  async getIcpProfiles(): Promise<IcpProfile[]> {
    return request<IcpProfile[]>('/api/icp-profiles');
  },

  async getActiveIcp(): Promise<IcpProfile> {
    return request<IcpProfile>('/api/icp-profiles/active');
  },

  async getIcpProfile(id: string): Promise<IcpProfile> {
    return request<IcpProfile>(`/api/icp-profiles/${encodeURIComponent(id)}`);
  },

  async createIcpProfile(profileData: Partial<IcpProfile> & { name: string; description: string }): Promise<IcpProfile> {
    return request<IcpProfile>('/api/icp-profiles', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  },

  async updateIcpProfile(id: string, updates: Partial<IcpProfile>): Promise<IcpProfile> {
    return request<IcpProfile>(`/api/icp-profiles/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteIcpProfile(id: string): Promise<void> {
    await request<void>(`/api/icp-profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Pipeline Opportunities API
  async getOpportunities(stage?: string): Promise<Opportunity[]> {
    const qs = stage ? `?stage=${encodeURIComponent(stage)}` : '';
    return request<Opportunity[]>(`/api/opportunities${qs}`);
  },

  async getOpportunity(id: string): Promise<Opportunity> {
    return request<Opportunity>(`/api/opportunities/${encodeURIComponent(id)}`);
  },

  async getPipelineSummary(): Promise<PipelineSummary> {
    return request<PipelineSummary>('/api/pipeline/summary');
  },

  async createOpportunity(data: {
    leadId: string;
    title?: string;
    stage?: LeadStatus;
    dealValue?: number;
    expectedCloseDate?: string;
  }): Promise<Opportunity> {
    return request<Opportunity>('/api/opportunities', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateOpportunity(
    id: string,
    updates: {
      stage?: LeadStatus;
      dealValue?: number;
      expectedCloseDate?: string;
      title?: string;
    }
  ): Promise<Opportunity> {
    return request<Opportunity>(`/api/opportunities/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteOpportunity(id: string): Promise<void> {
    await request<void>(`/api/opportunities/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Activities API
  async getActivities(options: { limit?: number; type?: string } = {}): Promise<ActivityItem[]> {
    const params = new URLSearchParams();
    if (options.limit !== undefined) params.set('limit', String(options.limit));
    if (options.type) params.set('type', options.type);
    const qs = params.toString();
    return request<ActivityItem[]>(`/api/activities${qs ? `?${qs}` : ''}`);
  },

  async createActivity(activityData: {
    type: ActivityItem['type'];
    title: string;
    description: string;
    badge?: string;
    timestamp?: string;
  }): Promise<ActivityItem> {
    return request<ActivityItem>('/api/activities', {
      method: 'POST',
      body: JSON.stringify(activityData),
    });
  },

  // Knowledge Documents API
  async getKnowledgeDocs(filters: { category?: string; status?: string; search?: string } = {}): Promise<KnowledgeDocument[]> {
    const params = new URLSearchParams();
    if (filters.category && filters.category !== 'All') params.set('category', filters.category);
    if (filters.status) params.set('status', filters.status);
    if (filters.search) params.set('search', filters.search);
    const qs = params.toString();
    return request<KnowledgeDocument[]>(`/api/knowledge-documents${qs ? `?${qs}` : ''}`);
  },

  async getKnowledgeDoc(id: string): Promise<KnowledgeDocument> {
    return request<KnowledgeDocument>(`/api/knowledge-documents/${encodeURIComponent(id)}`);
  },

  async createKnowledgeDoc(data: {
    title: string;
    category: KnowledgeDocument['category'];
    type: KnowledgeDocument['type'];
    sizeOrTokens?: string;
    status?: KnowledgeDocument['status'];
    uploadedAt?: string;
    summary?: string;
  }): Promise<KnowledgeDocument> {
    return request<KnowledgeDocument>('/api/knowledge-documents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateKnowledgeDoc(id: string, updates: Partial<KnowledgeDocument>): Promise<KnowledgeDocument> {
    return request<KnowledgeDocument>(`/api/knowledge-documents/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async deleteKnowledgeDoc(id: string): Promise<void> {
    await request<void>(`/api/knowledge-documents/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Phase 4: Knowledge Intelligence & RAG Methods
  async uploadKnowledgeDoc(formData: FormData): Promise<KnowledgeDocument> {
    return request<KnowledgeDocument>('/api/knowledge/upload', {
      method: 'POST',
      body: formData,
    });
  },

  async getKnowledgeChunks(docId: string): Promise<KnowledgeChunk[]> {
    return request<KnowledgeChunk[]>(`/api/knowledge/documents/${encodeURIComponent(docId)}/chunks`);
  },

  async reindexKnowledgeDoc(docId: string): Promise<KnowledgeDocument> {
    return request<KnowledgeDocument>(`/api/knowledge/documents/${encodeURIComponent(docId)}/reindex`, {
      method: 'POST',
    });
  },

  async retryKnowledgeDoc(docId: string): Promise<KnowledgeDocument> {
    return request<KnowledgeDocument>(`/api/knowledge/documents/${encodeURIComponent(docId)}/retry`, {
      method: 'POST',
    });
  },

  async searchKnowledge(
    query: string,
    options: { category?: string; limit?: number; minSimilarity?: number } = {}
  ): Promise<KnowledgeSearchResult[]> {
    return request<KnowledgeSearchResult[]>('/api/knowledge/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        category: options.category !== 'All' ? options.category : undefined,
        limit: options.limit,
        minSimilarity: options.minSimilarity,
      }),
    });
  },

  async askKnowledge(
    question: string,
    options: { category?: string; topK?: number; minSimilarity?: number } = {}
  ): Promise<KnowledgeAskResult> {
    return request<KnowledgeAskResult>('/api/knowledge/ask', {
      method: 'POST',
      body: JSON.stringify({
        question,
        category: options.category !== 'All' ? options.category : undefined,
        topK: options.topK,
        minSimilarity: options.minSimilarity,
      }),
    });
  },

  async getKnowledgeConfig(): Promise<KnowledgeConfig> {
    return request<KnowledgeConfig>('/api/knowledge/config');
  },

  // Discovery API
  async getDiscoveryProviders(): Promise<DiscoveryProviderStatus[]> {
    return request<DiscoveryProviderStatus[]>('/api/discovery/providers');
  },

  async startDiscoveryJob(params: {
    provider?: string;
    domain: string;
    limit?: number;
    targetRoles?: string[];
    async?: boolean;
  }): Promise<{ job: DiscoveryJob; candidates: DiscoveredCandidate[] }> {
    return request<{ job: DiscoveryJob; candidates: DiscoveredCandidate[] }>('/api/discovery/jobs', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  },

  async getDiscoveryJob(id: string): Promise<DiscoveryJob> {
    return request<DiscoveryJob>(`/api/discovery/jobs/${encodeURIComponent(id)}`);
  },

  async cancelDiscoveryJob(id: string): Promise<DiscoveryJob> {
    return request<DiscoveryJob>(`/api/discovery/jobs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
  },

  async retryDiscoveryJob(id: string): Promise<DiscoveryJob> {
    return request<DiscoveryJob>(`/api/discovery/jobs/${encodeURIComponent(id)}/retry`, {
      method: 'POST',
    });
  },

  async getDiscoveredCandidates(jobId: string, status?: string): Promise<DiscoveredCandidate[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    return request<DiscoveredCandidate[]>(`/api/discovery/jobs/${encodeURIComponent(jobId)}/candidates${qs}`);
  },

  async ingestDiscoveredCandidate(candidateId: string): Promise<{
    lead: Lead;
    opportunity: Opportunity;
    candidate: DiscoveredCandidate;
  }> {
    return request<{
      lead: Lead;
      opportunity: Opportunity;
      candidate: DiscoveredCandidate;
    }>(`/api/discovery/candidates/${encodeURIComponent(candidateId)}/ingest`, {
      method: 'POST',
    });
  },

  async getAllDiscoveryJobs(limit?: number): Promise<DiscoveryJob[]> {
    const qs = limit ? `?limit=${encodeURIComponent(limit)}` : '';
    return request<DiscoveryJob[]>(`/api/discovery/jobs${qs}`);
  },

  async getAllDiscoveredCandidates(filters?: { status?: string; limit?: number }): Promise<DiscoveredCandidate[]> {
    const params = new URLSearchParams();
    if (filters?.status) params.set('status', filters.status);
    if (filters?.limit) params.set('limit', String(filters.limit));
    const qs = params.toString();
    return request<DiscoveredCandidate[]>(`/api/discovery/candidates${qs ? `?${qs}` : ''}`);
  },

  async ingestCandidatesBatch(candidateIds: string[]): Promise<IngestBatchResult> {
    return request<IngestBatchResult>('/api/discovery/candidates/ingest-batch', {
      method: 'POST',
      body: JSON.stringify({ candidateIds }),
    });
  },

  // Phase 5: Outreach Campaigns
  async getOutreachCampaigns(): Promise<OutreachCampaign[]> {
    return request<OutreachCampaign[]>('/api/outreach/campaigns');
  },

  async getOutreachCampaign(id: string): Promise<OutreachCampaign> {
    return request<OutreachCampaign>(`/api/outreach/campaigns/${encodeURIComponent(id)}`);
  },

  async createOutreachCampaign(data: Partial<OutreachCampaign>): Promise<OutreachCampaign> {
    return request<OutreachCampaign>('/api/outreach/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateOutreachCampaign(id: string, data: Partial<OutreachCampaign>): Promise<OutreachCampaign> {
    return request<OutreachCampaign>(`/api/outreach/campaigns/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteOutreachCampaign(id: string): Promise<void> {
    await request<void>(`/api/outreach/campaigns/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Phase 5: Outreach Sequences & Messages
  async getOutreachSequences(filters?: { campaignId?: string; leadId?: string; status?: string }): Promise<OutreachSequence[]> {
    const params = new URLSearchParams();
    if (filters?.campaignId) params.set('campaignId', filters.campaignId);
    if (filters?.leadId) params.set('leadId', filters.leadId);
    if (filters?.status) params.set('status', filters.status);
    const qs = params.toString();
    return request<OutreachSequence[]>(`/api/outreach/sequences${qs ? `?${qs}` : ''}`);
  },

  async getOutreachSequence(id: string): Promise<OutreachSequence> {
    return request<OutreachSequence>(`/api/outreach/sequences/${encodeURIComponent(id)}`);
  },

  async createOutreachSequence(data: {
    leadId: string;
    campaignId?: string;
    generateDrafts?: boolean;
    customInstructions?: string;
  }): Promise<OutreachSequence> {
    return request<OutreachSequence>('/api/outreach/sequences', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async approveOutreachSequence(id: string, approvedBy?: string): Promise<OutreachSequence> {
    return request<OutreachSequence>(`/api/outreach/sequences/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
      body: JSON.stringify({ approvedBy: approvedBy || 'sales_operator' }),
    });
  },

  async pauseOutreachSequence(id: string): Promise<OutreachSequence> {
    return request<OutreachSequence>(`/api/outreach/sequences/${encodeURIComponent(id)}/pause`, {
      method: 'POST',
    });
  },

  async resumeOutreachSequence(id: string): Promise<OutreachSequence> {
    return request<OutreachSequence>(`/api/outreach/sequences/${encodeURIComponent(id)}/resume`, {
      method: 'POST',
    });
  },

  async cancelOutreachSequence(id: string, reason?: string): Promise<OutreachSequence> {
    return request<OutreachSequence>(`/api/outreach/sequences/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'User cancelled' }),
    });
  },

  async sendOutreachSequenceNow(id: string): Promise<{ data: OutreachSequence; messageId?: string }> {
    return request<{ data: OutreachSequence; messageId?: string }>(
      `/api/outreach/sequences/${encodeURIComponent(id)}/send-now`,
      {
        method: 'POST',
      }
    );
  },

  async updateOutreachMessage(
    sequenceId: string,
    step: number,
    data: { subject?: string; bodyHtml?: string; bodyText?: string }
  ): Promise<OutreachMessage> {
    return request<OutreachMessage>(
      `/api/outreach/sequences/${encodeURIComponent(sequenceId)}/messages/${step}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  async generateOutreachDraft(
    leadId: string,
    customInstructions?: string
  ): Promise<{ steps: OutreachMessage[]; evidenceUsed: any[]; generationMode: string }> {
    return request<{ steps: OutreachMessage[]; evidenceUsed: any[]; generationMode: string }>(
      '/api/outreach/generate',
      {
        method: 'POST',
        body: JSON.stringify({ leadId, customInstructions }),
      }
    );
  },

  // Phase 5: Engagement Events & Suppression
  async recordEngagementEvent(data: {
    leadId: string;
    sequenceId?: string;
    messageId?: string;
    campaignId?: string;
    eventType: string;
    providerEventId?: string;
    sourceMetadata?: Record<string, any>;
  }): Promise<{ data: EngagementEvent; isDuplicate: boolean }> {
    return request<{ data: EngagementEvent; isDuplicate: boolean }>('/api/outreach/events', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getSuppressionList(): Promise<SuppressionItem[]> {
    return request<SuppressionItem[]>('/api/outreach/suppression');
  },

  async addSuppressionItem(data: { email: string; reason?: string; source?: string }): Promise<SuppressionItem> {
    return request<SuppressionItem>('/api/outreach/suppression', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async removeSuppressionItem(id: string): Promise<void> {
    await request<void>(`/api/outreach/suppression/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  // Phase 5: Outreach Analytics
  async getOutreachAnalytics(): Promise<OutreachAnalytics> {
    return request<OutreachAnalytics>('/api/outreach/analytics');
  },

  // Phase 5: CRM Operations & Opportunity Scoring
  async getCrmStatus(): Promise<CrmStatus> {
    return request<CrmStatus>('/api/crm/status');
  },

  async syncLeadToCrm(leadId: string): Promise<CrmSyncRecord> {
    return request<CrmSyncRecord>(`/api/crm/sync/${encodeURIComponent(leadId)}`, {
      method: 'POST',
    });
  },

  async getLeadCrmRecords(leadId: string): Promise<CrmSyncRecord[]> {
    return request<CrmSyncRecord[]>(`/api/crm/leads/${encodeURIComponent(leadId)}/records`);
  },

  async getOpportunityScore(leadId: string): Promise<OpportunityScore> {
    return request<OpportunityScore>(`/api/opportunities/${encodeURIComponent(leadId)}/score`);
  },

  // ==========================================
  // Phase 6A: Adaptive Source Intelligence
  // ==========================================

  async getSourceIntelligenceStatus(): Promise<{
    enabled: boolean;
    sourcesCount: number;
    signalsCount: number;
    plansCount: number;
    message: string;
  }> {
    return request<{
      enabled: boolean;
      sourcesCount: number;
      signalsCount: number;
      plansCount: number;
      message: string;
    }>('/api/source-intelligence/status');
  },

  async getSourceRegistry(): Promise<SourceRegistryItem[]> {
    return request<SourceRegistryItem[]>('/api/source-intelligence/sources');
  },

  async toggleSource(id: string, isEnabled: boolean): Promise<SourceRegistryItem> {
    return request<SourceRegistryItem>(`/api/source-intelligence/sources/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify({ isEnabled }),
    });
  },

  async checkSourceHealth(id?: string): Promise<any> {
    return request<any>('/api/source-intelligence/sources/health', {
      method: 'POST',
      body: JSON.stringify(id ? { id } : {}),
    });
  },

  async getSourceSignals(params?: { category?: string; domain?: string }): Promise<SourceSignal[]> {
    const query = new URLSearchParams();
    if (params?.category) query.append('category', params.category);
    if (params?.domain) query.append('domain', params.domain);
    const qs = query.toString();
    return request<SourceSignal[]>(`/api/source-intelligence/signals${qs ? `?${qs}` : ''}`);
  },

  async createSourceSignal(signal: {
    companyName: string;
    companyDomain: string;
    signalCategory: string;
    sourceId: string;
    signalText: string;
    structuredEvidence?: Record<string, any>;
    confidence?: number;
    relevanceScore?: number;
  }): Promise<SourceSignal> {
    return request<SourceSignal>('/api/source-intelligence/signals', {
      method: 'POST',
      body: JSON.stringify(signal),
    });
  },

  async previewSourcingPlan(input: {
    name: string;
    targetIcpId?: string;
    campaignObjective: string;
    constraints?: any;
  }): Promise<SourcingPlan> {
    return request<SourcingPlan>('/api/source-intelligence/plans/preview', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  async saveSourcingPlan(plan: SourcingPlan): Promise<SourcingPlan> {
    return request<SourcingPlan>('/api/source-intelligence/plans', {
      method: 'POST',
      body: JSON.stringify(plan),
    });
  },

  async getSourcingPlans(): Promise<SourcingPlan[]> {
    return request<SourcingPlan[]>('/api/source-intelligence/plans');
  },

  async getSourcingPlan(id: string): Promise<SourcingPlan> {
    return request<SourcingPlan>(`/api/source-intelligence/plans/${encodeURIComponent(id)}`);
  },

  async executeSourcingPlan(id: string): Promise<SourcingJob> {
    return request<SourcingJob>(`/api/source-intelligence/plans/${encodeURIComponent(id)}/execute`, {
      method: 'POST',
    });
  },

  async getSourcingJob(id: string): Promise<SourcingJob> {
    return request<SourcingJob>(`/api/source-intelligence/jobs/${encodeURIComponent(id)}`);
  },

  async getSourceIntelligenceAnalytics(): Promise<SourceIntelligenceAnalytics> {
    return request<SourceIntelligenceAnalytics>('/api/source-intelligence/analytics');
  },

  // Phase 6B: Agentic Orchestration & Self-Optimizing Sourcing
  async getAgenticSourcingStatus(): Promise<AgenticSourcingStatus> {
    return request<AgenticSourcingStatus>('/api/agentic-sourcing/status');
  },

  async parseCampaignIntent(data: { rawIntent: string; icpProfileId?: string }): Promise<ParsedCampaignIntent> {
    return request<ParsedCampaignIntent>('/api/agentic-sourcing/intent/parse', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async createAgenticRun(data: {
    campaignIntent: string;
    icpProfileId?: string;
    maxBudgetCredits?: number;
    name?: string;
    targetYield?: number;
  }): Promise<AgenticSourcingRun> {
    return request<AgenticSourcingRun>('/api/agentic-sourcing/runs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async getAgenticRuns(): Promise<AgenticSourcingRun[]> {
    return request<AgenticSourcingRun[]>('/api/agentic-sourcing/runs');
  },

  async getAgenticRun(id: string): Promise<AgenticSourcingRun> {
    return request<AgenticSourcingRun>(`/api/agentic-sourcing/runs/${encodeURIComponent(id)}`);
  },

  async executeAgenticRun(id: string): Promise<AgenticSourcingRun> {
    return request<AgenticSourcingRun>(`/api/agentic-sourcing/runs/${encodeURIComponent(id)}/execute`, {
      method: 'POST',
    });
  },

  async cancelAgenticRun(id: string): Promise<AgenticSourcingRun> {
    return request<AgenticSourcingRun>(`/api/agentic-sourcing/runs/${encodeURIComponent(id)}/cancel`, {
      method: 'POST',
    });
  },

  async getSourcingOptimizationWeights(): Promise<SourcingOptimizationWeight[]> {
    return request<SourcingOptimizationWeight[]>('/api/agentic-sourcing/optimization/weights');
  },

  async recomputeOptimizationWeights(): Promise<SourcingOptimizationWeight[]> {
    return request<SourcingOptimizationWeight[]>('/api/agentic-sourcing/optimization/recompute', {
      method: 'POST',
    });
  },

  async runSourcingExperiment(data?: { sampleSize?: number }): Promise<SourcingExperiment> {
    return request<SourcingExperiment>('/api/agentic-sourcing/experiments/run', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  },

  async getSourcingExperiments(): Promise<SourcingExperiment[]> {
    return request<SourcingExperiment[]>('/api/agentic-sourcing/experiments');
  },
};


