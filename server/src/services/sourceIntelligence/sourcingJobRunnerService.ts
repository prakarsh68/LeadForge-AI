import { randomUUID } from 'node:crypto';
import { getDb } from '../../db/database.js';
import type {
  SourcingJobDTO,
  IcpProfileDTO,
} from '../../types/index.js';
import { sourcingJobEntityToDto, icpEntityToDto } from '../../utils/serializers.js';
import { sourceRegistry } from './sourceConnectorRegistry.js';
import {
  SourceIdentityResolutionService,
  type UnresolvedEntityFragment,
} from './sourceIdentityResolutionService.js';
import { ProgressiveFilteringService } from './progressiveFilteringService.js';
import { SourcingPlannerService } from './sourcingPlannerService.js';

export class SourcingJobRunnerService {
  /**
   * Creates and executes a sourcing job for an approved plan.
   */
  public static async executePlan(planId: string): Promise<SourcingJobDTO> {
    const db = getDb();
    const plan = SourcingPlannerService.getPlan(planId);
    if (!plan) {
      throw new Error(`Sourcing plan not found: ${planId}`);
    }

    const jobId = `sjob-${randomUUID().slice(0, 8)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO sourcing_jobs (
        id, plan_id, status, stage_counts, records_sourced, records_deduped,
        records_screened, records_qualified, records_staged, cost_incurred,
        started_at, created_at, updated_at
      ) VALUES (?, ?, 'running', '{}', 0, 0, 0, 0, 0, 0, ?, ?, ?)
    `).run(jobId, planId, now, now, now);

