import type Database from 'better-sqlite3';
import { getDb } from './database.js';

export function initializeDatabase(customDb?: Database.Database): void {
  const db = customDb || getDb();

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
      qualification_breakdown TEXT DEFAULT NULL,
      qualified_at TEXT DEFAULT NULL,
      is_qualification_stale INTEGER NOT NULL DEFAULT 0,
      enriched_at TEXT DEFAULT NULL,
      last_qualification_error TEXT DEFAULT NULL,
      conflict_history TEXT DEFAULT '[]',
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
      scoring_weights TEXT NOT NULL DEFAULT '{"industry":30,"roleSeniority":25,"intentTriggers":30,"techStack":15}',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS knowledge_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      category TEXT NOT NULL CHECK(category IN ('Product Specs', 'Battlecards', 'Case Studies', 'Pricing', 'Compliance')),
      type TEXT NOT NULL CHECK(type IN ('pdf', 'doc', 'docx', 'txt', 'md', 'url', 'notion')),
      size_or_tokens TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('Indexed', 'Syncing', 'Ready')) DEFAULT 'Indexed',
      uploaded_at TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      file_path TEXT DEFAULT NULL,
      file_size INTEGER NOT NULL DEFAULT 0,
      mime_type TEXT DEFAULT NULL,
      content_hash TEXT DEFAULT NULL,
      processing_status TEXT NOT NULL DEFAULT 'uploaded',
      error_message TEXT DEFAULT NULL,
      chunk_count INTEGER NOT NULL DEFAULT 0,
      indexed_at TEXT DEFAULT NULL,
      embedding_model TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_documents(category);

    CREATE TABLE IF NOT EXISTS knowledge_chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      page_number INTEGER DEFAULT NULL,
      section_title TEXT DEFAULT NULL,
      char_count INTEGER NOT NULL,
      embedding TEXT DEFAULT NULL,
      embedding_model TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id ON knowledge_chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_model ON knowledge_chunks(embedding_model);

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

    CREATE TABLE IF NOT EXISTS opportunities (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      stage TEXT NOT NULL CHECK(stage IN ('New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Disqualified')) DEFAULT 'New',
      deal_value INTEGER NOT NULL DEFAULT 0,
      confidence_score INTEGER NOT NULL DEFAULT 0,
      expected_close_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_opportunities_stage ON opportunities(stage);
    CREATE INDEX IF NOT EXISTS idx_opportunities_lead_id ON opportunities(lead_id);

    CREATE TABLE IF NOT EXISTS lead_qualifications (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      icp_profile_id TEXT NOT NULL REFERENCES icp_profiles(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      tier TEXT NOT NULL CHECK(tier IN ('high', 'medium', 'low')),
      is_qualified INTEGER NOT NULL DEFAULT 0,
      breakdown TEXT NOT NULL,
      reasons TEXT NOT NULL,
      evaluated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_lead_qualifications_lead_id ON lead_qualifications(lead_id);

    -- Phase 3C: Discovery Jobs with Durable State Machine and Leases
    CREATE TABLE IF NOT EXISTS discovery_jobs (
      id TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('real', 'demo')),
      status TEXT NOT NULL CHECK(status IN ('queued', 'pending', 'running', 'completed', 'partially_completed', 'failed', 'cancelled')),
      query_params TEXT NOT NULL,
      total_found INTEGER NOT NULL DEFAULT 0,
      candidates_found INTEGER NOT NULL DEFAULT 0,
      candidates_processed INTEGER NOT NULL DEFAULT 0,
      candidates_ingested INTEGER NOT NULL DEFAULT 0,
      candidates_skipped INTEGER NOT NULL DEFAULT 0,
      candidates_failed INTEGER NOT NULL DEFAULT 0,
      error_message TEXT DEFAULT NULL,
      last_error_category TEXT DEFAULT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      max_retries INTEGER NOT NULL DEFAULT 3,
      retry_count INTEGER NOT NULL DEFAULT 0,
      next_retry_at TEXT DEFAULT NULL,
      cancel_requested_at TEXT DEFAULT NULL,
      claimed_by TEXT DEFAULT NULL,
      claimed_at TEXT DEFAULT NULL,
      lease_expires_at TEXT DEFAULT NULL,
      started_at TEXT DEFAULT NULL,
      completed_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_discovery_jobs_status ON discovery_jobs(status);
    CREATE INDEX IF NOT EXISTS idx_discovery_jobs_created_at ON discovery_jobs(created_at DESC);

    CREATE TABLE IF NOT EXISTS discovered_candidates (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL REFERENCES discovery_jobs(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      mode TEXT NOT NULL CHECK(mode IN ('real', 'demo')),
      external_id TEXT DEFAULT NULL,
      company_name TEXT NOT NULL,
      company_domain TEXT NOT NULL,
      contact_name TEXT NOT NULL,
      title TEXT NOT NULL,
      email TEXT DEFAULT NULL,
      email_verification TEXT NOT NULL DEFAULT 'unverified' CHECK(email_verification IN ('verified', 'unverified', 'inferred', 'risky', 'undeliverable')),
      confidence_score INTEGER DEFAULT NULL,
      linkedin TEXT DEFAULT NULL,
      location TEXT DEFAULT NULL,
      industry TEXT DEFAULT NULL,
      company_size TEXT DEFAULT NULL,
      source_urls TEXT DEFAULT '[]',
      provenance_metadata TEXT NOT NULL,
      icp_score_preview INTEGER DEFAULT NULL,
      icp_tier_preview TEXT DEFAULT NULL,
      dedup_status TEXT NOT NULL DEFAULT 'new' CHECK(dedup_status IN ('new', 'existing_lead', 'same_company_existing', 'duplicate_in_job')),
      existing_lead_id TEXT DEFAULT NULL REFERENCES leads(id) ON DELETE SET NULL,
      status TEXT NOT NULL DEFAULT 'staged' CHECK(status IN ('staged', 'ingested', 'rejected')),
      ingested_lead_id TEXT DEFAULT NULL REFERENCES leads(id) ON DELETE SET NULL,
      is_mock INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_discovered_candidates_job ON discovered_candidates(job_id);
    CREATE INDEX IF NOT EXISTS idx_discovered_candidates_domain ON discovered_candidates(company_domain);
    CREATE INDEX IF NOT EXISTS idx_discovered_candidates_email ON discovered_candidates(email);
    CREATE INDEX IF NOT EXISTS idx_discovered_candidates_status ON discovered_candidates(status);

    -- Phase 5: Outreach Campaigns, Sequences, Messages, Events, CRM & Opportunity Scoring
    CREATE TABLE IF NOT EXISTS outreach_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      target_icp_id TEXT REFERENCES icp_profiles(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK(status IN ('draft', 'active', 'paused', 'completed', 'archived')) DEFAULT 'draft',
      sending_limits TEXT NOT NULL DEFAULT '{"maxPerDay":50,"minIntervalSeconds":60}',
      schedule_window TEXT NOT NULL DEFAULT '{"timezone":"UTC","allowedDays":[1,2,3,4,5],"startHour":9,"endHour":17}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_outreach_campaigns_status ON outreach_campaigns(status);

    CREATE TABLE IF NOT EXISTS outreach_sequences (
      id TEXT PRIMARY KEY,
      campaign_id TEXT REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('draft', 'pending_approval', 'approved', 'scheduled', 'active', 'paused', 'completed', 'cancelled', 'stopped_on_reply', 'stopped_on_opt_out', 'failed')) DEFAULT 'draft',
      current_step INTEGER NOT NULL DEFAULT 1,
      max_steps INTEGER NOT NULL DEFAULT 3,
      next_scheduled_at TEXT DEFAULT NULL,
      approved_at TEXT DEFAULT NULL,
      approved_by TEXT DEFAULT NULL,
      stop_reason TEXT DEFAULT NULL,
      lease_expires_at TEXT DEFAULT NULL,
      claimed_by TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_outreach_sequences_lead_id ON outreach_sequences(lead_id);
    CREATE INDEX IF NOT EXISTS idx_outreach_sequences_campaign_id ON outreach_sequences(campaign_id);
    CREATE INDEX IF NOT EXISTS idx_outreach_sequences_status ON outreach_sequences(status);
    CREATE INDEX IF NOT EXISTS idx_outreach_sequences_schedule ON outreach_sequences(status, next_scheduled_at, lease_expires_at);

    CREATE TABLE IF NOT EXISTS outreach_messages (
      id TEXT PRIMARY KEY,
      sequence_id TEXT NOT NULL REFERENCES outreach_sequences(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL CHECK(step_number IN (1, 2, 3)),
      subject TEXT NOT NULL,
      body_html TEXT NOT NULL,
      body_text TEXT NOT NULL,
      personalization_evidence TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL CHECK(status IN ('draft', 'approved', 'scheduled', 'sending', 'sent', 'delivered', 'bounced', 'failed', 'cancelled')) DEFAULT 'draft',
      provider_message_id TEXT DEFAULT NULL,
      attempt_count INTEGER NOT NULL DEFAULT 0,
      scheduled_at TEXT DEFAULT NULL,
      sent_at TEXT DEFAULT NULL,
      error_message TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_outreach_messages_seq_step ON outreach_messages(sequence_id, step_number);
    CREATE INDEX IF NOT EXISTS idx_outreach_messages_status ON outreach_messages(status);

    CREATE TABLE IF NOT EXISTS engagement_events (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      sequence_id TEXT REFERENCES outreach_sequences(id) ON DELETE SET NULL,
      message_id TEXT REFERENCES outreach_messages(id) ON DELETE SET NULL,
      campaign_id TEXT REFERENCES outreach_campaigns(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('sent', 'delivered', 'opened', 'clicked', 'replied', 'bounced', 'complained', 'unsubscribed', 'meeting_booked')),
      event_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      provider_event_id TEXT UNIQUE DEFAULT NULL,
      source_metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_engagement_events_lead_id ON engagement_events(lead_id);
    CREATE INDEX IF NOT EXISTS idx_engagement_events_seq_id ON engagement_events(sequence_id);
    CREATE INDEX IF NOT EXISTS idx_engagement_events_type ON engagement_events(event_type);

    CREATE TABLE IF NOT EXISTS suppression_list (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      reason TEXT NOT NULL CHECK(reason IN ('unsubscribed', 'bounced', 'manual', 'complaint')),
      source TEXT NOT NULL DEFAULT 'system',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_suppression_list_email ON suppression_list(email);

    CREATE TABLE IF NOT EXISTS crm_sync_records (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
      crm_provider TEXT NOT NULL CHECK(crm_provider IN ('hubspot', 'salesforce')),
      external_contact_id TEXT DEFAULT NULL,
      external_company_id TEXT DEFAULT NULL,
      external_deal_id TEXT DEFAULT NULL,
      sync_status TEXT NOT NULL CHECK(sync_status IN ('synced', 'pending', 'failed')) DEFAULT 'pending',
      last_synced_at TEXT DEFAULT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      error_message TEXT DEFAULT NULL,
      field_mappings TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_crm_sync_records_lead_id ON crm_sync_records(lead_id);
    CREATE INDEX IF NOT EXISTS idx_crm_sync_records_status ON crm_sync_records(sync_status);

    CREATE TABLE IF NOT EXISTS opportunity_scores (
      id TEXT PRIMARY KEY,
      lead_id TEXT NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
      opportunity_id TEXT REFERENCES opportunities(id) ON DELETE SET NULL,
      score INTEGER NOT NULL CHECK(score >= 0 AND score <= 100),
      readiness_tier TEXT NOT NULL CHECK(readiness_tier IN ('high', 'medium', 'low')),
      factors TEXT NOT NULL DEFAULT '[]',
      evidence_references TEXT NOT NULL DEFAULT '[]',
      scoring_version TEXT NOT NULL DEFAULT '1.0',
      is_stale INTEGER NOT NULL DEFAULT 0,
      evaluated_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_opportunity_scores_lead_id ON opportunity_scores(lead_id);
    CREATE INDEX IF NOT EXISTS idx_opportunity_scores_opp_id ON opportunity_scores(opportunity_id);

    -- Phase 6A: Adaptive Source Intelligence Engine Tables
    CREATE TABLE IF NOT EXISTS source_registry_entries (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      capabilities TEXT NOT NULL DEFAULT '[]',
      is_enabled INTEGER NOT NULL DEFAULT 1,
      is_configured INTEGER NOT NULL DEFAULT 0,
      health_status TEXT NOT NULL CHECK(health_status IN ('healthy', 'degraded', 'unreachable', 'unknown')) DEFAULT 'unknown',
      last_health_check TEXT DEFAULT NULL,
      cost_model TEXT NOT NULL DEFAULT '{}',
      rate_limits TEXT NOT NULL DEFAULT '{}',
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_source_registry_enabled ON source_registry_entries(is_enabled);
    CREATE INDEX IF NOT EXISTS idx_source_registry_provider ON source_registry_entries(provider_type);

    -- Crawlee Source Profiles for Bounded Web Crawling
    CREATE TABLE IF NOT EXISTS crawl_source_profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      start_urls TEXT NOT NULL DEFAULT '[]',
      allowed_domains TEXT NOT NULL DEFAULT '[]',
      crawl_depth INTEGER NOT NULL DEFAULT 2,
      max_pages INTEGER NOT NULL DEFAULT 50,
      concurrency INTEGER NOT NULL DEFAULT 2,
      delay_ms INTEGER NOT NULL DEFAULT 1000,
      extraction_types TEXT NOT NULL DEFAULT '["company_metadata","hiring_signals","technology_signals","public_contacts"]',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_crawl_profiles_active ON crawl_source_profiles(is_active);

    CREATE TABLE IF NOT EXISTS source_observations (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL REFERENCES source_registry_entries(id) ON DELETE CASCADE,
      source_record_id TEXT DEFAULT NULL,
      entity_type TEXT NOT NULL CHECK(entity_type IN ('company', 'contact', 'signal')),
      entity_key TEXT NOT NULL,
      observed_at TEXT NOT NULL DEFAULT (datetime('now')),
      retrieved_at TEXT NOT NULL DEFAULT (datetime('now')),
      source_url TEXT DEFAULT NULL,
      raw_payload TEXT NOT NULL DEFAULT '{}',
      field_provenance TEXT NOT NULL DEFAULT '{}',
      fingerprint TEXT NOT NULL,
      processing_status TEXT NOT NULL CHECK(processing_status IN ('raw', 'normalized', 'deduped', 'rejected', 'ingested')) DEFAULT 'raw',
      company_domain TEXT DEFAULT NULL,
      contact_email TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_source_obs_entity_key ON source_observations(entity_key);
    CREATE INDEX IF NOT EXISTS idx_source_obs_domain ON source_observations(company_domain);
    CREATE INDEX IF NOT EXISTS idx_source_obs_email ON source_observations(contact_email);
    CREATE INDEX IF NOT EXISTS idx_source_obs_source ON source_observations(source_id);

    CREATE TABLE IF NOT EXISTS source_signals (
      id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      company_domain TEXT NOT NULL,
      signal_category TEXT NOT NULL CHECK(signal_category IN ('hiring', 'technology', 'funding', 'expansion', 'procurement', 'first_party_intent')),
      source_id TEXT NOT NULL REFERENCES source_registry_entries(id) ON DELETE CASCADE,
      source_url TEXT DEFAULT NULL,
      event_timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      observed_at TEXT NOT NULL DEFAULT (datetime('now')),
      signal_text TEXT NOT NULL,
      structured_evidence TEXT NOT NULL DEFAULT '{}',
      confidence REAL NOT NULL DEFAULT 1.0,
      relevance_score INTEGER NOT NULL DEFAULT 50,
      dedup_fingerprint TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_source_signals_domain ON source_signals(company_domain);
    CREATE INDEX IF NOT EXISTS idx_source_signals_cat ON source_signals(signal_category);
    CREATE INDEX IF NOT EXISTS idx_source_signals_source ON source_signals(source_id);

    CREATE TABLE IF NOT EXISTS sourcing_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_icp_id TEXT REFERENCES icp_profiles(id) ON DELETE SET NULL,
      campaign_objective TEXT NOT NULL DEFAULT '',
      constraints TEXT NOT NULL DEFAULT '{}',
      selected_sources TEXT NOT NULL DEFAULT '[]',
      stages_pipeline TEXT NOT NULL DEFAULT '[]',
      estimated_cost REAL DEFAULT NULL,
      cost_known INTEGER NOT NULL DEFAULT 1,
      expected_yield INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL CHECK(status IN ('draft', 'approved', 'executing', 'completed', 'cancelled', 'failed')) DEFAULT 'draft',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sourcing_plans_status ON sourcing_plans(status);
    CREATE INDEX IF NOT EXISTS idx_sourcing_plans_icp ON sourcing_plans(target_icp_id);

    CREATE TABLE IF NOT EXISTS sourcing_jobs (
      id TEXT PRIMARY KEY,
      plan_id TEXT NOT NULL REFERENCES sourcing_plans(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK(status IN ('queued', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'queued',
      stage_counts TEXT NOT NULL DEFAULT '{}',
      records_sourced INTEGER NOT NULL DEFAULT 0,
      records_deduped INTEGER NOT NULL DEFAULT 0,
      records_screened INTEGER NOT NULL DEFAULT 0,
      records_qualified INTEGER NOT NULL DEFAULT 0,
      records_staged INTEGER NOT NULL DEFAULT 0,
      cost_incurred REAL NOT NULL DEFAULT 0.0,
      error_message TEXT DEFAULT NULL,
      claimed_by TEXT DEFAULT NULL,
      lease_expires_at TEXT DEFAULT NULL,
      started_at TEXT DEFAULT NULL,
      completed_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sourcing_jobs_status ON sourcing_jobs(status, lease_expires_at);
    CREATE INDEX IF NOT EXISTS idx_sourcing_jobs_plan ON sourcing_jobs(plan_id);

    CREATE TABLE IF NOT EXISTS source_attributions (
      id TEXT PRIMARY KEY,
      lead_id TEXT REFERENCES leads(id) ON DELETE CASCADE,
      candidate_id TEXT REFERENCES discovered_candidates(id) ON DELETE SET NULL,
      source_id TEXT NOT NULL REFERENCES source_registry_entries(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('discovery', 'signal', 'contact_resolution', 'enrichment')),
      confidence REAL NOT NULL DEFAULT 1.0,
      attributed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_source_attr_lead ON source_attributions(lead_id);
    CREATE INDEX IF NOT EXISTS idx_source_attr_source ON source_attributions(source_id);

    -- Phase 6B: Agentic Orchestration & Self-Optimizing Sourcing Tables
    CREATE TABLE IF NOT EXISTS agentic_sourcing_runs (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      natural_language_intent TEXT NOT NULL,
      target_icp_id TEXT REFERENCES icp_profiles(id) ON DELETE SET NULL,
      plan_id TEXT REFERENCES sourcing_plans(id) ON DELETE SET NULL,
      status TEXT NOT NULL CHECK(status IN ('planning', 'approved', 'running', 'completed', 'failed', 'cancelled')) DEFAULT 'planning',
      budget_limit REAL NOT NULL DEFAULT 50.0,
      budget_spent REAL NOT NULL DEFAULT 0.0,
      target_yield INTEGER NOT NULL DEFAULT 25,
      yield_achieved INTEGER NOT NULL DEFAULT 0,
      efficiency_score REAL NOT NULL DEFAULT 0.0,
      execution_strategy TEXT NOT NULL DEFAULT '{}',
      error_message TEXT DEFAULT NULL,
      started_at TEXT DEFAULT NULL,
      completed_at TEXT DEFAULT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_agentic_runs_status ON agentic_sourcing_runs(status);
    CREATE INDEX IF NOT EXISTS idx_agentic_runs_created ON agentic_sourcing_runs(created_at DESC);

    CREATE TABLE IF NOT EXISTS agentic_sourcing_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL REFERENCES agentic_sourcing_runs(id) ON DELETE CASCADE,
      step_number INTEGER NOT NULL,
      tool_name TEXT NOT NULL,
      tool_input TEXT NOT NULL DEFAULT '{}',
      tool_output TEXT NOT NULL DEFAULT '{}',
      rationale TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'success', 'failed', 'skipped')) DEFAULT 'success',
      cost_incurred REAL NOT NULL DEFAULT 0.0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_agentic_steps_run ON agentic_sourcing_steps(run_id, step_number);

    CREATE TABLE IF NOT EXISTS sourcing_optimization_weights (
      id TEXT PRIMARY KEY,
      source_id TEXT UNIQUE NOT NULL REFERENCES source_registry_entries(id) ON DELETE CASCADE,
      empirical_yield_rate REAL NOT NULL DEFAULT 0.5,
      empirical_duplicate_rate REAL NOT NULL DEFAULT 0.1,
      empirical_reply_rate REAL NOT NULL DEFAULT 0.0,
      empirical_meeting_rate REAL NOT NULL DEFAULT 0.0,
      quality_multiplier REAL NOT NULL DEFAULT 1.0,
      learned_cost_efficiency REAL NOT NULL DEFAULT 1.0,
      total_leads_attributed INTEGER NOT NULL DEFAULT 0,
      total_meetings_attributed INTEGER NOT NULL DEFAULT 0,
      total_pipeline_attributed REAL NOT NULL DEFAULT 0.0,
      last_optimized_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sow_source ON sourcing_optimization_weights(source_id);

    CREATE TABLE IF NOT EXISTS sourcing_experiments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL CHECK(status IN ('running', 'completed', 'failed')) DEFAULT 'completed',
      baseline_strategy TEXT NOT NULL DEFAULT 'deterministic_phase6a',
      agentic_strategy TEXT NOT NULL DEFAULT 'adaptive_agentic_phase6b',
      sample_size INTEGER NOT NULL DEFAULT 100,
      baseline_metrics TEXT NOT NULL DEFAULT '{}',
      agentic_metrics TEXT NOT NULL DEFAULT '{}',
      uplift_summary TEXT NOT NULL DEFAULT '{}',
      concluded_at TEXT NOT NULL DEFAULT (datetime('now')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_sourcing_exp_created ON sourcing_experiments(created_at DESC);
  `);

  // Safe additive migrations for existing tables
  const leadsColumns = db.prepare('PRAGMA table_info(leads)').all() as Array<{ name: string }>;
  const leadColNames = leadsColumns.map((c) => c.name);
  if (!leadColNames.includes('qualification_breakdown')) {
    db.exec('ALTER TABLE leads ADD COLUMN qualification_breakdown TEXT DEFAULT NULL;');
  }
  if (!leadColNames.includes('qualified_at')) {
    db.exec('ALTER TABLE leads ADD COLUMN qualified_at TEXT DEFAULT NULL;');
  }
  if (!leadColNames.includes('source_provider')) {
    db.exec("ALTER TABLE leads ADD COLUMN source_provider TEXT DEFAULT 'manual';");
  }
  if (!leadColNames.includes('source_url')) {
    db.exec('ALTER TABLE leads ADD COLUMN source_url TEXT DEFAULT NULL;');
  }
  if (!leadColNames.includes('email_verification_status')) {
    db.exec("ALTER TABLE leads ADD COLUMN email_verification_status TEXT DEFAULT 'unverified';");
  }
  if (!leadColNames.includes('enrichment_provenance')) {
    db.exec('ALTER TABLE leads ADD COLUMN enrichment_provenance TEXT DEFAULT NULL;');
  }
  if (!leadColNames.includes('is_mock')) {
    db.exec('ALTER TABLE leads ADD COLUMN is_mock INTEGER NOT NULL DEFAULT 0;');
  }
  if (!leadColNames.includes('is_qualification_stale')) {
    db.exec('ALTER TABLE leads ADD COLUMN is_qualification_stale INTEGER NOT NULL DEFAULT 0;');
  }
  if (!leadColNames.includes('enriched_at')) {
    db.exec('ALTER TABLE leads ADD COLUMN enriched_at TEXT DEFAULT NULL;');
  }
  if (!leadColNames.includes('last_qualification_error')) {
    db.exec('ALTER TABLE leads ADD COLUMN last_qualification_error TEXT DEFAULT NULL;');
  }
  if (!leadColNames.includes('conflict_history')) {
    db.exec("ALTER TABLE leads ADD COLUMN conflict_history TEXT DEFAULT '[]';");
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_leads_stale ON leads(is_qualification_stale);');

  const icpColumns = db.prepare('PRAGMA table_info(icp_profiles)').all() as Array<{ name: string }>;
  const icpColNames = icpColumns.map((c) => c.name);
  if (!icpColNames.includes('scoring_weights')) {
    db.exec('ALTER TABLE icp_profiles ADD COLUMN scoring_weights TEXT NOT NULL DEFAULT \'{"industry":30,"roleSeniority":25,"intentTriggers":30,"techStack":15}\';');
  }

  // Phase 3C: Check if discovery_jobs needs status constraint expansion for queued, partially_completed, cancelled
  const discoveryJobMaster = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='discovery_jobs'").get() as { sql: string } | undefined;
  if (discoveryJobMaster) {
    const hasNewStatuses = discoveryJobMaster.sql.includes('partially_completed') || discoveryJobMaster.sql.includes('queued');
    if (!hasNewStatuses) {
      // Rebuild discovery_jobs table to expand status CHECK constraint safely without data loss
      db.exec('PRAGMA foreign_keys = OFF;');
      db.exec(`
        CREATE TABLE discovery_jobs_p3c (
          id TEXT PRIMARY KEY,
          provider TEXT NOT NULL,
          mode TEXT NOT NULL CHECK(mode IN ('real', 'demo')),
          status TEXT NOT NULL CHECK(status IN ('queued', 'pending', 'running', 'completed', 'partially_completed', 'failed', 'cancelled')),
          query_params TEXT NOT NULL,
          total_found INTEGER NOT NULL DEFAULT 0,
          candidates_found INTEGER NOT NULL DEFAULT 0,
          candidates_processed INTEGER NOT NULL DEFAULT 0,
          candidates_ingested INTEGER NOT NULL DEFAULT 0,
          candidates_skipped INTEGER NOT NULL DEFAULT 0,
          candidates_failed INTEGER NOT NULL DEFAULT 0,
          error_message TEXT DEFAULT NULL,
          last_error_category TEXT DEFAULT NULL,
          attempt_count INTEGER NOT NULL DEFAULT 0,
          max_retries INTEGER NOT NULL DEFAULT 3,
          retry_count INTEGER NOT NULL DEFAULT 0,
          next_retry_at TEXT DEFAULT NULL,
          cancel_requested_at TEXT DEFAULT NULL,
          claimed_by TEXT DEFAULT NULL,
          claimed_at TEXT DEFAULT NULL,
          lease_expires_at TEXT DEFAULT NULL,
          started_at TEXT DEFAULT NULL,
          completed_at TEXT DEFAULT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        INSERT INTO discovery_jobs_p3c (
          id, provider, mode, status, query_params, total_found, candidates_found,
          error_message, created_at, completed_at
        )
        SELECT
          id, provider, mode,
          CASE WHEN status = 'pending' THEN 'queued' ELSE status END,
          query_params, total_found, total_found,
          error_message, created_at, completed_at
        FROM discovery_jobs;

        DROP TABLE discovery_jobs;
        ALTER TABLE discovery_jobs_p3c RENAME TO discovery_jobs;

        CREATE INDEX IF NOT EXISTS idx_discovery_jobs_status ON discovery_jobs(status);
        CREATE INDEX IF NOT EXISTS idx_discovery_jobs_created_at ON discovery_jobs(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_discovery_jobs_lease ON discovery_jobs(status, lease_expires_at);
      `);
      db.exec('PRAGMA foreign_keys = ON;');
    }
  }

  // Ensure all columns exist on discovery_jobs
  const jobCols = db.prepare('PRAGMA table_info(discovery_jobs)').all() as Array<{ name: string }>;
  const jobColNames = jobCols.map((c) => c.name);
  if (!jobColNames.includes('candidates_found')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN candidates_found INTEGER NOT NULL DEFAULT 0;');
  }
  if (!jobColNames.includes('candidates_processed')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN candidates_processed INTEGER NOT NULL DEFAULT 0;');
  }
  if (!jobColNames.includes('candidates_ingested')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN candidates_ingested INTEGER NOT NULL DEFAULT 0;');
  }
  if (!jobColNames.includes('candidates_skipped')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN candidates_skipped INTEGER NOT NULL DEFAULT 0;');
  }
  if (!jobColNames.includes('candidates_failed')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN candidates_failed INTEGER NOT NULL DEFAULT 0;');
  }
  if (!jobColNames.includes('last_error_category')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN last_error_category TEXT DEFAULT NULL;');
  }
  if (!jobColNames.includes('attempt_count')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN attempt_count INTEGER NOT NULL DEFAULT 0;');
  }
  if (!jobColNames.includes('max_retries')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN max_retries INTEGER NOT NULL DEFAULT 3;');
  }
  if (!jobColNames.includes('retry_count')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0;');
  }
  if (!jobColNames.includes('next_retry_at')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN next_retry_at TEXT DEFAULT NULL;');
  }
  if (!jobColNames.includes('cancel_requested_at')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN cancel_requested_at TEXT DEFAULT NULL;');
  }
  if (!jobColNames.includes('claimed_by')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN claimed_by TEXT DEFAULT NULL;');
  }
  if (!jobColNames.includes('claimed_at')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN claimed_at TEXT DEFAULT NULL;');
  }
  if (!jobColNames.includes('lease_expires_at')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN lease_expires_at TEXT DEFAULT NULL;');
  }
  if (!jobColNames.includes('started_at')) {
    db.exec('ALTER TABLE discovery_jobs ADD COLUMN started_at TEXT DEFAULT NULL;');
  }
  if (!jobColNames.includes('updated_at')) {
    db.exec("ALTER TABLE discovery_jobs ADD COLUMN updated_at TEXT NOT NULL DEFAULT (datetime('now'));");
  }

  // Discovered Candidates additive columns
  const candCols = db.prepare('PRAGMA table_info(discovered_candidates)').all() as Array<{ name: string }>;
  const candColNames = candCols.map((c) => c.name);
  if (!candColNames.includes('processing_error')) {
    db.exec('ALTER TABLE discovered_candidates ADD COLUMN processing_error TEXT DEFAULT NULL;');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_discovery_jobs_lease ON discovery_jobs(status, lease_expires_at);');

  // Phase 4: Knowledge Documents additive columns and type migration
  const kdMaster = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='knowledge_documents'").get() as { sql: string } | undefined;
  if (kdMaster && !kdMaster.sql.includes('docx')) {
    db.exec('PRAGMA foreign_keys = OFF;');
    db.exec(`
      CREATE TABLE knowledge_documents_p4 (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL CHECK(category IN ('Product Specs', 'Battlecards', 'Case Studies', 'Pricing', 'Compliance')),
        type TEXT NOT NULL CHECK(type IN ('pdf', 'doc', 'docx', 'txt', 'md', 'url', 'notion')),
        size_or_tokens TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('Indexed', 'Syncing', 'Ready')) DEFAULT 'Indexed',
        uploaded_at TEXT NOT NULL,
        summary TEXT NOT NULL DEFAULT '',
        file_path TEXT DEFAULT NULL,
        file_size INTEGER NOT NULL DEFAULT 0,
        mime_type TEXT DEFAULT NULL,
        content_hash TEXT DEFAULT NULL,
        processing_status TEXT NOT NULL DEFAULT 'uploaded',
        error_message TEXT DEFAULT NULL,
        chunk_count INTEGER NOT NULL DEFAULT 0,
        indexed_at TEXT DEFAULT NULL,
        embedding_model TEXT DEFAULT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO knowledge_documents_p4 (
        id, title, category, type, size_or_tokens, status, uploaded_at, summary,
        created_at, updated_at
      )
      SELECT
        id, title, category, type, size_or_tokens, status, uploaded_at, summary,
        created_at, updated_at
      FROM knowledge_documents;

      DROP TABLE knowledge_documents;
      ALTER TABLE knowledge_documents_p4 RENAME TO knowledge_documents;

      CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_documents(category);
    `);
    db.exec('PRAGMA foreign_keys = ON;');
  }

  const kdCols = db.prepare('PRAGMA table_info(knowledge_documents)').all() as Array<{ name: string }>;
  const kdColNames = kdCols.map((c) => c.name);
  if (!kdColNames.includes('file_path')) {
    db.exec('ALTER TABLE knowledge_documents ADD COLUMN file_path TEXT DEFAULT NULL;');
  }
  if (!kdColNames.includes('file_size')) {
    db.exec('ALTER TABLE knowledge_documents ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0;');
  }
  if (!kdColNames.includes('mime_type')) {
    db.exec('ALTER TABLE knowledge_documents ADD COLUMN mime_type TEXT DEFAULT NULL;');
  }
  if (!kdColNames.includes('content_hash')) {
    db.exec('ALTER TABLE knowledge_documents ADD COLUMN content_hash TEXT DEFAULT NULL;');
  }
  if (!kdColNames.includes('processing_status')) {
    db.exec("ALTER TABLE knowledge_documents ADD COLUMN processing_status TEXT NOT NULL DEFAULT 'uploaded';");
  }
  if (!kdColNames.includes('error_message')) {
    db.exec('ALTER TABLE knowledge_documents ADD COLUMN error_message TEXT DEFAULT NULL;');
  }
  if (!kdColNames.includes('chunk_count')) {
    db.exec('ALTER TABLE knowledge_documents ADD COLUMN chunk_count INTEGER NOT NULL DEFAULT 0;');
  }
  if (!kdColNames.includes('indexed_at')) {
    db.exec('ALTER TABLE knowledge_documents ADD COLUMN indexed_at TEXT DEFAULT NULL;');
  }
  if (!kdColNames.includes('embedding_model')) {
    db.exec('ALTER TABLE knowledge_documents ADD COLUMN embedding_model TEXT DEFAULT NULL;');
  }

  db.exec('CREATE INDEX IF NOT EXISTS idx_knowledge_processing_status ON knowledge_documents(processing_status);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_knowledge_content_hash ON knowledge_documents(content_hash);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc_id ON knowledge_chunks(document_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_model ON knowledge_chunks(embedding_model);');

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
        id, title, category, type, size_or_tokens, status, uploaded_at, summary,
        processing_status, chunk_count, file_size
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'indexed', 3, ?)
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
        fileSize: 2516582,
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
        fileSize: 870400,
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
          doc.summary,
          doc.fileSize
        );
      }
    });

    insertDocsTransaction(initialDocs);
  }

  // Seed default knowledge chunks if chunks table is empty
  const chunksCount = (db.prepare('SELECT COUNT(*) as count FROM knowledge_chunks').get() as { count: number }).count;
  if (chunksCount === 0) {
    const insertChunk = db.prepare(`
      INSERT INTO knowledge_chunks (
        id, document_id, chunk_index, content, page_number, section_title, char_count
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    const seedChunks = [
      {
        id: 'chunk-doc-1-0',
        document_id: 'doc-1',
        chunk_index: 0,
        content: 'LeadForge AI is an autonomous inbound and outbound revenue acceleration platform designed for B2B enterprises. The system orchestrates multi-source company discovery, verified executive contact extraction, and real-time buying trigger synthesis to qualify high-conversion pipeline opportunities.',
        page_number: 1,
        section_title: 'Executive Platform Overview',
        char_count: 312,
      },
      {
        id: 'chunk-doc-1-1',
        document_id: 'doc-1',
        chunk_index: 1,
        content: 'Deterministic ICP Qualification Engine: LeadForge evaluates candidate leads across target industry alignment, employee headcount thresholds, role and seniority hierarchy, verified email deliverability via Hunter.io, and technology stack footprint. Scored criteria produce explainable point breakdowns.',
        page_number: 2,
        section_title: 'ICP Evaluation & Scoring Architecture',
        char_count: 322,
      },
      {
        id: 'chunk-doc-1-2',
        document_id: 'doc-1',
        chunk_index: 2,
        content: 'Enterprise Integration & Compliance: Bidirectional CRM synchronization connects directly with Salesforce and HubSpot. All data pipelines adhere strictly to SOC2 Type II, ISO 27001, and GDPR compliance regulations with verifiable field-level provenance audit logs.',
        page_number: 3,
        section_title: 'Security, Privacy & CRM Connectors',
        char_count: 271,
      },
      {
        id: 'chunk-doc-2-0',
        document_id: 'doc-2',
        chunk_index: 0,
        content: 'Enterprise Tier Licensing: Annual enterprise subscription starts at $24,000 per year billed annually. The plan includes up to 25 revenue team seats, 50,000 monthly verified enrichment credits, custom webhooks, and a dedicated Customer Success Architect with guaranteed 99.9% SLA.',
        page_number: 1,
        section_title: 'Enterprise Tier & Annual Contracts',
        char_count: 297,
      },
      {
        id: 'chunk-doc-2-1',
        document_id: 'doc-2',
        chunk_index: 1,
        content: 'Growth Tier Licensing: Monthly subscription starts at $1,200 per month ($12,000 billed annually). Includes 5 seats and 10,000 monthly enrichment credits. Additional contact credits over quota are billed at $0.08 per credit with real-time usage telemetry.',
        page_number: 1,
        section_title: 'Growth Tier & Overage Rates',
        char_count: 260,
      },
      {
        id: 'chunk-doc-2-2',
        document_id: 'doc-2',
        chunk_index: 2,
        content: 'Discount Guidelines & Onboarding: Multi-year commitment discount: 10% discount for 2-year upfront commitment, 15% discount for 3-year commitment. Implementation onboarding and custom Salesforce field mapping carries a one-time setup fee of $2,500.',
        page_number: 2,
        section_title: 'Multi-Year Discounts & Implementation Fees',
        char_count: 267,
      },
    ];

    const insertChunksTransaction = db.transaction((chunksList) => {
      for (const ch of chunksList) {
        insertChunk.run(
          ch.id,
          ch.document_id,
          ch.chunk_index,
          ch.content,
          ch.page_number,
          ch.section_title,
          ch.char_count
        );
      }
    });

    insertChunksTransaction(seedChunks);

    // Update chunk_count and processing_status on seeded docs
    db.prepare("UPDATE knowledge_documents SET chunk_count = 3, processing_status = 'indexed' WHERE id IN ('doc-1', 'doc-2')").run();
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

  // Seed default opportunities matching leads if opportunities table is empty
  const oppCount = (db.prepare('SELECT COUNT(*) as count FROM opportunities').get() as { count: number }).count;
  if (oppCount === 0) {
    const existingLeads = db.prepare('SELECT id, name, company, status, deal_value, score FROM leads').all() as Array<{
      id: string;
      name: string;
      company: string;
      status: string;
      deal_value: number;
      score: number;
    }>;

    if (existingLeads.length > 0) {
      const insertOpp = db.prepare(`
        INSERT INTO opportunities (
          id, lead_id, title, stage, deal_value, confidence_score, expected_close_date
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '+30 days'))
      `);

      const insertOppsTx = db.transaction((leadsList: typeof existingLeads) => {
        for (const lead of leadsList) {
          insertOpp.run(
            `opp-${lead.id}`,
            lead.id,
            `${lead.name} • ${lead.company}`,
            lead.status,
            lead.deal_value || 0,
            lead.score || 0
          );
        }
      });

      insertOppsTx(existingLeads);
    }
  }

  // Phase 5: Seed default outreach campaign if none exists
  const campCount = (db.prepare('SELECT COUNT(*) as count FROM outreach_campaigns').get() as { count: number }).count;
  if (campCount === 0) {
    const insertCamp = db.prepare(`
      INSERT INTO outreach_campaigns (
        id, name, description, target_icp_id, status, sending_limits, schedule_window
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    insertCamp.run(
      'camp-1',
      'Enterprise Growth Sequence',
      'Autonomous 3-step outreach sequence targeting high-ICP leads with validated buying triggers and personalized collateral.',
      'icp-default',
      'active',
      JSON.stringify({ maxPerDay: 50, minIntervalSeconds: 60 }),
      JSON.stringify({ timezone: 'UTC', allowedDays: [1, 2, 3, 4, 5], startHour: 9, endHour: 17 })
    );
  }

  // Phase 5: Seed suppression list if empty
  const supCount = (db.prepare('SELECT COUNT(*) as count FROM suppression_list').get() as { count: number }).count;
  if (supCount === 0) {
    const insertSup = db.prepare(`
      INSERT INTO suppression_list (id, email, reason, source)
      VALUES (?, ?, ?, ?)
    `);
    insertSup.run('sup-1', 'optout-test@example.com', 'unsubscribed', 'manual');
  }

  // Phase 6A: Seed default source registry entries
  const sourceRegCount = (db.prepare('SELECT COUNT(*) as count FROM source_registry_entries').get() as { count: number }).count;
  if (sourceRegCount === 0) {
    const insertSource = db.prepare(`
      INSERT INTO source_registry_entries (
        id, name, provider_type, capabilities, is_enabled, is_configured, health_status,
        last_health_check, cost_model, rate_limits, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?, ?, ?)
    `);

    const hasHunterKey = Boolean(process.env.HUNTER_API_KEY && process.env.HUNTER_API_KEY.trim() !== '');

    const defaultSources = [
      {
        id: 'hunter',
        name: 'Hunter.io Domain & Email Intelligence',
        providerType: 'hunter',
        capabilities: ['contact_discovery', 'contact_verification'],
        isEnabled: 1,
        isConfigured: hasHunterKey ? 1 : 0,
        healthStatus: hasHunterKey ? 'healthy' : 'degraded',
        costModel: { perRecord: 0.04, perVerification: 0.01, currency: 'USD' },
        rateLimits: { requestsPerMinute: 60, dailyQuota: 500 },
        metadata: { supportedSearch: ['domain', 'company', 'role'], sourceTier: 'premium_enrichment' },
      },
      {
        id: 'first_party_crm',
        name: 'First-Party CRM & Lead Intelligence',
        providerType: 'first_party_crm',
        capabilities: ['first_party_records', 'company_discovery'],
        isEnabled: 1,
        isConfigured: 1,
        healthStatus: 'healthy',
        costModel: { perRecord: 0.00, perVerification: 0.00, currency: 'USD' },
        rateLimits: { requestsPerMinute: 600, dailyQuota: 50000 },
        metadata: { supportedSearch: ['status', 'score', 'industry'], sourceTier: 'first_party' },
      },
      {
        id: 'job_board_signals',
        name: 'Job Board Hiring & Team Growth Signals',
        providerType: 'hiring_signals',
        capabilities: ['hiring_signals', 'company_discovery'],
        isEnabled: 1,
        isConfigured: 1,
        healthStatus: 'healthy',
        costModel: { perRecord: 0.01, perVerification: 0.00, currency: 'USD' },
        rateLimits: { requestsPerMinute: 120, dailyQuota: 5000 },
        metadata: { supportedSearch: ['hiringKeywords', 'roleCategories'], sourceTier: 'signal_intelligence' },
      },
      {
        id: 'tech_stack_signals',
        name: 'Technology Stack & Infrastructure Signals',
        providerType: 'technology_signals',
        capabilities: ['technology_signals', 'company_discovery'],
        isEnabled: 1,
        isConfigured: 1,
        healthStatus: 'healthy',
        costModel: { perRecord: 0.02, perVerification: 0.00, currency: 'USD' },
        rateLimits: { requestsPerMinute: 100, dailyQuota: 3000 },
        metadata: { supportedSearch: ['techStack', 'domain'], sourceTier: 'signal_intelligence' },
      },
      {
        id: 'demo_adaptive_source',
        name: 'Adaptive Demo Multi-Signal Provider',
        providerType: 'demo_signals',
        capabilities: ['company_discovery', 'contact_discovery', 'hiring_signals', 'technology_signals', 'funding_signals'],
        isEnabled: 1,
        isConfigured: 1,
        healthStatus: 'healthy',
        costModel: { perRecord: 0.00, perVerification: 0.00, currency: 'USD' },
        rateLimits: { requestsPerMinute: 1000, dailyQuota: 100000 },
        metadata: { isDemo: true, sourceTier: 'demo' },
      },
      {
        id: 'crawlee_web',
        name: 'Crawlee Public Web Intelligence',
        providerType: 'crawlee_web',
        capabilities: ['company_discovery', 'hiring_signals', 'technology_signals'],
        isEnabled: 1,
        isConfigured: 1,
        healthStatus: 'healthy',
        costModel: { perRecord: 0.00, perVerification: 0.00, currency: 'USD' },
        rateLimits: { requestsPerMinute: 60, dailyQuota: 2000 },
        metadata: { supportedSearch: ['startUrls', 'allowedDomains', 'customDomain'], sourceTier: 'open_source_crawler' },
      },
    ];

    const insertSourcesTx = db.transaction((sources) => {
      for (const s of sources) {
        insertSource.run(
          s.id,
          s.name,
          s.providerType,
          JSON.stringify(s.capabilities),
          s.isEnabled,
          s.isConfigured,
          s.healthStatus,
          JSON.stringify(s.costModel),
          JSON.stringify(s.rateLimits),
          JSON.stringify(s.metadata)
        );
      }
    });

    insertSourcesTx(defaultSources);
  }

  // Ensure crawlee_web is registered in existing databases
  db.prepare(`
    INSERT OR IGNORE INTO source_registry_entries (
      id, name, provider_type, capabilities, is_enabled, is_configured,
      health_status, cost_model, rate_limits, metadata, created_at, updated_at
    ) VALUES (
      'crawlee_web',
      'Crawlee Public Web Intelligence',
      'crawlee_web',
      '["company_discovery","hiring_signals","technology_signals"]',
      1,
      1,
      'healthy',
      '{"perRecord":0.00,"perVerification":0.00,"currency":"USD"}',
      '{"requestsPerMinute":60,"dailyQuota":2000}',
      '{"supportedSearch":["startUrls","allowedDomains","customDomain"],"sourceTier":"open_source_crawler"}',
      datetime('now'),
      datetime('now')
    )
  `).run();

  // Seed default crawl source profile if empty
  const profileCount = (db.prepare('SELECT COUNT(*) as count FROM crawl_source_profiles').get() as { count: number }).count;
  if (profileCount === 0) {
    db.prepare(`
      INSERT INTO crawl_source_profiles (
        id, name, description, start_urls, allowed_domains, crawl_depth,
        max_pages, concurrency, delay_ms, extraction_types, is_active,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(
      'sp-default-tech-hub',
      'Permitted Tech Companies & Public Sitemaps',
      'Verified crawl profile targeting public corporate documentation, leadership, and careers pages.',
      JSON.stringify(['https://ramp.com', 'https://stripe.com']),
      JSON.stringify(['ramp.com', 'stripe.com']),
      2,
      25,
      2,
      1000,
      JSON.stringify(['company_metadata', 'hiring_signals', 'technology_signals', 'public_contacts']),
      1
    );
  }

  // Phase 6A: Seed sample business signals if empty
  const signalCount = (db.prepare('SELECT COUNT(*) as count FROM source_signals').get() as { count: number }).count;
  if (signalCount === 0) {
    const insertSignal = db.prepare(`
      INSERT INTO source_signals (
        id, company_name, company_domain, signal_category, source_id, source_url,
        event_timestamp, observed_at, signal_text, structured_evidence,
        confidence, relevance_score, dedup_fingerprint
      ) VALUES (?, ?, ?, ?, ?, ?, datetime('now', '-2 days'), datetime('now'), ?, ?, ?, ?, ?)
    `);

    const initialSignals = [
      {
        id: 'sig-1',
        companyName: 'CloudScale Nexus',
        companyDomain: 'cloudscale.io',
        category: 'hiring',
        sourceId: 'job_board_signals',
        sourceUrl: 'https://careers.cloudscale.io/postings/revops-lead',
        signalText: 'Hiring 8 Account Executives and VP Revenue Operations for Outbound Expansion',
        evidence: { headcountTarget: 8, roles: ['Account Executive', 'VP RevOps'], department: 'Sales' },
        confidence: 0.96,
        relevanceScore: 95,
        fingerprint: 'cloudscale.io:hiring:revops-8-ae',
      },
      {
        id: 'sig-2',
        companyName: 'CloudScale Nexus',
        companyDomain: 'cloudscale.io',
        category: 'funding',
        sourceId: 'demo_adaptive_source',
        sourceUrl: 'https://techcrunch.com/cloudscale-series-b-28m',
        signalText: 'Announced $28M Series B round led by Sequoia Capital for Enterprise AI Growth',
        evidence: { round: 'Series B', amount: 28000000, currency: 'USD', leadInvestor: 'Sequoia Capital' },
        confidence: 0.98,
        relevanceScore: 96,
        fingerprint: 'cloudscale.io:funding:series-b-28m',
      },
      {
        id: 'sig-3',
        companyName: 'Apex Data Labs',
        companyDomain: 'apexdata.ai',
        category: 'expansion',
        sourceId: 'demo_adaptive_source',
        sourceUrl: 'https://apexdata.ai/news/emea-expansion',
        signalText: 'Opening EMEA headquarters in London to support international enterprise demand',
        evidence: { targetRegion: 'EMEA', city: 'London', entityType: 'Regional HQ' },
        confidence: 0.91,
        relevanceScore: 88,
        fingerprint: 'apexdata.ai:expansion:emea-london',
      },
      {
        id: 'sig-4',
        companyName: 'Apex Data Labs',
        companyDomain: 'apexdata.ai',
        category: 'technology',
        sourceId: 'tech_stack_signals',
        sourceUrl: 'https://apexdata.ai/engineering/stack-snowflake',
        signalText: 'Migrated primary analytics warehouse to Snowflake and deployed Segment tracking',
        evidence: { technologiesAdded: ['Snowflake', 'Segment', 'HubSpot'], previousStack: 'Redshift' },
        confidence: 0.94,
        relevanceScore: 92,
        fingerprint: 'apexdata.ai:technology:snowflake-migration',
      },
      {
        id: 'sig-5',
        companyName: 'FinSphere Payments',
        companyDomain: 'finsphere.co',
        category: 'hiring',
        sourceId: 'job_board_signals',
        sourceUrl: 'https://finsphere.co/jobs/head-of-revops',
        signalText: 'CEO announced active executive search for Head of RevOps and Outbound SDR Lead',
        evidence: { executiveSearch: true, targetRole: 'Head of RevOps', urgency: 'Immediate' },
        confidence: 0.93,
        relevanceScore: 91,
        fingerprint: 'finsphere.co:hiring:head-of-revops',
      },
      {
        id: 'sig-6',
        companyName: 'FinSphere Payments',
        companyDomain: 'finsphere.co',
        category: 'expansion',
        sourceId: 'demo_adaptive_source',
        sourceUrl: 'https://finsphere.co/press/global-settlement',
        signalText: 'Launched multi-currency cross-border settlement infrastructure for enterprise B2B',
        evidence: { feature: 'Cross-Border Settlements', markets: ['US', 'EU', 'APAC'] },
        confidence: 0.90,
        relevanceScore: 87,
        fingerprint: 'finsphere.co:expansion:cross-border',
      },
      {
        id: 'sig-7',
        companyName: 'Veloce Robotics',
        companyDomain: 'veloce-robotics.tech',
        category: 'funding',
        sourceId: 'demo_adaptive_source',
        sourceUrl: 'https://roboticsinsider.com/veloce-series-a',
        signalText: 'Closed $15M Series A funding round for warehouse automation hardware',
        evidence: { round: 'Series A', amount: 15000000, currency: 'USD' },
        confidence: 0.92,
        relevanceScore: 84,
        fingerprint: 'veloce-robotics.tech:funding:series-a-15m',
      },
      {
        id: 'sig-8',
        companyName: 'Krypton Security',
        companyDomain: 'kryptonsec.com',
        category: 'hiring',
        sourceId: 'job_board_signals',
        sourceUrl: 'https://kryptonsec.com/careers/sales-engineers',
        signalText: 'Scaling Enterprise Outbound: Hiring 4 Sales Engineers and 2 Outbound SDRs',
        evidence: { department: 'Sales Engineering', headcount: 6 },
        confidence: 0.89,
        relevanceScore: 82,
        fingerprint: 'kryptonsec.com:hiring:sales-engineers-6',
      },
      {
        id: 'sig-9',
        companyName: 'Krypton Security',
        companyDomain: 'kryptonsec.com',
        category: 'technology',
        sourceId: 'tech_stack_signals',
        sourceUrl: 'https://kryptonsec.com/trust/soc2',
        signalText: 'Completed SOC2 Type II compliance renewal and deployed AWS Security Hub',
        evidence: { compliance: 'SOC2 Type II', cloud: 'AWS Security Hub' },
        confidence: 0.95,
        relevanceScore: 80,
        fingerprint: 'kryptonsec.com:technology:soc2-aws',
      },
    ];

    const insertSignalsTx = db.transaction((signals) => {
      for (const sig of signals) {
        insertSignal.run(
          sig.id,
          sig.companyName,
          sig.companyDomain,
          sig.category,
          sig.sourceId,
          sig.sourceUrl,
          sig.signalText,
          JSON.stringify(sig.evidence),
          sig.confidence,
          sig.relevanceScore,
          sig.fingerprint
        );
      }
    });

    insertSignalsTx(initialSignals);
  }

  // Phase 6A: Seed default source attributions for initial leads if empty
  const attrCount = (db.prepare('SELECT COUNT(*) as count FROM source_attributions').get() as { count: number }).count;
  if (attrCount === 0) {
    const insertAttr = db.prepare(`
      INSERT INTO source_attributions (
        id, lead_id, candidate_id, source_id, role, confidence
      ) VALUES (?, ?, NULL, ?, ?, ?)
    `);

    const initialAttributions = [
      { id: 'attr-1', leadId: 'lead-1', sourceId: 'demo_adaptive_source', role: 'discovery', confidence: 0.95 },
      { id: 'attr-2', leadId: 'lead-1', sourceId: 'job_board_signals', role: 'signal', confidence: 0.96 },
      { id: 'attr-3', leadId: 'lead-1', sourceId: 'hunter', role: 'contact_resolution', confidence: 0.98 },
      { id: 'attr-4', leadId: 'lead-2', sourceId: 'demo_adaptive_source', role: 'discovery', confidence: 0.92 },
      { id: 'attr-5', leadId: 'lead-2', sourceId: 'tech_stack_signals', role: 'signal', confidence: 0.94 },
      { id: 'attr-6', leadId: 'lead-2', sourceId: 'hunter', role: 'contact_resolution', confidence: 0.97 },
      { id: 'attr-7', leadId: 'lead-3', sourceId: 'job_board_signals', role: 'signal', confidence: 0.91 },
      { id: 'attr-8', leadId: 'lead-3', sourceId: 'demo_adaptive_source', role: 'discovery', confidence: 0.90 },
      { id: 'attr-9', leadId: 'lead-4', sourceId: 'demo_adaptive_source', role: 'discovery', confidence: 0.88 },
      { id: 'attr-10', leadId: 'lead-5', sourceId: 'first_party_crm', role: 'discovery', confidence: 1.00 },
      { id: 'attr-11', leadId: 'lead-6', sourceId: 'job_board_signals', role: 'signal', confidence: 0.85 },
      { id: 'attr-12', leadId: 'lead-6', sourceId: 'hunter', role: 'contact_resolution', confidence: 0.90 },
    ];

    const insertAttrTx = db.transaction((attrs) => {
      for (const a of attrs) {
        insertAttr.run(a.id, a.leadId, a.sourceId, a.role, a.confidence);
      }
    });

    insertAttrTx(initialAttributions);
  }

  // Phase 6B: Seed default sourcing optimization weights if empty
  const sowCount = (db.prepare('SELECT COUNT(*) as count FROM sourcing_optimization_weights').get() as { count: number }).count;
  if (sowCount === 0) {
    const insertSow = db.prepare(`
      INSERT INTO sourcing_optimization_weights (
        id, source_id, empirical_yield_rate, empirical_duplicate_rate, empirical_reply_rate, empirical_meeting_rate,
        quality_multiplier, learned_cost_efficiency, total_leads_attributed, total_meetings_attributed, total_pipeline_attributed
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const initialWeights = [
      { id: 'sow-first_party_crm', sourceId: 'first_party_crm', yieldRate: 0.88, dupRate: 0.02, replyRate: 0.18, meetingRate: 0.08, quality: 1.25, costEff: 1.50, leads: 1, meetings: 1, pipeline: 45000 },
      { id: 'sow-demo_adaptive_source', sourceId: 'demo_adaptive_source', yieldRate: 0.80, dupRate: 0.05, replyRate: 0.14, meetingRate: 0.06, quality: 1.15, costEff: 1.30, leads: 4, meetings: 2, pipeline: 90000 },
      { id: 'sow-job_board_signals', sourceId: 'job_board_signals', yieldRate: 0.74, dupRate: 0.08, replyRate: 0.12, meetingRate: 0.05, quality: 1.10, costEff: 1.15, leads: 3, meetings: 1, pipeline: 35000 },
      { id: 'sow-tech_stack_signals', sourceId: 'tech_stack_signals', yieldRate: 0.69, dupRate: 0.12, replyRate: 0.10, meetingRate: 0.04, quality: 1.05, costEff: 1.00, leads: 1, meetings: 0, pipeline: 0 },
      { id: 'sow-hunter', sourceId: 'hunter', yieldRate: 0.84, dupRate: 0.06, replyRate: 0.15, meetingRate: 0.07, quality: 1.20, costEff: 1.10, leads: 3, meetings: 2, pipeline: 75000 },
    ];

    const insertSowTx = db.transaction((weights) => {
      for (const w of weights) {
        insertSow.run(
          w.id, w.sourceId, w.yieldRate, w.dupRate, w.replyRate, w.meetingRate,
          w.quality, w.costEff, w.leads, w.meetings, w.pipeline
        );
      }
    });

    insertSowTx(initialWeights);
  }

  // Phase 6B: Seed initial experiment comparison baseline if empty
  const expCount = (db.prepare('SELECT COUNT(*) as count FROM sourcing_experiments').get() as { count: number }).count;
  if (expCount === 0) {
    db.prepare(`
      INSERT INTO sourcing_experiments (
        id, name, description, status, baseline_strategy, agentic_strategy,
        sample_size, baseline_metrics, agentic_metrics, uplift_summary, concluded_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      'exp-baseline-001',
      'Phase 6A Static Planner vs Phase 6B Agentic Orchestration',
      'Benchmark comparing static deterministic sourcing with adaptive signal-first agentic orchestration over 500 prospect evaluations.',
      'completed',
      'deterministic_phase6a',
      'adaptive_agentic_phase6b',
      500,
      JSON.stringify({
        yieldCount: 168,
        yieldRatePct: 33.6,
        totalCost: 19.40,
        unitCost: 0.115,
        efficiencyPct: 66.4,
        durationMs: 1420,
        meetingRatePct: 4.8,
      }),
      JSON.stringify({
        yieldCount: 242,
        yieldRatePct: 48.4,
        totalCost: 13.80,
        unitCost: 0.057,
        efficiencyPct: 83.2,
        durationMs: 890,
        meetingRatePct: 7.2,
      }),
      JSON.stringify({
        yieldUpliftPct: 44.0,
        costReductionPct: 50.4,
        efficiencyGainPct: 25.3,
        netRoiImprovement: '+50% Cost Efficiency, +44% Qualified Yield',
      })
    );
  }
}


