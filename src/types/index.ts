export type ViewType = 'dashboard' | 'icp' | 'leads' | 'pipeline' | 'knowledge';

export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Won' | 'Disqualified';

export type LeadScoreTier = 'high' | 'medium' | 'low';

export interface Lead {
  id: string;
  name: string;
  title: string;
  company: string;
  companyDomain: string;
  avatar: string;
  email: string;
  linkedin: string;
  location: string;
  industry: string;
  companySize: string;
  score: number;
  tier: LeadScoreTier;
  status: LeadStatus;
  dealValue: number;
  triggers: string[];
  notes: string;
  lastActive: string;
}

export interface ActivityItem {
  id: string;
  type: 'discovery' | 'score' | 'outreach' | 'stage_change';
  title: string;
  description: string;
  timestamp: string;
  badge?: string;
}

export interface KpiMetric {
  id: string;
  title: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  subtitle: string;
}

export interface IcpProfile {
  name: string;
  description: string;
  targetIndustries: string[];
  companySizeRanges: string[];
  targetLocations: string[];
  revenueRanges: string[];
  targetRoles: string[];
  seniorityLevels: string[];
  buyingTriggers: string[];
  techStack: string[];
  minScoreThreshold: number;
  negativeKeywords: string[];
}

export interface KnowledgeDocument {
  id: string;
  title: string;
  category: 'Product Specs' | 'Battlecards' | 'Case Studies' | 'Pricing' | 'Compliance';
  type: 'pdf' | 'doc' | 'url' | 'notion';
  sizeOrTokens: string;
  status: 'Indexed' | 'Syncing' | 'Ready';
  uploadedAt: string;
  summary: string;
}

export interface PipelineColumn {
  id: LeadStatus;
  title: string;
  color: string;
}

