import { NormalizedBrainError, normalizeProviderError } from '../errors';
import type { ModelRegistry } from '../modelRegistry';
import type {
  BrainRequest,
  ModelCapabilities,
  ModelDescriptor,
  ProviderHealthStatus,
  ProviderRawChunk,
} from '../types';
import type { ProviderAdapter } from './ProviderAdapter';

export const BYOK_STORAGE_KEY = 'efer-byok-providers-v1';
export const CLIENT_BYOK_PROVIDER_ID = 'client-byok';
export const CLIENT_BYOK_MODEL_PREFIX = 'byok:';

export type ByokCapabilityTag =
  | 'chat'
  | 'code'
  | 'think'
  | 'image'
  | 'video'
  | 'audio';

export const BYOK_CAPABILITY_OPTIONS: Array<{
  id: ByokCapabilityTag;
  label: string;
}> = [
  { id: 'chat', label: 'Chat' },
  { id: 'code', label: 'Code' },
  { id: 'think', label: 'Think' },
  { id: 'image', label: 'Image' },
  { id: 'video', label: 'Video' },
  { id: 'audio', label: 'Audio' },
];

export type ByokPresetId =
  | 'openai'
  | 'gemini'
  | 'groq'
  | 'openrouter'
  | 'anthropic'
  | 'deepseek'
  | 'together'
  | 'fal'
  | 'custom';

export type ByokProtocol = 'openai-compatible' | 'gemini';

export interface ByokPresetDefinition {
  id: ByokPresetId;
  label: string;
  defaultBaseUrl: string;
  defaultModelPlaceholder: string;
  protocol: ByokProtocol;
}

export const BYOK_PRESETS: ByokPresetDefinition[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    defaultBaseUrl: 'https://api.openai.com/v1',
    defaultModelPlaceholder: 'gpt-4o-mini',
    protocol: 'openai-compatible',
  },
  {
    id: 'gemini',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModelPlaceholder: 'gemini-2.5-flash',
    protocol: 'gemini',
  },
  {
    id: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    defaultModelPlaceholder: 'llama-3.3-70b-versatile',
    protocol: 'openai-compatible',
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
    defaultModelPlaceholder: 'openai/gpt-4o-mini',
    protocol: 'openai-compatible',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    defaultModelPlaceholder: 'claude-3-7-sonnet-latest',
    protocol: 'openai-compatible',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    defaultModelPlaceholder: 'deepseek-chat',
    protocol: 'openai-compatible',
  },
  {
    id: 'together',
    label: 'Together AI',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    defaultModelPlaceholder: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    protocol: 'openai-compatible',
  },
  {
    id: 'fal',
    label: 'Fal.ai',
    defaultBaseUrl: 'https://api.fal.ai/v1',
    defaultModelPlaceholder: 'fal-ai/any-llm',
    protocol: 'openai-compatible',
  },
  {
    id: 'custom',
    label: 'Custom / Other',
    defaultBaseUrl: '',
    defaultModelPlaceholder: 'custom-model-id',
    protocol: 'openai-compatible',
  },
];

export interface ByokProviderConfig {
  id: string;
  presetId: ByokPresetId;
  displayName: string;
  baseUrl: string;
  modelId: string;
  apiKey: string;
  capabilities: ByokCapabilityTag[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ByokProviderDraft {
  presetId: ByokPresetId;
  displayName: string;
  baseUrl: string;
  modelId: string;
  apiKey: string;
  capabilities: ByokCapabilityTag[];
  enabled?: boolean;
}

const VALID_PRESETS = new Set<ByokPresetId>(BYOK_PRESETS.map((p) => p.id));
const VALID_TAGS = new Set<ByokCapabilityTag>(
  BYOK_CAPABILITY_OPTIONS.map((tag) => tag.id),
);

function getDefaultStorage(): Storage | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

export function stripControlChars(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim();
}

export function maskApiKey(apiKey: string): string {
  const cleaned = apiKey.trim();
  if (!cleaned) return '••••';
  if (cleaned.length <= 4) return '••••';
  return `••••${cleaned.slice(-4)}`;
}

export function normalizeByokBaseUrl(rawUrl: string): string {
  const trimmed = stripControlChars(rawUrl).replace(/\/+$/, '');
  if (!trimmed) {
    throw new Error('Base URL is required.');
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Please enter a valid http:// or https:// Base URL.');
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Base URL must use http: or https:.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Base URL must not contain embedded credentials.');
  }
  if (parsed.search || parsed.hash) {
    throw new Error('Base URL must not include query parameters or fragments.');
  }
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname.startsWith('169.254.') ||
    hostname === 'metadata.google.internal' ||
    hostname === 'metadata'
  ) {
    throw new Error('Link-local and metadata endpoints are not allowed.');
  }
  return parsed.toString().replace(/\/+$/, '');
}

export function detectByokProtocol(
  presetId: ByokPresetId,
  baseUrl: string,
): ByokProtocol {
  if (presetId === 'gemini') return 'gemini';
  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname.toLowerCase() === 'generativelanguage.googleapis.com') {
      return 'gemini';
    }
  } catch {
    // Ignore parse errors; fallback to openai-compatible
  }
  return 'openai-compatible';
}

export function buildOpenAiChatCompletionsUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, '');
  if (clean.endsWith('/chat/completions')) {
    return clean;
  }
  return `${clean}/chat/completions`;
}

export function buildGeminiEndpointUrl(
  baseUrl: string,
  modelId: string,
  stream: boolean,
): string {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const cleanModel = modelId.trim().replace(/^models\//i, '');
  const action = stream ? 'streamGenerateContent?alt=sse' : 'generateContent';
  return `${cleanBase}/models/${encodeURIComponent(cleanModel)}:${action}`;
}

export function sanitizeCapabilityTags(
  rawTags: unknown,
): ByokCapabilityTag[] {
  if (!Array.isArray(rawTags)) return ['chat'];
  const unique: ByokCapabilityTag[] = [];
  for (const tag of rawTags) {
    if (
      typeof tag === 'string' &&
      VALID_TAGS.has(tag as ByokCapabilityTag) &&
      !unique.includes(tag as ByokCapabilityTag)
    ) {
      unique.push(tag as ByokCapabilityTag);
    }
  }
  return unique.length > 0 ? unique : ['chat'];
}

export function mapTagsToModelCapabilities(
  tags: ByokCapabilityTag[],
): ModelCapabilities {
  const set = new Set(tags);
  return {
    chat: set.has('chat'),
    streaming: true,
    code: set.has('code'),
    reasoning: set.has('think'),
    vision: set.has('image'),
    localExecution: false,
    image: set.has('image'),
    video: set.has('video'),
    audio: set.has('audio'),
  };
}

export function toByokRegistryModelId(configId: string): string {
  return `${CLIENT_BYOK_MODEL_PREFIX}${configId}`;
}

export function configToModelDescriptor(
  config: ByokProviderConfig,
): ModelDescriptor {
  const presetLabel =
    BYOK_PRESETS.find((p) => p.id === config.presetId)?.label ?? 'Custom API';
  return {
    id: toByokRegistryModelId(config.id),
    providerId: CLIENT_BYOK_PROVIDER_ID,
    displayName: config.displayName,
    shortDescription: `${presetLabel} · ${config.modelId} (Browser BYOK)`,
    capabilities: mapTagsToModelCapabilities(config.capabilities),
    contextWindowTokens: 32768,
    privacyTier: 'byok-browser',
    availability: config.enabled ? 'active' : 'disabled',
  };
}

export function validateByokDraft(
  draft: ByokProviderDraft,
): { ok: true; normalizedBaseUrl: string; cleanName: string; cleanModelId: string; cleanApiKey: string; tags: ByokCapabilityTag[] } | { ok: false; error: string } {
  const cleanName = stripControlChars(draft.displayName).slice(0, 80);
  if (!cleanName) {
    return { ok: false, error: 'Display name is required (e.g., "My Groq Key").' };
  }

  let normalizedBaseUrl: string;
  try {
    normalizedBaseUrl = normalizeByokBaseUrl(draft.baseUrl);
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : 'Please enter a valid Base URL.',
    };
  }

  const cleanModelId = stripControlChars(draft.modelId).slice(0, 160);
  if (!cleanModelId) {
    return { ok: false, error: 'Model ID is required (e.g., llama-3.3-70b-versatile).' };
  }

  const cleanApiKey = stripControlChars(draft.apiKey).slice(0, 512);
  if (!cleanApiKey) {
    return { ok: false, error: 'API key is required.' };
  }

  const tags = sanitizeCapabilityTags(draft.capabilities);
  return {
    ok: true,
    normalizedBaseUrl,
    cleanName,
    cleanModelId,
    cleanApiKey,
    tags,
  };
}

