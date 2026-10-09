import { getDb } from './database.js';

export function initializeDatabase(): void {
  const db = getDb();

  // Create tables using safe idempotent statements
  db.exec(`
    CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      company_domain TEXT NOT NULL,
      avatar TEXT,
      email TEXT NOT NULL,
      linkedin TEXT,
      location TEXT,
      industry TEXT NOT NULL,
      company_size TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      tier TEXT NOT NULL CHECK(tier IN ('high', 'medium', 'low')),
      status TEXT NOT NULL CHECK(status IN ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Disqualified')) DEFAULT 'New',
      deal_value INTEGER NOT NULL DEFAULT 0,
      triggers TEXT NOT NULL DEFAULT '[]',
      notes TEXT DEFAULT '',
      last_active TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
    CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score DESC);
    CREATE INDEX IF NOT EXISTS idx_leads_tier ON leads(tier);

    CREATE TABLE IF NOT EXISTS icp_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      target_industries TEXT NOT NULL DEFAULT '[]',
      company_size_ranges TEXT NOT NULL DEFAULT '[]',
      target_locations TEXT NOT NULL DEFAULT '[]',
      revenue_ranges TEXT NOT NULL DEFAULT '[]',
      target_roles TEXT NOT NULL DEFAULT '[]',
      seniority_levels TEXT NOT NULL DEFAULT '[]',
      buying_triggers TEXT NOT NULL DEFAULT '[]',
      tech_stack TEXT NOT NULL DEFAULT '[]',
      min_score_threshold INTEGER NOT NULL DEFAULT 78,
      negative_keywords TEXT NOT NULL DEFAULT '[]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Product Specs', 'Battlecards', 'Case Studies', 'Pricing', 'Compliance')),
      type TEXT NOT NULL CHECK(type IN ('pdf', 'doc', 'url', 'notion')),
      size_or_tokens TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Indexed', 'Syncing', 'Ready')) DEFAULT 'Indexed',
      uploaded_at TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_documents(category);

    CREATE TABLE IF NOT EXISTS activities (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('discovery', 'score', 'outreach', 'stage_change')),
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      badge TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_activities_created_at ON activities(created_at DESC);
  `);

  // Seed default ICP profile if none exists
  const icpCount = (db.prepare('SELECT COUNT(*) as count FROM icp_profiles').get() as { count: number }).count;
  if (icpCount === 0) {
    const insertIcp = db.prepare(`
      INSERT INTO icp_profiles (
        id, name, description, target_industries, company_size_ranges,
        target_locations, revenue_ranges, target_roles, seniority_levels,
        buying_triggers, tech_stack, min_score_threshold, negative_keywords, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `);

    insertIcp.run(
      'icp-default',
      'B2B SaaS Growth & Enterprise Outbound',
      'Targeting mid-market to enterprise tech companies seeking automated lead enrichment and sales acceleration.',
      JSON.stringify(['Enterprise Software & Cloud', 'AI & Data Analytics', 'FinTech & Payments', 'Cybersecurity']),
      JSON.stringify(['50 - 100', '100 - 250', '250 - 500', '500 - 1,000']),
      JSON.stringify(['United States', 'Canada', 'United Kingdom', 'European Union']),
      JSON.stringify(['$5M - $20M ARR', '$20M - $50M ARR', '$50M+ ARR']),
      JSON.stringify(['VP of Sales', 'Chief Commercial Officer', 'Head of Growth', 'VP Revenue Operations', 'Director of Business Development']),
      JSON.stringify(['C-Level', 'VP', 'Director', 'Head of']),
      JSON.stringify(['Raised Series A / B / C funding in last 6 months', 'Hiring 5+ Account Executives or SDRs', 'Tech stack contains Salesforce, HubSpot, or Snowflake', 'Expanded into new international territory']),
      JSON.stringify(['Salesforce', 'HubSpot', 'Outreach', 'Snowflake', 'Segment', 'Apollo']),
      78,
      JSON.stringify(['Agencies & Freelancers', 'Bootstrapped < 10 employees', 'Consumer Retail Only', 'Crypto Gambling'])
    );
  }

  // Seed default initial leads if table is empty
  const leadsCount = (db.prepare('SELECT COUNT(*) as count FROM leads').get() as { count: number }).count;
  if (leadsCount === 0) {
    const insertLead = db.prepare(`
      INSERT INTO leads (
        id, name, title, company, company_domain, avatar, email, linkedin,
        location, industry, company_size, score, tier, status, deal_value,
        triggers, notes, last_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialLeads = [
      {
        id: 'lead-1',
        name: 'Elena Rostova',
        title: 'VP of Sales & Revenue Operations',
        company: 'CloudScale Nexus',
        companyDomain: 'cloudscale.io',
        avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80',
        email: 'elena.rostova@cloudscale.io',
        linkedin: 'https://linkedin.com/in/elena-rostova-mock',
        location: 'San Francisco, CA',
        industry: 'Enterprise Software & Cloud',
        companySize: '250 - 500',
        score: 96,
        tier: 'high',
        status: 'Qualified',
        dealValue: 64000,
        triggers: ['Raised $28M Series B', 'Hiring 8 Sales Reps', 'Using Salesforce + Outreach'],
        notes: 'Looking to automate outbound lead prioritization. Stated outbound team is overwhelmed with low-quality data.',
        lastActive: '2 hours ago',
      },
      {
        id: 'lead-2',
        name: 'Marcus Sterling',
        title: 'Head of Growth Marketing',
        company: 'Apex Data Labs',
        companyDomain: 'apexdata.ai',
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        email: 'marcus.s@apexdata.ai',
        linkedin: 'https://linkedin.com/in/marcus-sterling-mock',
        location: 'Austin, TX',
        industry: 'AI & Data Analytics',
        companySize: '100 - 250',
        score: 94,
        tier: 'high',
        status: 'Proposal',
        dealValue: 48000,
        triggers: ['Expansion into EMEA', 'Migrated to Snowflake', 'High social intent on B2B lead gen'],
        notes: 'Sent tailored proposal for LeadForge Autonomous Ingestion. Awaiting executive review.',
        lastActive: '5 hours ago',
      },
      {
        id: 'lead-3',
        name: 'Sophia Chen',
        title: 'Chief Commercial Officer',
        company: 'FinSphere Payments',
        companyDomain: 'finsphere.co',
        avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150&auto=format&fit=crop&q=80',
        email: 's.chen@finsphere.co',
        linkedin: 'https://linkedin.com/in/sophia-chen-mock',
        location: 'New York, NY',
        industry: 'FinTech & Payments',
        companySize: '500 - 1,000',
        score: 92,
        tier: 'high',
        status: 'Contacted',
        dealValue: 92000,
        triggers: ['CEO posted about outbound bottleneck', 'Hiring Head of RevOps'],
        notes: 'AI Agent dispatched customized multichannel email referencing their expansion in cross-border settlements.',
        lastActive: '1 day ago',
      },
      {
        id: 'lead-4',
        name: 'David Vance',
        title: 'Director of Business Development',
        company: 'Veloce Robotics',
        companyDomain: 'veloce-robotics.tech',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        email: 'david@veloce-robotics.tech',
        linkedin: 'https://linkedin.com/in/david-vance-mock',
        location: 'Boston, MA',
        industry: 'Hardware & Automation',
        companySize: '50 - 100',
        score: 89,
        tier: 'high',
        status: 'Won',
        dealValue: 36000,
        triggers: ['New product launch next month', 'High website visitor tracking activity'],
        notes: 'Contract signed! Annual tier with custom webhook ingestion.',
        lastActive: 'Just now',
      },
      {
        id: 'lead-5',
        name: 'Amara Okafor',
        title: 'VP of Product Strategy',
        company: 'Synthetix Bio',
        companyDomain: 'synthetixbio.com',
        avatar: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&auto=format&fit=crop&q=80',
        email: 'amara@synthetixbio.com',
        linkedin: 'https://linkedin.com/in/amara-okafor-mock',
        location: 'Cambridge, MA',
        industry: 'HealthTech & Bio',
        companySize: '150 - 300',
        score: 87,
        tier: 'high',
        status: 'New',
        dealValue: 55000,
        triggers: ['Grant recipient of $10M', 'Keynote speaker on Sales Efficiency'],
        notes: 'Discovered via biomedical conference directory and tech trigger scraping.',
        lastActive: '3 hours ago',
      },
      {
        id: 'lead-6',
        name: 'Julian Meyer',
        title: 'Head of Sales Engineering',
        company: 'Krypton Security',
        companyDomain: 'kryptonsec.com',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        email: 'jmeyer@kryptonsec.com',
        linkedin: 'https://linkedin.com/in/julian-meyer-mock',
        location: 'Seattle, WA',
        industry: 'Cybersecurity',
        companySize: '300 - 600',
        score: 82,
        tier: 'medium',
        status: 'Contacted',
        dealValue: 42000,
        triggers: ['SOC2 compliance audit completed', 'Active hiring for SDRs'],
        notes: 'Outreached on LinkedIn; waiting for connection response.',
        lastActive: '6 hours ago',
      },
    ];

    const insertMany = db.transaction((leadsList) => {
      for (const lead of leadsList) {
        insertLead.run(
          lead.id,
          lead.name,
          lead.title,
          lead.company,
          lead.companyDomain,
          lead.avatar,
          lead.email,
          lead.linkedin,
          lead.location,
          lead.industry,
          lead.companySize,
          lead.score,
          lead.tier,
          lead.status,
          lead.dealValue,
          JSON.stringify(lead.triggers),
          lead.notes,
          lead.lastActive
        );
      }
    });

    insertMany(initialLeads);
  }

  // Seed default knowledge documents if table is empty
  const docsCount = (db.prepare('SELECT COUNT(*) as count FROM knowledge_documents').get() as { count: number }).count;
  if (docsCount === 0) {
    const insertDoc = db.prepare(`
      INSERT INTO knowledge_documents (
        id, title, category, type, size_or_tokens, status, uploaded_at, summary
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialDocs = [
      {
        id: 'doc-1',
        title: 'LeadForge AI Product Architecture & Value Prop',
        category: 'Product Specs',
        type: 'pdf',
        sizeOrTokens: '2.4 MB • 18,200 tokens',
        status: 'Indexed',
        uploadedAt: 'Today, 10:14 AM',
        summary: 'Core product overview detailing autonomous data enrichment, LLM verification agent, and CRM bidirectional sync.',
      },
      {
        id: 'doc-2',
        title: 'Q1 Enterprise Pricing & Discount Matrix 2026',
        category: 'Pricing',
        type: 'doc',
        sizeOrTokens: '850 KB • 6,400 tokens',
        status: 'Indexed',
        uploadedAt: 'Yesterday',
        summary: 'Seat tiers, enrichment credit allocations, custom webhook connector fees, and contract terms.',
      },
    ];

    const insertDocsTransaction = db.transaction((docsList) => {
      for (const doc of docsList) {
        insertDoc.run(
          doc.id,
          doc.title,
          doc.category,
          doc.type,
          doc.sizeOrTokens,
          doc.status,
          doc.uploadedAt,
          doc.summary
        );
      }
    });

    insertDocsTransaction(initialDocs);
  }

  // Seed default activities if table is empty
  const actCount = (db.prepare('SELECT COUNT(*) as count FROM activities').get() as { count: number }).count;
  if (actCount === 0) {
    const insertAct = db.prepare(`
      INSERT INTO activities (id, type, title, description, timestamp, badge)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertAct.run(
      'act-1',
      'score',
      'High-Match Lead Identified',
      'Elena Rostova (CloudScale Nexus) scored 96/100 matching Series B + RevOps criteria',
      '12m ago',
      '96 Match'
    );
    insertAct.run(
      'act-2',
      'outreach',
      'Autonomous Email Dispatched',
      'Personalized outreach with Case Study v2 sent to Marcus Sterling (Apex Data)',
      '42m ago',
      'Email Sent'
    );
  }
}
