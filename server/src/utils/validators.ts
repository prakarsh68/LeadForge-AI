import type { LeadStatus, LeadScoreTier } from '../types/index.js';

export const ALLOWED_LEAD_STATUSES: readonly LeadStatus[] = [
  'New',
  'Contacted',
  'Qualified',
  'Proposal',
  'Won',
  'Disqualified',
] as const;

export const ALLOWED_SCORE_TIERS: readonly LeadScoreTier[] = ['high', 'medium', 'low'] as const;

export const ALLOWED_DOC_CATEGORIES = [
  'Product Specs',
  'Battlecards',
  'Case Studies',
  'Pricing',
  'Compliance',
] as const;

export const ALLOWED_DOC_TYPES = ['pdf', 'doc', 'url', 'notion'] as const;

export const ALLOWED_ACTIVITY_TYPES = ['discovery', 'score', 'outreach', 'stage_change'] as const;

export function isValidLeadStatus(status: any): status is LeadStatus {
  return typeof status === 'string' && ALLOWED_LEAD_STATUSES.includes(status as LeadStatus);
}

export function isValidScoreTier(tier: any): tier is LeadScoreTier {
  return typeof tier === 'string' && ALLOWED_SCORE_TIERS.includes(tier as LeadScoreTier);
}

export function isValidScore(score: any): boolean {
  return typeof score === 'number' && Number.isInteger(score) && score >= 0 && score <= 100;
}

export function isValidDealValue(value: any): boolean {
  return typeof value === 'number' && !Number.isNaN(value) && value >= 0;
}

export function isValidEmail(email: any): boolean {
  if (typeof email !== 'string') return false;
  // Standard permissive email format regex
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function deriveTierFromScore(score: number): LeadScoreTier {
  if (score >= 85) return 'high';
  if (score >= 70) return 'medium';
  return 'low';
}
