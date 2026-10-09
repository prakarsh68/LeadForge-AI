import { performance } from 'perf_hooks';
import { sourceRegistry } from '../sourceConnectorRegistry.js';
import { ragService } from '../../knowledge/ragService.js';
import { leadScoringService } from '../../leadScoringService.js';
import { icpService } from '../../icpService.js';
import type {
  AgenticToolName,
  IAgenticTool,
  ToolExecutionContext,
  ToolExecutionResult,
} from './types.js';
import type { SourceCapability } from '../../../types/index.js';

export class SourcingToolRegistry {
  private static instance: SourcingToolRegistry;
  private tools: Map<AgenticToolName, IAgenticTool> = new Map();

  private constructor() {
    this.registerDefaultTools();
  }

  public static getInstance(): SourcingToolRegistry {
    if (!SourcingToolRegistry.instance) {
      SourcingToolRegistry.instance = new SourcingToolRegistry();
    }
    return SourcingToolRegistry.instance;
  }

  private registerDefaultTools(): void {
    // 1. discover_companies
    this.register({
      name: 'discover_companies',
      description: 'Discovers target enterprise accounts based on industry, size, and geographic criteria.',
      parameterSchema: {
        sourceId: 'string (required)',
        targetIndustries: 'string[] (optional)',
        limit: 'number (optional, default 20)',
      },
      execute: async (input, _context) => {
        const start = performance.now();
        const sourceId = String(input.sourceId || 'first_party_crm');
        const connector = sourceRegistry.get(sourceId);

        if (!connector) {
          return {
            toolName: 'discover_companies',
            status: 'failed',
            output: { error: `Connector '${sourceId}' not found in registry.` },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Rejected execution: Unknown source connector '${sourceId}'.`,
          };
        }

        if (!connector.capabilities.includes('company_discovery') && !connector.capabilities.includes('first_party_records')) {
          return {
            toolName: 'discover_companies',
            status: 'failed',
            output: { error: `Connector '${sourceId}' does not support company discovery.` },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Capability validation failed: '${sourceId}' cannot discover companies globally.`,
          };
        }

        if (!connector.discoverCompanies) {
          return {
            toolName: 'discover_companies',
            status: 'failed',
            output: { error: `Connector '${sourceId}' does not implement discoverCompanies.` },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: 'Missing implementation on connector.',
          };
        }

        const costModel = connector.getCostModel();
        const perRecordCost = costModel.perCompany || costModel.perRecord || 0;
        const limit = Math.min(Number(input.limit || 20), 50);

        const companies = await connector.discoverCompanies({
          targetIndustries: Array.isArray(input.targetIndustries) ? input.targetIndustries : undefined,
          limit,
        });

        const costIncurred = Number((companies.length * perRecordCost).toFixed(2));
        const durationMs = Math.round(performance.now() - start);

        return {
          toolName: 'discover_companies',
          status: 'success',
          output: {
            sourceId,
            count: companies.length,
            companies: companies.slice(0, limit),
          },
          costIncurred,
          durationMs,
          rationale: `Discovered ${companies.length} corporate domains via ${connector.name} at unit cost $${perRecordCost.toFixed(2)}.`,
        };
      },
    });

    // 2. fetch_business_signals
    this.register({
      name: 'fetch_business_signals',
      description: 'Retrieves buying triggers, hiring expansions, or tech stack events for accounts.',
      parameterSchema: {
        sourceId: 'string (required)',
        companyDomain: 'string (optional)',
        category: 'string (optional: hiring, technology, funding)',
        limit: 'number (optional, default 20)',
      },
      execute: async (input, _context) => {
        const start = performance.now();
        const sourceId = String(input.sourceId || 'job_board_signals');
        const connector = sourceRegistry.get(sourceId);

        if (!connector) {
          return {
            toolName: 'fetch_business_signals',
            status: 'failed',
            output: { error: `Connector '${sourceId}' not registered.` },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Unknown signal connector '${sourceId}'.`,
          };
        }

        if (!connector.fetchSignals) {
          return {
            toolName: 'fetch_business_signals',
            status: 'failed',
            output: { error: `Connector '${sourceId}' does not support signal retrieval.` },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Capability validation failed: '${sourceId}' has no fetchSignals operation.`,
          };
        }

        const costModel = connector.getCostModel();
        const perRecordCost = costModel.perRecord || 0.01;
        const limit = Math.min(Number(input.limit || 20), 50);

        const signals = await connector.fetchSignals({
          companyDomain: input.companyDomain ? String(input.companyDomain) : undefined,
          limit,
        });

        const costIncurred = Number((signals.length * perRecordCost).toFixed(2));
        const durationMs = Math.round(performance.now() - start);

        return {
          toolName: 'fetch_business_signals',
          status: 'success',
          output: {
            sourceId,
            count: signals.length,
            signals: signals.slice(0, limit),
          },
          costIncurred,
          durationMs,
          rationale: `Ingested ${signals.length} buying signals from ${connector.name}.`,
        };
      },
    });

    // 3. discover_contacts
    this.register({
      name: 'discover_contacts',
      description: 'Discovers decision-maker contacts matching ICP seniority and functional roles for a domain.',
      parameterSchema: {
        sourceId: 'string (required)',
        companyDomain: 'string (required)',
        targetRoles: 'string[] (optional)',
        limit: 'number (optional, default 5)',
      },
      execute: async (input, _context) => {
        const start = performance.now();
        const sourceId = String(input.sourceId || 'hunter');
        const connector = sourceRegistry.get(sourceId);

        if (!connector) {
          return {
            toolName: 'discover_contacts',
            status: 'failed',
            output: { error: `Connector '${sourceId}' not registered.` },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Unknown contact connector '${sourceId}'.`,
          };
        }

        if (!connector.capabilities.includes('contact_discovery')) {
          return {
            toolName: 'discover_contacts',
            status: 'failed',
            output: { error: `Connector '${sourceId}' does not support contact discovery.` },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Capability validation failed: '${sourceId}' cannot discover contacts.`,
          };
        }

        if (!connector.isConfigured()) {
          return {
            toolName: 'discover_contacts',
            status: 'failed',
            output: {
              error: `Connector '${sourceId}' is not configured with valid credentials.`,
              isConfigured: false,
            },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Authentication requirement: Missing API credentials for '${sourceId}'.`,
          };
        }

        if (!connector.discoverContacts) {
          return {
            toolName: 'discover_contacts',
            status: 'failed',
            output: { error: `Connector '${sourceId}' does not implement discoverContacts.` },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: 'Missing implementation on connector.',
          };
        }

        const domain = String(input.companyDomain || '').trim();
        if (!domain) {
          return {
            toolName: 'discover_contacts',
            status: 'failed',
            output: { error: 'Parameter companyDomain is required.' },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: 'Invalid input: Missing companyDomain.',
          };
        }

        const costModel = connector.getCostModel();
        const perRecordCost = costModel.perRecord || 0.04;
        const limit = Math.min(Number(input.limit || 5), 10);

        try {
          const contacts = await connector.discoverContacts({
            companyDomain: domain,
            targetRoles: Array.isArray(input.targetRoles) ? input.targetRoles : undefined,
            limit,
          });

          const costIncurred = Number((contacts.length * perRecordCost).toFixed(2));
          const durationMs = Math.round(performance.now() - start);

          return {
            toolName: 'discover_contacts',
            status: 'success',
            output: {
              sourceId,
              companyDomain: domain,
              count: contacts.length,
              contacts,
            },
            costIncurred,
            durationMs,
            rationale: `Resolved ${contacts.length} decision-makers at ${domain} via ${connector.name}.`,
          };
        } catch (err: any) {
          return {
            toolName: 'discover_contacts',
            status: 'failed',
            output: { error: err.message || 'Contact resolution failed' },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Provider error during contact lookup for ${domain}: ${err.message}`,
          };
        }
      },
    });

    // 4. verify_contact_email
    this.register({
      name: 'verify_contact_email',
      description: 'Verifies SMTP deliverability and MX validity for a work email address.',
      parameterSchema: {
        sourceId: 'string (required)',
        email: 'string (required)',
        companyDomain: 'string (optional)',
      },
      execute: async (input, _context) => {
        const start = performance.now();
        const sourceId = String(input.sourceId || 'hunter');
        const connector = sourceRegistry.get(sourceId);

        if (!connector || !connector.verifyContact) {
          return {
            toolName: 'verify_contact_email',
            status: 'failed',
            output: { error: `Connector '${sourceId}' does not support email verification.` },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Verification capability unavailable on '${sourceId}'.`,
          };
        }

        const email = String(input.email || '').trim();
        if (!email) {
          return {
            toolName: 'verify_contact_email',
            status: 'failed',
            output: { error: 'Parameter email is required.' },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: 'Missing target email address.',
          };
        }

        const costModel = connector.getCostModel();
        const perVerifCost = costModel.perVerification || 0.01;

        try {
          const result = await connector.verifyContact(email, input.companyDomain);
          const durationMs = Math.round(performance.now() - start);

          return {
            toolName: 'verify_contact_email',
            status: 'success',
            output: {
              email,
              verificationStatus: result.status,
              deliverable: result.isDeliverable,
              score: result.score,
            },
            costIncurred: perVerifCost,
            durationMs,
            rationale: `Verified ${email}: status='${result.status}' (score=${result.score}).`,
          };
        } catch (err: any) {
          return {
            toolName: 'verify_contact_email',
            status: 'failed',
            output: { error: err.message },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: `Email verification failed for ${email}: ${err.message}`,
          };
        }
      },
    });

    // 5. research_knowledge_base
    this.register({
      name: 'research_knowledge_base',
      description: 'Retrieves internal sales battlecards, case studies, and positioning collateral via RAG.',
      parameterSchema: {
        query: 'string (required)',
        category: 'string (optional)',
      },
      execute: async (input, _context) => {
        const start = performance.now();
        const query = String(input.query || '').trim();

        if (!query) {
          return {
            toolName: 'research_knowledge_base',
            status: 'failed',
            output: { error: 'Query parameter is required.' },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: 'Empty knowledge base query.',
          };
        }

        const ragResult = await ragService.ask(query, {
          category: input.category ? String(input.category) : undefined,
          topK: 3,
        });

        const durationMs = Math.round(performance.now() - start);

        return {
          toolName: 'research_knowledge_base',
          status: 'success',
          output: {
            answer: ragResult.answer,
            citationsCount: ragResult.citations.length,
            searchMode: ragResult.searchMode,
            citations: ragResult.citations,
          },
          costIncurred: 0.00, // Internal compute
          durationMs,
          rationale: `Retrieved ${ragResult.citations.length} internal collateral citations for "${query}".`,
        };
      },
    });

    // 6. evaluate_icp_fit
    this.register({
      name: 'evaluate_icp_fit',
      description: 'Performs explainable, deterministic Phase 3A qualification scoring on a candidate.',
      parameterSchema: {
        candidate: 'object (required: name, company, companyDomain, title, industry, companySize)',
        targetIcpId: 'string (optional)',
      },
      execute: async (input, context) => {
        const start = performance.now();
        const candidate = input.candidate || {};
        const icpId = input.targetIcpId || context.targetIcpId || 'icp-default';

        const icp = icpService.getById(icpId) || icpService.getActive();
        if (!icp) {
          return {
            toolName: 'evaluate_icp_fit',
            status: 'failed',
            output: { error: 'No active or specified ICP profile found.' },
            costIncurred: 0,
            durationMs: Math.round(performance.now() - start),
            rationale: 'Unable to qualify candidate: missing ICP definition.',
          };
        }

        const qualification = leadScoringService.evaluateLead(candidate, icp);
        const durationMs = Math.round(performance.now() - start);

        return {
          toolName: 'evaluate_icp_fit',
          status: 'success',
          output: {
            overallScore: qualification.overallScore,
            tier: qualification.tier,
            isQualified: qualification.overallScore >= (icp.minScoreThreshold || 78),
            summaryReasons: qualification.summaryReasons,
            criteria: qualification.criteria,
          },
          costIncurred: 0.00,
          durationMs,
          rationale: `Deterministic qualification score: ${qualification.overallScore}/100 (Tier: ${qualification.tier.toUpperCase()}).`,
        };
      },
    });

    // 7. route_fallback_source
    this.register({
      name: 'route_fallback_source',
      description: 'Selects the next best available connector when a primary source is unavailable or exhausted.',
      parameterSchema: {
        failedSourceId: 'string (required)',
        requiredCapability: 'string (required)',
        reason: 'string (optional)',
      },
      execute: async (input, _context) => {
        const start = performance.now();
        const failedSourceId = String(input.failedSourceId || '');
        const capability = String(input.requiredCapability || '') as SourceCapability;
        const reason = String(input.reason || 'unspecified');

        const allWithCap = sourceRegistry.getByCapability(capability);
        const fallback = allWithCap.find((c) => c.id !== failedSourceId && c.isConfigured());

        const durationMs = Math.round(performance.now() - start);

        if (!fallback) {
          return {
            toolName: 'route_fallback_source',
            status: 'failed',
            output: {
              failedSourceId,
              fallbackSourceId: null,
              message: `No secondary connector available with capability '${capability}'.`,
            },
            costIncurred: 0,
            durationMs,
            rationale: `Exhausted fallback options for capability '${capability}'.`,
          };
        }

        return {
          toolName: 'route_fallback_source',
          status: 'success',
          output: {
            failedSourceId,
            fallbackSourceId: fallback.id,
            fallbackSourceName: fallback.name,
            reason,
          },
          costIncurred: 0,
          durationMs,
          rationale: `Routed from ${failedSourceId} to healthy fallback ${fallback.id} (${fallback.name}) for '${capability}'.`,
        };
      },
    });
  }

  public register(tool: IAgenticTool): void {
    this.tools.set(tool.name, tool);
  }

  public get(name: AgenticToolName): IAgenticTool | undefined {
    return this.tools.get(name);
  }

  public getAll(): IAgenticTool[] {
    return Array.from(this.tools.values());
  }

  public async executeTool(
    name: AgenticToolName,
    input: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionResult> {
    const tool = this.get(name);
    if (!tool) {
      return {
        toolName: name,
        status: 'failed',
        output: { error: `Tool '${name}' is not in the approved allowlist.` },
        costIncurred: 0,
        durationMs: 0,
        rationale: `Security check: Rejected unapproved tool '${name}'.`,
      };
    }

    return await tool.execute(input, context);
  }
}

export const sourcingToolRegistry = SourcingToolRegistry.getInstance();
