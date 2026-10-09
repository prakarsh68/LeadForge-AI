import type { SourceCapability } from '../../types/index.js';
import type { SourceEligibilityResult } from './types.js';
import { sourceRegistry } from './sourceConnectorRegistry.js';

export interface EligibilityEvaluationOptions {
  requiredCapabilities?: SourceCapability[];
  maxCostPerRecord?: number;
  allowDemo?: boolean;
}

export class SourceEligibilityService {
  public static evaluateSource(
    sourceId: string,
    options: EligibilityEvaluationOptions = {}
  ): SourceEligibilityResult {
    const entry = sourceRegistry.getRegistryEntry(sourceId);
    if (!entry) {
      return {
        sourceId,
        eligible: false,
        reasons: ['Source not registered in catalog.'],
      };
    }

    const reasons: string[] = [];

    // 1. Check enabled
    if (!entry.isEnabled) {
      reasons.push('Source is administratively disabled.');
    }

    // 2. Check configuration and demo mode
    const isDemo = Boolean(entry.metadata?.isDemo || entry.providerType === 'demo_signals');
    if (!entry.isConfigured && !isDemo) {
      reasons.push('Source credentials are not configured.');
    }

    if (isDemo && options.allowDemo === false) {
      reasons.push('Demo sources are excluded by campaign policy.');
    }

    // 3. Check health status
    if (entry.healthStatus === 'unreachable') {
      reasons.push('Source is currently unreachable / experiencing an outage.');
    }

    // 4. Check capabilities
    if (options.requiredCapabilities && options.requiredCapabilities.length > 0) {
      const missing = options.requiredCapabilities.filter((c) => !entry.capabilities.includes(c));
      if (missing.length === options.requiredCapabilities.length) {
        reasons.push(`Source lacks all required capabilities (${missing.join(', ')}).`);
      }
    }

    // 5. Cost constraint check
    if (options.maxCostPerRecord != null && entry.costModel.perRecord != null) {
      if (entry.costModel.perRecord > options.maxCostPerRecord) {
        reasons.push(
          `Unit cost ($${entry.costModel.perRecord.toFixed(2)}) exceeds maximum allowed cost per record ($${options.maxCostPerRecord.toFixed(2)}).`
        );
      }
    }

    return {
      sourceId,
      eligible: reasons.length === 0,
      reasons: reasons.length === 0 ? ['Source is active, configured, healthy, and meets capability constraints.'] : reasons,
    };
  }

  public static getEligibleSources(options: EligibilityEvaluationOptions = {}): string[] {
    const all = sourceRegistry.getAllRegistryEntries();
    return all
      .filter((e) => this.evaluateSource(e.id, options).eligible)
      .map((e) => e.id);
  }
}

