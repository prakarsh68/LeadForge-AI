export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Won' | 'Disqualified';

export type LeadScoreTier = 'high' | 'medium' | 'low';

export interface LeadEntity {
  id: string;
  name: string;
  title: string;
  company: string;
  company_domain: string;
  avatar?: string;
  email: string;
  linkedin?: string;
  location?: string;
  industry: string;
  company_size: string;
  score: number;
  tier: LeadScoreTier;
  status: LeadStatus;
  deal_value: number;
  triggers: string; // JSON string
  notes?: string;
  last_active?: string;
  created_at: string;
  updated_at: string;
}

export interface IcpProfileEntity {
  id: string;
  name: string;
  description: string;
  target_industries: string; // JSON string
  company_size_ranges: string; // JSON string
  target_locations: string; // JSON string
  revenue_ranges: string; // JSON string
  target_roles: string; // JSON string
  seniority_levels: string; // JSON string
  buying_triggers: string; // JSON string
  tech_stack: string; // JSON string
  min_score_threshold: number;
  negative_keywords: string; // JSON string
  is_active: number; // 0 or 1
  created_at: string;
  updated_at: string;
}

export interface KnowledgeDocumentEntity {
  id: string;
  title: string;
  category: 'Product Specs' | 'Battlecards' | 'Case Studies' | 'Pricing' | 'Compliance';
  type: 'pdf' | 'doc' | 'url' | 'notion';
  size_or_tokens: string;
  status: 'Indexed' | 'Syncing' | 'Ready';
  uploaded_at: string;
  summary: string;
  created_at: string;
  updated_at: string;
}

export interface ActivityEntity {
  id: string;
  type: 'discovery' | 'score' | 'outreach' | 'stage_change';
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
  created_at: string;
}

export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptimeSeconds: number;
  timestamp: string;
  environment: string;
  database: {
    status: 'connected' | 'error';
    type: string;
    path: string;
    tables: {
      leads: number;
      icp_profiles: number;
      knowledge_documents: number;
      activities: number;
    } | null;
    error?: string;
  };
}
