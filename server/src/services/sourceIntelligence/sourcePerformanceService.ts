import { getDb } from '../../db/database.js';
import type {
  SourcePerformanceMetric,
  SourceIntelligenceAnalyticsDTO,
  SignalCategory,
} from '../../types/index.js';
import { sourceRegistry } from './sourceConnectorRegistry.js';

export class SourcePerformanceService {
  /**
   * Computes comprehensive source performance metrics and downstream outcome attributions.
   */
  public static getAnalytics(): SourceIntelligenceAnalyticsDTO {
    const db = getDb();
    const registryEntries = sourceRegistry.getAllRegistryEntries();
    const metrics: SourcePerformanceMetric[] = [];

    let overallEntitiesSourced = 0;
    let overallQualified = 0;
    let overallCost = 0;
    let overallPipelineRevenue = 0;

    for (const entry of registryEntries) {
      // 1. Observations and entity counts
      const obsCount = (db.prepare(
        'SELECT COUNT(*) as count FROM source_observations WHERE source_id = ?'
      ).get(entry.id) as { count: number }).count;

      const attrCount = (db.prepare(
        'SELECT COUNT(*) as count FROM source_attributions WHERE source_id = ?'
      ).get(entry.id) as { count: number }).count;

      const entitiesYielded = Math.max(obsCount, attrCount);
      overallEntitiesSourced += entitiesYielded;

      // 2. Duplicates detected
      const dupCount = (db.prepare(
        "SELECT COUNT(*) as count FROM source_observations WHERE source_id = ? AND processing_status = 'deduped'"
      ).get(entry.id) as { count: number }).count;

      const duplicateRatePct = entitiesYielded > 0 ? Number(((dupCount / entitiesYielded) * 100).toFixed(1)) : 0;

      // 3. Qualified leads attributed to this source
      const qualifiedRows = db.prepare(`
        SELECT DISTINCT l.id, l.score, l.deal_value
        FROM source_attributions sa
        JOIN leads l ON sa.lead_id = l.id
        WHERE sa.source_id = ? AND l.score >= 78
      `).all(entry.id) as Array<{ id: string; score: number; deal_value: number }>;

      const qualifiedCount = qualifiedRows.length;
      overallQualified += qualifiedCount;

      const icpFitCount = (db.prepare(`
        SELECT COUNT(DISTINCT l.id) as count
        FROM source_attributions sa
        JOIN leads l ON sa.lead_id = l.id
        WHERE sa.source_id = ? AND l.score >= 60
      `).get(entry.id) as { count: number }).count;

      const icpFitRatePct = entitiesYielded > 0 ? Number(((icpFitCount / entitiesYielded) * 100).toFixed(1)) : (qualifiedCount > 0 ? 100 : 0);
      const qualificationRatePct = entitiesYielded > 0 ? Number(((qualifiedCount / entitiesYielded) * 100).toFixed(1)) : (qualifiedCount > 0 ? 85 : 0);

      // 4. Incurred cost & Unit cost per qualified lead
      const perRecordCost = entry.costModel.perRecord || 0.00;
      const totalCostIncurred = Number((entitiesYielded * perRecordCost).toFixed(2));
      overallCost += totalCostIncurred;

      const unitCostPerQualified = qualifiedCount > 0
        ? Number((totalCostIncurred / qualifiedCount).toFixed(2))
        : totalCostIncurred;

      // 5. Downstream Engagement & Pipeline Outcomes
      const repliesCount = (db.prepare(`
        SELECT COUNT(DISTINCT ee.lead_id) as count
        FROM source_attributions sa
        JOIN engagement_events ee ON sa.lead_id = ee.lead_id
        WHERE sa.source_id = ? AND ee.event_type = 'replied'
      `).get(entry.id) as { count: number }).count;

      const replyRatePct = qualifiedCount > 0 ? Number(((repliesCount / qualifiedCount) * 100).toFixed(1)) : 0;

      const meetingsCount = (db.prepare(`
        SELECT COUNT(DISTINCT ee.lead_id) as count
        FROM source_attributions sa
        JOIN engagement_events ee ON sa.lead_id = ee.lead_id
        WHERE sa.source_id = ? AND ee.event_type = 'meeting_booked'
      `).get(entry.id) as { count: number }).count;

      const meetingRatePct = qualifiedCount > 0 ? Number(((meetingsCount / qualifiedCount) * 100).toFixed(1)) : 0;

      const wonRows = db.prepare(`
        SELECT COUNT(DISTINCT o.id) as count, COALESCE(SUM(o.deal_value), 0) as revenue
        FROM source_attributions sa
        JOIN opportunities o ON sa.lead_id = o.lead_id
        WHERE sa.source_id = ? AND o.stage = 'Won'
      `).get(entry.id) as { count: number; revenue: number };

      const wonDealsAttributed = wonRows.count;

      const oppRevenue = (db.prepare(`
        SELECT COALESCE(SUM(o.deal_value), 0) as totalRevenue
        FROM source_attributions sa
        JOIN opportunities o ON sa.lead_id = o.lead_id
        WHERE sa.source_id = ?
      `).get(entry.id) as { totalRevenue: number }).totalRevenue;

      overallPipelineRevenue += oppRevenue;

      // 6. Explainable Recommendation
      let recommendation = 'Maintain current allocation in multi-source strategy.';
      if (entry.providerType === 'first_party_crm') {
        recommendation = 'Zero marginal acquisition cost with highest historical conversion; prioritize in all initial campaign stages.';
      } else if (entry.providerType === 'hiring_signals') {
        recommendation = 'Strongest buying trigger signal; recommended for high-deal-value enterprise targeting campaigns.';
      } else if (entry.providerType === 'technology_signals') {
        recommendation = 'High firmographic specificity; best paired with hiring signals to maximize reply rates.';
      } else if (entry.providerType === 'hunter') {
        recommendation = 'Reliable executive contact resolution; recommended for Stage 7 contact enrichment after signal screening.';
      } else if (entry.providerType === 'demo_signals') {
        recommendation = 'Benchmark synthetic source; suitable for automated testing and sandbox evaluations.';
      }

      metrics.push({
        sourceId: entry.id,
        sourceName: entry.name,
        providerType: entry.providerType,
        isConfigured: entry.isConfigured,
        isEnabled: entry.isEnabled,
        healthStatus: entry.healthStatus,
        totalRequests: Math.max(1, obsCount),
        entitiesYielded,
        duplicatesDetected: dupCount,
        duplicateRatePct,
        icpFitCount,
        icpFitRatePct,
        qualifiedCount,
        qualificationRatePct,
        totalCostIncurred,
        unitCostPerQualified,
        repliesAttributed: repliesCount,
        replyRatePct,
        meetingsAttributed: meetingsCount,
        meetingRatePct,
        wonDealsAttributed,
        pipelineRevenueAttributed: oppRevenue,
        recommendation,
      });
    }

    // Signals summary
    const totalSignals = (db.prepare('SELECT COUNT(*) as count FROM source_signals').get() as { count: number }).count;
    const catRows = db.prepare(
      'SELECT signal_category, COUNT(*) as count FROM source_signals GROUP BY signal_category'
    ).all() as Array<{ signal_category: SignalCategory; count: number }>;

    const categoryCounts: Record<SignalCategory, number> = {
      hiring: 0,
      technology: 0,
      funding: 0,
      expansion: 0,
      procurement: 0,
      first_party_intent: 0,
    };

    for (const r of catRows) {
      if (r.signal_category in categoryCounts) {
        categoryCounts[r.signal_category] = r.count;
      }
    }

    return {
      sources: metrics,
      totals: {
        totalEntitiesSourced: overallEntitiesSourced,
        totalQualified: overallQualified,
        totalCost: Number(overallCost.toFixed(2)),
        averageCostPerQualified: overallQualified > 0 ? Number((overallCost / overallQualified).toFixed(2)) : 0,
        totalPipelineRevenue: overallPipelineRevenue,
      },
      signalsSummary: {
        totalSignals,
        categoryCounts,
      },
    };
  }
}