function sanitizeStoredConfig(raw: unknown): ByokProviderConfig | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const candidate = raw as Record<string, unknown>;
  const id = typeof candidate.id === 'string' ? stripControlChars(candidate.id) : '';
  const presetRaw = typeof candidate.presetId === 'string' ? candidate.presetId : 'custom';
  const presetId: ByokPresetId = VALID_PRESETS.has(presetRaw as ByokPresetId)
    ? (presetRaw as ByokPresetId)
    : 'custom';
  const displayName =
    typeof candidate.displayName === 'string'
      ? stripControlChars(candidate.displayName).slice(0, 80)
      : '';
  const modelId =
    typeof candidate.modelId === 'string'
      ? stripControlChars(candidate.modelId).slice(0, 160)
      : '';
  const apiKey =
    typeof candidate.apiKey === 'string'
      ? stripControlChars(candidate.apiKey).slice(0, 512)
      : '';
  const baseUrlRaw =
    typeof candidate.baseUrl === 'string' ? candidate.baseUrl : '';

  if (!id || !displayName || !modelId || !apiKey) return null;

  let baseUrl: string;
  try {
    baseUrl = normalizeByokBaseUrl(baseUrlRaw);
  } catch {
    return null;
  }

  return {
    id,
    presetId,
    displayName,
    baseUrl,
    modelId,
    apiKey,
    capabilities: sanitizeCapabilityTags(candidate.capabilities),
    enabled: candidate.enabled !== false,
    createdAt:
      typeof candidate.createdAt === 'string'
        ? candidate.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof candidate.updatedAt === 'string'
        ? candidate.updatedAt
        : new Date().toISOString(),
  };
}

export function loadByokProvidersFromStorage(
  storage: Storage | null = getDefaultStorage(),
): ByokProviderConfig[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(BYOK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items: ByokProviderConfig[] = [];
    for (const entry of parsed.slice(0, 50)) {
      const sanitized = sanitizeStoredConfig(entry);
      if (sanitized) items.push(sanitized);
    }
    return items;
  } catch {
    return [];
  }
}

export function saveByokProvidersToStorage(
  providers: ByokProviderConfig[],
  storage: Storage | null = getDefaultStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(BYOK_STORAGE_KEY, JSON.stringify(providers));
  } catch {
    // Ignore storage quota or private browsing write errors
  }
}

export interface ClientByokAdapterOptions {
  fetchImpl?: typeof fetch;
  storage?: Storage | null;
  providers?: ByokProviderConfig[];
}

export interface ByokConnectionTestInput {
  presetId: ByokPresetId;
  baseUrl: string;
  modelId: string;
  apiKey: string;
}

function extractGeminiTextFromPayload(payload: unknown): {
  text: string;
  finishReason: 'stop' | 'length';
} {
  if (typeof payload !== 'object' || payload === null) {
    return { text: '', finishReason: 'stop' };
  }
  const obj = payload as {
    candidates?: Array<{
      finishReason?: string;
      content?: {
        parts?: Array<{ text?: string }>;
      };
    }>;
  };
  const firstCandidate = obj.candidates?.[0];
  const parts = firstCandidate?.content?.parts ?? [];
  const text = parts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('');
  const finishReason =
    firstCandidate?.finishReason === 'MAX_TOKENS' ? 'length' : 'stop';
  return { text, finishReason };
}

