import type { ModelAvailability, ModelCapabilities, ModelDescriptor } from './types';

export const DEFAULT_DEMO_PRIMARY_MODEL_ID = 'efer-demo-primary';
export const DEFAULT_DEMO_FALLBACK_MODEL_ID = 'efer-demo-fallback';
export const DEFAULT_OLLAMA_MODEL_ID = 'ollama:llama3.2';

export const INITIAL_MODEL_CATALOG: ModelDescriptor[] = [
  {
    id: DEFAULT_DEMO_PRIMARY_MODEL_ID,
    providerId: 'mock-demo',
    displayName: 'EFER Demo · Balanced',
    shortDescription: 'Phase 2–4 local mock adapter for streaming and fallback testing (no external API).',
    capabilities: {
      chat: true,
      streaming: true,
      code: true,
      reasoning: true,
      vision: false,
      localExecution: true,
    },
    contextWindowTokens: 8192,
    privacyTier: 'mock-local',
    availability: 'active',
    isDefault: true,
  },
  {
    id: DEFAULT_DEMO_FALLBACK_MODEL_ID,
    providerId: 'mock-demo',
    displayName: 'EFER Demo · Fast Fallback',
    shortDescription: 'Secondary mock adapter used when permission-based fallback triggers.',
    capabilities: {
      chat: true,
      streaming: true,
      code: true,
      reasoning: false,
      vision: false,
      localExecution: true,
    },
    contextWindowTokens: 4096,
    privacyTier: 'mock-local',
    availability: 'active',
  },
  {
    id: DEFAULT_OLLAMA_MODEL_ID,
    providerId: 'local-ollama',
    displayName: 'Ollama · llama3.2',
    shortDescription: 'Local Ollama runtime on your device (enable in Settings & Providers).',
    capabilities: {
      chat: true,
      streaming: true,
      code: true,
      reasoning: true,
      vision: false,
      localExecution: true,
    },
    contextWindowTokens: 8192,
    privacyTier: 'local-device',
    availability: 'disabled',
  },
  {
    id: 'proxy:gemini-flash',
    providerId: 'server-proxy',
    displayName: 'Gemini 2.5 Flash (Server Proxy)',
    shortDescription: 'Server-side /api/* proxy slot (requires GEMINI_API_KEY env var on server).',
    capabilities: {
      chat: true,
      streaming: true,
      code: true,
      reasoning: true,
      vision: true,
      localExecution: false,
    },
    contextWindowTokens: 32768,
    privacyTier: 'server-proxy',
    availability: 'disabled',
  },
  {
    id: 'proxy:groq-llama',
    providerId: 'server-proxy',
    displayName: 'Groq · Llama 3.3 (Server Proxy)',
    shortDescription: 'Server-side /api/* proxy slot (requires GROQ_API_KEY env var on server).',
    capabilities: {
      chat: true,
      streaming: true,
      code: true,
      reasoning: true,
      vision: false,
      localExecution: false,
    },
    contextWindowTokens: 32768,
    privacyTier: 'server-proxy',
    availability: 'disabled',
  },
  {
    id: 'proxy:openrouter',
    providerId: 'server-proxy',
    displayName: 'OpenRouter · Auto (Server Proxy)',
    shortDescription: 'Server-side /api/* proxy slot (requires OPENROUTER_API_KEY env var on server).',
    capabilities: {
      chat: true,
      streaming: true,
      code: true,
      reasoning: true,
      vision: false,
      localExecution: false,
    },
    contextWindowTokens: 32768,
    privacyTier: 'server-proxy',
    availability: 'disabled',
  },
  {
    id: 'local-gguf-planned',
    providerId: 'local-gguf',
    displayName: 'Local GGUF WASM (Planned)',
    shortDescription: 'Future in-browser WebAssembly runtime (not yet wired).',
    capabilities: {
      chat: true,
      streaming: true,
      code: true,
      reasoning: true,
      vision: false,
      localExecution: true,
    },
    contextWindowTokens: 8192,
    privacyTier: 'local-device',
    availability: 'planned',
  },
];

export class ModelRegistry {
  private readonly models: Map<string, ModelDescriptor>;

  constructor(initialModels: ModelDescriptor[] = INITIAL_MODEL_CATALOG) {
    this.models = new Map(initialModels.map((model) => [model.id, model]));
  }

  listModels(): ModelDescriptor[] {
    return Array.from(this.models.values());
  }

  listActiveModels(): ModelDescriptor[] {
    return this.listModels().filter((model) => model.availability === 'active');
  }

  getModel(modelId: string): ModelDescriptor | undefined {
    return this.models.get(modelId);
  }

  upsertModel(model: ModelDescriptor): void {
    this.models.set(model.id, model);
  }

  removeModel(modelId: string): void {
    this.models.delete(modelId);
  }

  setModelAvailability(modelId: string, availability: ModelAvailability): void {
    const existing = this.models.get(modelId);
    if (!existing || existing.availability === 'planned') return;
    this.models.set(modelId, { ...existing, availability });
  }

  setProviderAvailability(providerId: string, availability: 'active' | 'disabled'): void {
    for (const [id, model] of this.models.entries()) {
      if (model.providerId === providerId && model.availability !== 'planned') {
        this.models.set(id, { ...model, availability });
      }
    }
  }

  getDefaultModel(): ModelDescriptor {
    const active = this.listActiveModels();
    return active.find((model) => model.isDefault) ?? active[0] ?? this.listModels()[0];
  }

  getFallbackCandidates(
    failedModelId: string,
    requiredCapability?: keyof ModelCapabilities,
  ): ModelDescriptor[] {
    return this.listActiveModels().filter((model) => {
      if (model.id === failedModelId) return false;
      if (requiredCapability && !model.capabilities[requiredCapability]) {
        return false;
      }
      return true;
    });
  }
}
