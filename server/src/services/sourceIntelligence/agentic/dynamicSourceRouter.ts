import { sourceRegistry } from '../sourceConnectorRegistry.js';
import type { SourceCapability } from '../../../types/index.js';
import type { FallbackRouteDecision } from './types.js';

export class DynamicSourceRouter {
  /**
   * Evaluates if a fallback connector is required and routes accordingly.
   */
  public static selectFallback(
    failedSourceId: string,
    capability: SourceCapability,
    failureReason: 'rate_limited' | 'unconfigured' | 'empty_results' | 'budget_exhausted' | 'unhealthy',
    allowedSourceIds?: string[]
  ): FallbackRouteDecision {
    const candidates = sourceRegistry.getByCapability(capability);

    // Filter out the failed source and unpermitted sources
    const eligible = candidates.filter((c) => {
      if (c.id === failedSourceId) return false;
      if (allowedSourceIds && allowedSourceIds.length > 0 && !allowedSourceIds.includes(c.id)) return false;
      return c.isConfigured();
    });

    if (eligible.length === 0) {
      return {
        originalSourceId: failedSourceId,
        fallbackSourceId: null,
        reason: failureReason,
        rationale: `No alternative connector configured for required capability '${capability}' after ${failedSourceId} failed (${failureReason}).`,
      };
    }

    // Sort by unit cost (prefer cheaper connector)
    eligible.sort((a, b) => {
      const costA = a.getCostModel().perRecord || 0;
      const costB = b.getCostModel().perRecord || 0;
      return costA - costB;
    });

    const chosen = eligible[0];
    return {
      originalSourceId: failedSourceId,
      fallbackSourceId: chosen.id,
      reason: failureReason,
      rationale: `Dynamically routed capability '${capability}' from ${failedSourceId} (${failureReason}) to ${chosen.id} (${chosen.name}).`,
    };
  }

  /**
   * Validates if a source is currently eligible and healthy before calling.
   */
  public static canExecuteSource(sourceId: string): { ok: boolean; reason?: string } {
    const connector = sourceRegistry.get(sourceId);
    if (!connector) {
      return { ok: false, reason: `Source '${sourceId}' is not registered.` };
    }

    const entry = sourceRegistry.getRegistryEntry(sourceId);
    if (entry && !entry.isEnabled) {
      return { ok: false, reason: `Source '${sourceId}' is administratively disabled.` };
    }

    if (!connector.isConfigured()) {
      return { ok: false, reason: `Source '${sourceId}' lacks required API credentials.` };
    }

    return { ok: true };
  }
}

