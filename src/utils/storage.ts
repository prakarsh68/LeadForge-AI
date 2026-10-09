import type { Lead, IcpProfile, KnowledgeDocument, ActivityItem } from '../types';
import {
  mockLeads,
  defaultIcpProfile,
  mockKnowledgeDocuments,
  mockActivities,
} from '../data/mockData';

const KEYS = {
  LEADS: 'leadforge_leads_v1',
  ICP: 'leadforge_icp_v1',
  DOCS: 'leadforge_docs_v1',
  ACTIVITIES: 'leadforge_activities_v1',
};

// Safe JSON loader with fallback
function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    console.warn(`[LeadForge Storage] Failed to load "${key}", using fallback.`, error);
    return fallback;
  }
}

// Safe JSON saver
function saveToStorage<T>(key: string, data: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`[LeadForge Storage] Failed to save "${key}".`, error);
  }
}

export const storage = {
  getLeads: (): Lead[] => loadFromStorage<Lead[]>(KEYS.LEADS, mockLeads),
  saveLeads: (leads: Lead[]): void => saveToStorage<Lead[]>(KEYS.LEADS, leads),

  getIcp: (): IcpProfile => loadFromStorage<IcpProfile>(KEYS.ICP, defaultIcpProfile),
  saveIcp: (icp: IcpProfile): void => saveToStorage<IcpProfile>(KEYS.ICP, icp),

  getDocs: (): KnowledgeDocument[] =>
    loadFromStorage<KnowledgeDocument[]>(KEYS.DOCS, mockKnowledgeDocuments),
  saveDocs: (docs: KnowledgeDocument[]): void =>
    saveToStorage<KnowledgeDocument[]>(KEYS.DOCS, docs),

  getActivities: (): ActivityItem[] =>
    loadFromStorage<ActivityItem[]>(KEYS.ACTIVITIES, mockActivities),
  saveActivities: (activities: ActivityItem[]): void =>
    saveToStorage<ActivityItem[]>(KEYS.ACTIVITIES, activities),

  resetAll: () => {
    localStorage.removeItem(KEYS.LEADS);
    localStorage.removeItem(KEYS.ICP);
    localStorage.removeItem(KEYS.DOCS);
    localStorage.removeItem(KEYS.ACTIVITIES);
  },
};
