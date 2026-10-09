import type { ISourceConnector } from './types.js';
import type { SourceCapability, SourceRegistryDTO, SourceHealthStatus } from '../../types/index.js';
import { getDb } from '../../db/database.js';
import { sourceRegistryEntityToDto } from '../../utils/serializers.js';
import { HunterSourceConnector } from './connectors/hunterConnector.js';
import { FirstPartyCrmSourceConnector } from './connectors/firstPartyCrmConnector.js';
import { JobBoardSignalsConnector } from './connectors/jobBoardSignalsConnector.js';
import { TechSignalsConnector } from './connectors/techSignalsConnector.js';
import { DemoAdaptiveSignalsConnector } from './connectors/demoAdaptiveConnector.js';

export class SourceConnectorRegistry {
  private static instance: SourceConnectorRegistry;
  private connectors: Map<string, ISourceConnector> = new Map();

  private constructor() {
    this.registerDefaultConnectors();
  }

  public static getInstance(): SourceConnectorRegistry {
    if (!SourceConnectorRegistry.instance) {
      SourceConnectorRegistry.instance = new SourceConnectorRegistry();
    }
    return SourceConnectorRegistry.instance;
  }

  private registerDefaultConnectors(): void {
    this.register(new HunterSourceConnector());
    this.register(new FirstPartyCrmSourceConnector());
    this.register(new JobBoardSignalsConnector());
    this.register(new TechSignalsConnector());
    this.register(new DemoAdaptiveSignalsConnector());
  }

  public register(connector: ISourceConnector): void {
    this.connectors.set(connector.id, connector);
  }

  public get(id: string): ISourceConnector | undefined {
    return this.connectors.get(id);
  }

  public getAll(): ISourceConnector[] {
    return Array.from(this.connectors.values());
  }

  public getByCapability(capability: SourceCapability): ISourceConnector[] {
    return this.getAll().filter((c) => c.capabilities.includes(capability));
  }

  public getAllRegistryEntries(): SourceRegistryDTO[] {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM source_registry_entries ORDER BY created_at ASC').all() as any[];
    return rows.map(sourceRegistryEntityToDto);
  }

  public getRegistryEntry(id: string): SourceRegistryDTO | null {
    const db = getDb();
    const row = db.prepare('SELECT * FROM source_registry_entries WHERE id = ?').get(id) as any;
    return row ? sourceRegistryEntityToDto(row) : null;
  }

  public updateEntryStatus(id: string, isEnabled: boolean): SourceRegistryDTO | null {
    const db = getDb();
    db.prepare('UPDATE source_registry_entries SET is_enabled = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(isEnabled ? 1 : 0, id);
    return this.getRegistryEntry(id);
  }

  public async checkHealth(id: string): Promise<SourceHealthStatus> {
    const connector = this.get(id);
    if (!connector) return 'unknown';

    try {
      const status = await connector.checkHealth();
      const db = getDb();
      db.prepare(`
        UPDATE source_registry_entries
        SET health_status = ?, last_health_check = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(status, id);
      return status;
    } catch {
      const db = getDb();
      db.prepare(`
        UPDATE source_registry_entries
        SET health_status = 'unreachable', last_health_check = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).run(id);
      return 'unreachable';
    }
  }

  public async checkAllHealth(): Promise<Record<string, SourceHealthStatus>> {
    const results: Record<string, SourceHealthStatus> = {};
    for (const connector of this.getAll()) {
      results[connector.id] = await this.checkHealth(connector.id);
    }
    return results;
  }
}

export const sourceRegistry = SourceConnectorRegistry.getInstance();

