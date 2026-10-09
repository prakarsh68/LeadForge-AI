import type {
  Lead,
  LeadStatus,
  IcpProfile,
  KnowledgeDocument,
  ActivityItem,
  Opportunity,
  PipelineSummary,
  ApiResponse,
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
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

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
};
