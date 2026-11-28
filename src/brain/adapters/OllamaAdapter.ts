import { NormalizedBrainError } from '../errors';
import type {
  BrainRequest,
  ProviderHealthStatus,
  ProviderRawChunk,
} from '../types';
import type { ProviderAdapter } from './ProviderAdapter';

export interface OllamaAdapterOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
}

export function normalizeOllamaBaseUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  const parsed = new URL(trimmed);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Ollama endpoint must use http: or https:.');
  }
  return parsed.toString().replace(/\/+$/, '');
}

export class OllamaAdapter implements ProviderAdapter {
  readonly id = 'local-ollama';
  readonly displayName = 'Local Ollama';
  readonly isMock = false;

  private baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OllamaAdapterOptions = {}) {
    this.baseUrl = normalizeOllamaBaseUrl(
      options.baseUrl ?? 'http://localhost:11434',
    );
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  setBaseUrl(nextUrl: string): void {
    this.baseUrl = normalizeOllamaBaseUrl(nextUrl);
  }

  supportsModel(modelId: string): boolean {
    return modelId.startsWith('ollama:');
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    try {
      const response = await this.fetchImpl(`${this.baseUrl}/api/tags`, {
        method: 'GET',
      });
      if (!response.ok) {
        return {
          providerId: this.id,
          healthy: false,
          detail: `Ollama responded with HTTP ${response.status}.`,
        };
      }
      const data = (await response.json()) as {
        models?: Array<{ name?: string }>;
      };
      const count = Array.isArray(data.models) ? data.models.length : 0;
      return {
        providerId: this.id,
        healthy: true,
        detail: `Connected to ${this.baseUrl} (${count} local model${count === 1 ? '' : 's'} detected).`,
      };
    } catch {
      return {
        providerId: this.id,
        healthy: false,
        detail: `Unable to reach Ollama at ${this.baseUrl}. Ensure Ollama is running locally with CORS allowed.`,
      };
    }
  }

  async *streamChat(request: BrainRequest): AsyncIterable<ProviderRawChunk> {
    const modelName = request.modelId.replace(/^ollama:/, '').trim();
    if (!modelName) {
      throw new NormalizedBrainError({
        code: 'MODEL_UNSUPPORTED',
        message: 'No Ollama model name was specified.',
        providerId: this.id,
        modelId: request.modelId,
        retryable: false,
        fallbackEligible: true,
      });
    }

    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelName,
          stream: true,
          messages: request.messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
        signal: request.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      throw new NormalizedBrainError({
        code: 'PROVIDER_UNAVAILABLE',
        message: `Could not connect to local Ollama at ${this.baseUrl}.`,
        providerId: this.id,
        modelId: request.modelId,
        retryable: true,
        fallbackEligible: true,
      });
    }

    if (!response.ok) {
      throw Object.assign(new Error(`Ollama HTTP ${response.status}`), {
        status: response.status,
      });
    }

    if (!response.body) {
      const payload = (await response.json()) as {
        message?: { content?: string };
      };
      const text = payload.message?.content ?? '';
      if (text) {
        yield { type: 'delta', text };
      }
      yield { type: 'done', finishReason: 'stop' };
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

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
          if (!line) continue;
          try {
            const parsed = JSON.parse(line) as {
              message?: { content?: string };
              done?: boolean;
              error?: string;
            };
            if (parsed.error) {
              throw new NormalizedBrainError({
                code: 'PROVIDER_UNAVAILABLE',
                message: 'Local Ollama reported a model execution error.',
                providerId: this.id,
                modelId: request.modelId,
                retryable: true,
                fallbackEligible: true,
              });
            }
            if (parsed.message?.content) {
              yield { type: 'delta', text: parsed.message.content };
            }
            if (parsed.done) {
              yield { type: 'done', finishReason: 'stop' };
              return;
            }
          } catch (parseErr) {
            if (parseErr instanceof NormalizedBrainError) {
              throw parseErr;
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    yield { type: 'done', finishReason: 'stop' };
  }
}
