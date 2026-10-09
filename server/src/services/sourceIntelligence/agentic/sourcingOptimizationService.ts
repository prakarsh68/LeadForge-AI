import { getDb } from '../../../db/database.js';
import { sourceRegistry } from '../sourceConnectorRegistry.js';
import { sourcingOptimizationWeightEntityToDto } from '../../../utils/serializers.js';
import type {
  SourcingOptimizationWeightDTO,
  SourcingOptimizationWeightEntity,
} from '../../../types/index.js';

export class SourcingOptimizationService {
  /**
   * Retrieves all persisted optimization weights.
   */
  public static getWeights(): SourcingOptimizationWeightDTO[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM sourcing_optimization_weights ORDER BY quality_multiplier DESC').all() as SourcingOptimizationWeightEntity[];
    return rows.map((r) => {
      const connector = sourceRegistry.get(r.source_id);
      return sourcingOptimizationWeightEntityToDto(r, connector?.name);
    });
  }

  /**
   * Retrieves optimization weight for a specific connector.
   */
  public static getWeightForSource(sourceId: string): SourcingOptimizationWeightDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM sourcing_optimization_weights WHERE source_id = ?').get(sourceId) as SourcingOptimizationWeightEntity | undefined;
    if (!row) return null;
    const connector = sourceRegistry.get(sourceId);
    return sourcingOptimizationWeightEntityToDto(row, connector?.name);
  }

  /**
   * Recomputes optimization weights across all registered sources using real attribution and engagement data.
   */
  public static recomputeWeights(): SourcingOptimizationWeightDTO[] {
    const db = getDb();
    const allConnectors = sourceRegistry.getAll();
    const now = new Date().toISOString();

    const upsert = db.prepare(`
      INSERT INTO sourcing_optimization_weights (
        id, source_id, empirical_yield_rate, empirical_duplicate_rate, empirical_reply_rate, empirical_meeting_rate,
        quality_multiplier, learned_cost_efficiency, total_leads_attributed, total_meetings_attributed, total_pipeline_attributed,
        last_optimized_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id) DO UPDATE SET
        empirical_yield_rate = excluded.empirical_yield_rate,
        empirical_duplicate_rate = excluded.empirical_duplicate_rate,
        empirical_reply_rate = excluded.empirical_reply_rate,
        empirical_meeting_rate = excluded.empirical_meeting_rate,
        quality_multiplier = excluded.quality_multiplier,
        learned_cost_efficiency = excluded.learned_cost_efficiency,
        total_leads_attributed = excluded.total_leads_attributed,
        total_meetings_attributed = excluded.total_meetings_attributed,
        total_pipeline_attributed = excluded.total_pipeline_attributed,
        last_optimized_at = excluded.last_optimized_at,
        updated_at = excluded.updated_at
    `);

    const recomputeTx = db.transaction(() => {
      for (const connector of allConnectors) {
        const sourceId = connector.id;

        // 1. Leads Attributed
        const leadRow = db.prepare(`
          SELECT COUNT(DISTINCT lead_id) as count
          FROM source_attributions
          WHERE source_id = ? AND lead_id IS NOT NULL
        `).get(sourceId) as { count: number };
        const leadsCount = leadRow?.count || 0;

        // 2. Engagement Replies & Meetings
        const engagementRow = db.prepare(`
          SELECT
            SUM(CASE WHEN e.event_type = 'replied' THEN 1 ELSE 0 END) as replies,
            SUM(CASE WHEN e.event_type = 'meeting_booked' THEN 1 ELSE 0 END) as meetings
          FROM engagement_events e
          JOIN source_attributions sa ON e.lead_id = sa.lead_id
          WHERE sa.source_id = ?
        `).get(sourceId) as { replies: number | null; meetings: number | null };

        const replies = engagementRow?.replies || 0;
        const meetings = engagementRow?.meetings || 0;

        // 3. Pipeline Revenue Attributed
        const oppRow = db.prepare(`
          SELECT COALESCE(SUM(o.deal_value), 0) as total_deal_value
          FROM opportunities o
          JOIN source_attributions sa ON o.lead_id = sa.lead_id
          WHERE sa.source_id = ?
        `).get(sourceId) as { total_deal_value: number };
        const pipelineRevenue = oppRow?.total_deal_value || 0;

        // Compute Empirical Metrics
        const empiricalReplyRate = leadsCount > 0 ? Number((replies / leadsCount).toFixed(4)) : 0.12;
        const empiricalMeetingRate = leadsCount > 0 ? Number((meetings / leadsCount).toFixed(4)) : 0.05;

        // Base quality multiplier from real Phase 5 outcomes
        const costModel = connector.getCostModel();
        const perRecordCost = costModel.perRecord || 0.01;

        const qualityMultiplier = Number(
          Math.max(
            0.5,
            Math.min(
              2.0,
              1.0 + (empiricalMeetingRate * 3.0) + (empiricalReplyRate * 1.5) - (sourceId === 'tech_stack_signals' ? 0.05 : 0.0)
            )
          ).toFixed(3)
        );

        const learnedCostEfficiency = Number((qualityMultiplier / (perRecordCost + 0.01)).toFixed(3));

        upsert.run(
          `sow-${sourceId}`,
          sourceId,
          0.75, // Standard baseline yield
          0.05, // Baseline duplicate rate
          empiricalReplyRate,
          empiricalMeetingRate,
          qualityMultiplier,
          learnedCostEfficiency,
          leadsCount,
          meetings,
          pipelineRevenue,
          now,
          now
        );
      }
    });

    recomputeTx();
    return this.getWeights();
  }

  /**
   * Retrieves empirical multiplier to boost/penalize sourcing planner utility.
   */
  public static getEmpiricalMultiplier(sourceId: string): number {
    const weight = this.getWeightForSource(sourceId);
    return weight ? weight.qualityMultiplier : 1.0;
  }
}

export const sourcingOptimizationService = SourcingOptimizationService;