    try {
      // Fetch target ICP
      let icp: IcpProfileDTO;
      const icpRow = db.prepare('SELECT * FROM icp_profiles WHERE id = ?').get(plan.targetIcpId || 'icp-default') as any;
      if (icpRow) {
        icp = icpEntityToDto(icpRow);
      } else {
        const defaultIcp = db.prepare('SELECT * FROM icp_profiles WHERE is_active = 1 LIMIT 1').get() as any;
        icp = icpEntityToDto(defaultIcp);
      }

      // Step 1: Collect fragments from selected sources
      const rawFragments: UnresolvedEntityFragment[] = [];
      let totalCostIncurred = 0;

      for (const selectedSource of plan.selectedSources) {
        const connector = sourceRegistry.get(selectedSource.sourceId);
        if (!connector) continue;

        const costModel = connector.getCostModel();
        const perRecordCost = costModel.perRecord || 0;

        // Execute discovery based on role
        if (selectedSource.role === 'discovery' && connector.discoverCompanies) {
          const companies = await connector.discoverCompanies({
            targetIndustries: icp.targetIndustries,
            limit: 25,
          });

          for (const c of companies) {
            rawFragments.push({
              sourceId: connector.id,
              sourceUrl: c.sourceUrl,
              role: 'discovery',
              confidence: c.confidence,
              companyName: c.companyName,
              companyDomain: c.companyDomain,
              industry: c.industry,
              companySize: c.companySize,
              location: c.location,
              rawPayload: c.rawPayload,
            });
            totalCostIncurred += perRecordCost;
          }
        } else if (selectedSource.role === 'signal' && connector.fetchSignals) {
          const signals = await connector.fetchSignals({
            limit: 25,
          });

          for (const s of signals) {
            rawFragments.push({
              sourceId: connector.id,
              sourceUrl: s.sourceUrl,
              role: 'signal',
              confidence: s.confidence,
              companyName: s.companyName,
              companyDomain: s.companyDomain,
              triggers: [s.signalText],
              rawPayload: s.rawPayload,
            });
            totalCostIncurred += perRecordCost;
          }
        } else if (selectedSource.role === 'contact_resolution' && connector.discoverContacts) {
          const targetDomains = Array.from(new Set(rawFragments.map((f) => f.companyDomain)));
          const queryDomains = Array.from(new Set([...targetDomains.slice(0, 5), 'omnistream.io', 'datavanguard.ai']));

          for (const domain of queryDomains) {
            const contacts = await connector.discoverContacts({
              companyDomain: domain,
              targetRoles: icp.targetRoles,
              limit: 5,
            });

            for (const ct of contacts) {
              rawFragments.push({
                sourceId: connector.id,
                sourceUrl: ct.sourceUrl,
                role: 'contact_resolution',
                confidence: (ct.confidence || 80) / 100,
                companyName: ct.companyName,
                companyDomain: ct.companyDomain,
                contactName: ct.contactName,
                title: ct.title,
                email: ct.email,
                emailVerification: ct.emailVerification,
                linkedinUrl: ct.linkedinUrl,
                industry: (ct.rawPayload as any)?.industry,
                companySize: (ct.rawPayload as any)?.companySize,
                location: (ct.rawPayload as any)?.location,
                triggers: (ct.rawPayload as any)?.triggers,
                rawPayload: ct.rawPayload,
              });
              totalCostIncurred += perRecordCost;
            }
          }
        }
      }

      // Step 2: Cross-Source Identity Resolution
      const mergedCandidates = SourceIdentityResolutionService.resolveAndMergeEntities(rawFragments);

      // Step 3: Progressive Filtering Pipeline (Stages 1-8)
      const pipelineResult = ProgressiveFilteringService.runPipeline(
        mergedCandidates,
        icp,
        {
          targetYield: plan.expectedYield,
          minScoreThreshold: icp.minScoreThreshold,
        }
      );

      // Step 4: Stage surviving candidates and record attributions
      for (const surviving of pipelineResult.survivingCandidates) {
        SourceIdentityResolutionService.recordAttributions(
          surviving.contributingSources,
          surviving.id
        );
      }

      // Update Sourcing Job in database
      const completedNow = new Date().toISOString();
      const recordsSourced = rawFragments.length;
      const recordsDeduped = pipelineResult.stageMetrics['stage2_identity_dedup']?.rejectedCount || 0;
      const recordsScreened = (pipelineResult.stageMetrics['stage4_preliminary_icp']?.rejectedCount || 0) +
        (pipelineResult.stageMetrics['stage3_cheap_exclusions']?.rejectedCount || 0);
      const recordsQualified = pipelineResult.survivingCandidates.length;
      const recordsStaged = pipelineResult.survivingCandidates.length;

      db.prepare(`
        UPDATE sourcing_jobs
        SET
          status = 'completed',
          stage_counts = ?,
          records_sourced = ?,
          records_deduped = ?,
          records_screened = ?,
          records_qualified = ?,
          records_staged = ?,
          cost_incurred = ?,
          completed_at = ?,
          updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(pipelineResult.stageMetrics),
        recordsSourced,
        recordsDeduped,
        recordsScreened,
        recordsQualified,
        recordsStaged,
        Number(totalCostIncurred.toFixed(2)),
        completedNow,
        completedNow,
        jobId
      );

      // Update plan status
      SourcingPlannerService.updatePlanStatus(planId, 'completed');

      const jobRow = db.prepare('SELECT * FROM sourcing_jobs WHERE id = ?').get(jobId) as any;
      return sourcingJobEntityToDto(jobRow);
    } catch (err: any) {
      db.prepare(`
        UPDATE sourcing_jobs
        SET status = 'failed', error_message = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(err.message || 'Unknown execution error', jobId);

      SourcingPlannerService.updatePlanStatus(planId, 'failed');
      throw err;
    }
  }

  public static getJob(id: string): SourcingJobDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sourcing_jobs WHERE id = ?').get(id) as any;
    return row ? sourcingJobEntityToDto(row) : null;
  }

  public static getJobsForPlan(planId: string): SourcingJobDTO[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM sourcing_jobs WHERE plan_id = ? ORDER BY created_at DESC').all(planId) as any[];
    return rows.map(sourcingJobEntityToDto);
  }
}