function extractOpenAiDeltaText(payload: unknown): {
  text: string;
  finishReason?: 'stop' | 'length';
} {
  if (typeof payload !== 'object' || payload === null) {
    return { text: '' };
  }
  const obj = payload as {
    choices?: Array<{
      finish_reason?: string | null;
      delta?: { content?: string | null };
      message?: { content?: string | null };
      text?: string | null;
    }>;
  };
  const choice = obj.choices?.[0];
  if (!choice) return { text: '' };
  const text =
    (typeof choice.delta?.content === 'string' ? choice.delta.content : '') ||
    (typeof choice.message?.content === 'string' ? choice.message.content : '') ||
    (typeof choice.text === 'string' ? choice.text : '');
  const finishReason =
    choice.finish_reason === 'length'
      ? 'length'
      : choice.finish_reason
        ? 'stop'
        : undefined;
  return { text, finishReason };
}

function buildGeminiRequestBody(
  messages: BrainRequest['messages'],
  options: { maxOutputTokens?: number; temperature?: number } = {},
) {
  const systemParts: string[] = [];
  const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const msg of messages) {
    if (msg.role === 'system') {
      if (msg.content.trim()) systemParts.push(msg.content);
      continue;
    }
    contents.push({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }],
    });
  }

  if (contents.length === 0) {
    contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
  }

  const generationConfig: Record<string, number> = {};
  if (typeof options.maxOutputTokens === 'number') {
    generationConfig.maxOutputTokens = options.maxOutputTokens;
  }
  if (typeof options.temperature === 'number') {
    generationConfig.temperature = options.temperature;
  }

  return {
    ...(systemParts.length > 0
      ? { systemInstruction: { parts: [{ text: systemParts.join('\n\n') }] } }
      : {}),
    contents,
    ...(Object.keys(generationConfig).length > 0 ? { generationConfig } : {}),
  };
}

export class ClientByokAdapter implements ProviderAdapter {
  readonly id = CLIENT_BYOK_PROVIDER_ID;
  readonly displayName = 'Custom APIs (BYOK)';
  readonly isMock = false;

  private readonly fetchImpl: typeof fetch;
  private readonly storage: Storage | null;
  private staticProviders: ByokProviderConfig[] | null;

  constructor(options: ClientByokAdapterOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.storage =
      options.storage !== undefined ? options.storage : getDefaultStorage();
    this.staticProviders = options.providers ?? null;
  }

  getProviders(): ByokProviderConfig[] {
    if (this.staticProviders !== null) {
      return this.staticProviders;
    }
    return loadByokProvidersFromStorage(this.storage);
  }

  setProviders(providers: ByokProviderConfig[]): void {
    this.staticProviders = providers;
    saveByokProvidersToStorage(providers, this.storage);
  }

  findProviderForModel(registryModelId: string): ByokProviderConfig | undefined {
    if (!registryModelId.startsWith(CLIENT_BYOK_MODEL_PREFIX)) {
      return undefined;
    }
    const configId = registryModelId.slice(CLIENT_BYOK_MODEL_PREFIX.length);
    return this.getProviders().find((item) => item.id === configId);
  }

  supportsModel(modelId: string): boolean {
    if (!modelId.startsWith(CLIENT_BYOK_MODEL_PREFIX)) return false;
    const provider = this.findProviderForModel(modelId);
    return Boolean(provider && provider.enabled);
  }

  syncModelsToRegistry(registry: ModelRegistry): void {
    for (const existing of registry.listModels()) {
      if (existing.providerId === this.id) {
        registry.removeModel(existing.id);
      }
    }
    for (const provider of this.getProviders()) {
      if (provider.enabled) {
        registry.upsertModel(configToModelDescriptor(provider));
      }
    }
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    const enabledCount = this.getProviders().filter((p) => p.enabled).length;
    return {
      providerId: this.id,
      healthy: enabledCount > 0,
      detail:
        enabledCount > 0
          ? `${enabledCount} custom browser BYOK model${enabledCount === 1 ? '' : 's'} active.`
          : 'No active custom browser BYOK APIs configured.',
    };
  }

