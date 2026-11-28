import type {
  BrainRequest,
  ProviderHealthStatus,
  ProviderRawChunk,
} from '../types';

export interface ProviderAdapter {
  readonly id: string;
  readonly displayName: string;
  readonly isMock?: boolean;
  supportsModel(modelId: string): boolean;
  checkHealth(): Promise<ProviderHealthStatus>;
  streamChat(request: BrainRequest): AsyncIterable<ProviderRawChunk>;
}

export class AdapterRegistry {
  private readonly adapters = new Map<string, ProviderAdapter>();

  register(adapter: ProviderAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(providerId: string): ProviderAdapter | undefined {
    return this.adapters.get(providerId);
  }

  list(): ProviderAdapter[] {
    return Array.from(this.adapters.values());
  }

  resolveForModel(providerId: string, modelId: string): ProviderAdapter | undefined {
    const direct = this.adapters.get(providerId);
    if (direct && direct.supportsModel(modelId)) {
      return direct;
    }
    return this.list().find((adapter) => adapter.supportsModel(modelId));
  }
}
