import type { DiscoveryProvider } from './types.js';
import { HunterDiscoveryProvider } from './hunterProvider.js';
import { MockDiscoveryProvider } from './mockProvider.js';
import { CrawleeDiscoveryProvider } from './crawleeProvider.js';
import type { DiscoveryProviderStatusDTO } from '../../types/index.js';

class ProviderRegistry {
  private providers: Map<string, DiscoveryProvider> = new Map();

  constructor() {
    this.register(new HunterDiscoveryProvider());
    this.register(new CrawleeDiscoveryProvider());
    this.register(new MockDiscoveryProvider());
  }

  public register(provider: DiscoveryProvider): void {
    this.providers.set(provider.id.toLowerCase(), provider);
  }

  public get(id: string): DiscoveryProvider | undefined {
    return this.providers.get(id.toLowerCase());
  }

  public getAll(): DiscoveryProvider[] {
    return Array.from(this.providers.values());
  }

  public listStatuses(): DiscoveryProviderStatusDTO[] {
    return this.getAll().map((p) => ({
      id: p.id,
      displayName: p.displayName,
      mode: p.mode,
      isConfigured: p.isConfigured(),
      description: p.description,
      capabilities: p.capabilities,
    }));
  }
}

export const providerRegistry = new ProviderRegistry();