  async testConnection(
    input: ByokConnectionTestInput,
    callerSignal?: AbortSignal,
  ): Promise<ProviderHealthStatus> {
    let normalizedUrl: string;
    try {
      normalizedUrl = normalizeByokBaseUrl(input.baseUrl);
    } catch (err) {
      return {
        providerId: this.id,
        healthy: false,
        detail:
          err instanceof Error ? err.message : 'Invalid Base URL.',
      };
    }

    const cleanModel = stripControlChars(input.modelId);
    const cleanKey = stripControlChars(input.apiKey);

    if (!cleanModel) {
      return {
        providerId: this.id,
        healthy: false,
        detail: 'Model ID is required before testing.',
      };
    }
    if (!cleanKey) {
      return {
        providerId: this.id,
        healthy: false,
        detail: 'API key is required before testing.',
      };
    }

    const protocol = detectByokProtocol(input.presetId, normalizedUrl);
    const timeoutController = new AbortController();
    const timeoutId = globalThis.setTimeout(() => timeoutController.abort(), 15000);
    const onCallerAbort = () => timeoutController.abort();
    callerSignal?.addEventListener('abort', onCallerAbort, { once: true });

    try {
      let response: Response;
      if (protocol === 'gemini') {
        const url = buildGeminiEndpointUrl(normalizedUrl, cleanModel, false);
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': cleanKey,
          },
          body: JSON.stringify(
            buildGeminiRequestBody([{ role: 'user', content: 'ping' }], {
              maxOutputTokens: 1,
            }),
          ),
          signal: timeoutController.signal,
        });
      } else {
        const url = buildOpenAiChatCompletionsUrl(normalizedUrl);
        response = await this.fetchImpl(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cleanKey}`,
          },
          body: JSON.stringify({
            model: cleanModel,
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
            stream: false,
          }),
          signal: timeoutController.signal,
        });
      }

      if (!response.ok) {
        const normalized = normalizeProviderError(
          Object.assign(new Error(`HTTP ${response.status}`), {
            status: response.status,
          }),
          { providerId: this.id, modelId: cleanModel },
        );
        return {
          providerId: this.id,
          healthy: false,
          detail: `HTTP ${response.status}: ${normalized.message}`,
        };
      }

      return {
        providerId: this.id,
        healthy: true,
        detail: `Connected to ${cleanModel} via ${protocol === 'gemini' ? 'Google Gemini REST' : 'OpenAI-compatible'} endpoint.`,
      };
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          providerId: this.id,
          healthy: false,
          detail: callerSignal?.aborted
            ? 'Connection test cancelled.'
            : 'Connection test timed out after 15 seconds.',
        };
      }
      return {
        providerId: this.id,
        healthy: false,
        detail:
          'Unable to reach endpoint directly from the browser (check Base URL, network, or provider CORS settings).',
      };
    } finally {
      globalThis.clearTimeout(timeoutId);
      callerSignal?.removeEventListener('abort', onCallerAbort);
    }
  }

  async *streamChat(request: BrainRequest): AsyncIterable<ProviderRawChunk> {
    const config = this.findProviderForModel(request.modelId);
    if (!config || !config.enabled) {
      throw new NormalizedBrainError({
        code: 'MODEL_UNSUPPORTED',
        message: 'Custom BYOK provider is missing or disabled.',
        providerId: this.id,
        modelId: request.modelId,
        retryable: false,
        fallbackEligible: true,
      });
    }

    const protocol = detectByokProtocol(config.presetId, config.baseUrl);
    if (protocol === 'gemini') {
      yield* this.streamGemini(config, request);
      return;
    }

    yield* this.streamOpenAiCompatible(config, request);
  }

  private async *streamOpenAiCompatible(
    config: ByokProviderConfig,
    request: BrainRequest,
  ): AsyncIterable<ProviderRawChunk> {
    const endpoint = buildOpenAiChatCompletionsUrl(config.baseUrl);

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.modelId,
          stream: true,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          ...(typeof request.maxOutputTokens === 'number'
            ? { max_tokens: request.maxOutputTokens }
            : {}),
          ...(typeof request.temperature === 'number'
            ? { temperature: request.temperature }
            : {}),
        }),
        signal: request.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      throw new NormalizedBrainError({
        code: 'PROVIDER_UNAVAILABLE',
        message: `Could not reach ${config.displayName} endpoint from the browser.`,
        providerId: this.id,
        modelId: request.modelId,
        retryable: true,
        fallbackEligible: true,
      });
    }

    if (!response.ok) {
      throw Object.assign(new Error(`BYOK HTTP ${response.status}`), {
        status: response.status,
      });
    }

    const contentType = response.headers?.get('content-type') ?? '';
    if (!response.body || contentType.includes('application/json')) {
      const payload = (await response.json()) as unknown;
      const { text, finishReason } = extractOpenAiDeltaText(payload);
      if (text) {
        yield { type: 'delta', text };
      }
      yield { type: 'done', finishReason: finishReason ?? 'stop' };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finishReason: 'stop' | 'length' = 'stop';

    try {
      while (true) {
        if (request.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith(':')) continue;
          if (!line.startsWith('data:')) continue;

          const data = line.slice(5).trim();
          if (data === '[DONE]') {
            yield { type: 'done', finishReason };
            return;
          }

          try {
            const parsed = JSON.parse(data) as { error?: { message?: string } };
            if (parsed.error) {
              throw new NormalizedBrainError({
                code: 'PROVIDER_UNAVAILABLE',
                message: `${config.displayName} returned a streaming error.`,
                providerId: this.id,
                modelId: request.modelId,
                retryable: true,
                fallbackEligible: true,
              });
            }
            const extracted = extractOpenAiDeltaText(parsed);
            if (extracted.finishReason) {
              finishReason = extracted.finishReason;
            }
            if (extracted.text) {
              yield { type: 'delta', text: extracted.text };
            }
          } catch (parseErr) {
            if (parseErr instanceof NormalizedBrainError) {
              throw parseErr;
            }
            // Ignore partial or keepalive SSE frames
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done', finishReason };
  }

  private async *streamGemini(
    config: ByokProviderConfig,
    request: BrainRequest,
  ): AsyncIterable<ProviderRawChunk> {
    const endpoint = buildGeminiEndpointUrl(config.baseUrl, config.modelId, true);

    let response: Response;
    try {
      response = await this.fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        body: JSON.stringify(
          buildGeminiRequestBody(request.messages, {
            maxOutputTokens: request.maxOutputTokens,
            temperature: request.temperature,
          }),
        ),
        signal: request.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      throw new NormalizedBrainError({
        code: 'PROVIDER_UNAVAILABLE',
        message: `Could not reach ${config.displayName} Gemini REST endpoint from the browser.`,
        providerId: this.id,
        modelId: request.modelId,
        retryable: true,
        fallbackEligible: true,
      });
    }

    if (!response.ok) {
      throw Object.assign(new Error(`Gemini HTTP ${response.status}`), {
        status: response.status,
      });
    }

    const contentType = response.headers?.get('content-type') ?? '';
    if (!response.body || contentType.includes('application/json')) {
      const payload = (await response.json()) as unknown;
      const items = Array.isArray(payload) ? payload : [payload];
      let finishReason: 'stop' | 'length' = 'stop';
      for (const item of items) {
        const extracted = extractGeminiTextFromPayload(item);
        finishReason = extracted.finishReason;
        if (extracted.text) {
          yield { type: 'delta', text: extracted.text };
        }
      }
      yield { type: 'done', finishReason };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finishReason: 'stop' | 'length' = 'stop';

    try {
      while (true) {
        if (request.signal?.aborted) {
          throw new DOMException('The operation was aborted.', 'AbortError');
        }
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const rawLine of lines) {
          const line = rawLine.trim();
          if (!line || line.startsWith(':')) continue;
          if (!line.startsWith('data:')) continue;

          const data = line.slice(5).trim();
          if (!data || data === '[DONE]') {
            yield { type: 'done', finishReason };
            return;
          }

          try {
            const parsed = JSON.parse(data) as { error?: { status?: string; code?: number } };
            if (parsed.error) {
              throw Object.assign(
                new Error('Gemini streaming error'),
                { status: typeof parsed.error.code === 'number' ? parsed.error.code : 500 },
              );
            }
            const extracted = extractGeminiTextFromPayload(parsed);
            finishReason = extracted.finishReason;
            if (extracted.text) {
              yield { type: 'delta', text: extracted.text };
            }
          } catch (parseErr) {
            if (parseErr instanceof NormalizedBrainError) {
              throw parseErr;
            }
            if (
              typeof parseErr === 'object' &&
              parseErr !== null &&
              'status' in parseErr
            ) {
              throw parseErr;
            }
            // Ignore malformed SSE keepalive frame
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done', finishReason };
  }
}
