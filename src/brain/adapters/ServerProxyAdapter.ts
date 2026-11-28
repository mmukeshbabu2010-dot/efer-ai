import { NormalizedBrainError } from '../errors';
import type {
  BrainRequest,
  ProviderHealthStatus,
  ProviderRawChunk,
} from '../types';
import type { ProviderAdapter } from './ProviderAdapter';

export interface ServerProxyAdapterOptions {
  endpointBase?: string;
  fetchImpl?: typeof fetch;
}

export interface ServerProxyStatus {
  reachable: boolean;
  configured: {
    groq: boolean;
    openrouter: boolean;
  };
  detail: string;
}

export class ServerProxyAdapter implements ProviderAdapter {
  readonly id = 'server-proxy';
  readonly displayName = 'Server Proxy (/api/*)';
  readonly isMock = false;

  private readonly endpointBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor(options: ServerProxyAdapterOptions = {}) {
    this.endpointBase = (options.endpointBase ?? '/api').replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  supportsModel(modelId: string): boolean {
    return modelId.startsWith('proxy:');
  }

  async inspectProxyProviders(): Promise<ServerProxyStatus> {
    try {
      const response = await this.fetchImpl(`${this.endpointBase}/providers`, {
        method: 'GET',
      });
      const contentType = response.headers.get('content-type') ?? '';
      if (!response.ok || !contentType.includes('application/json')) {
        return {
          reachable: false,
          configured: { groq: false, openrouter: false },
          detail:
            'No /api/providers backend is active on this host (normal for static-only hosting).',
        };
      }
      const data = (await response.json()) as {
        configured?: Partial<ServerProxyStatus['configured']>;
      };
      const configured = {
        groq: Boolean(data.configured?.groq),
        openrouter: Boolean(data.configured?.openrouter),
      };
      const activeNames = Object.entries(configured)
        .filter(([, enabled]) => enabled)
        .map(([name]) => name);

      return {
        reachable: true,
        configured,
        detail:
          activeNames.length > 0
            ? `Server proxy reachable. Configured server-side keys: ${activeNames.join(', ')}.`
            : 'Server proxy reachable, with no server-side provider keys configured yet.',
      };
    } catch {
      return {
        reachable: false,
        configured: { groq: false, openrouter: false },
        detail: 'Server proxy endpoint is unreachable.',
      };
    }
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    const status = await this.inspectProxyProviders();
    const anyConfigured = Object.values(status.configured).some(Boolean);
    return {
      providerId: this.id,
      healthy: status.reachable && anyConfigured,
      detail: status.detail,
    };
  }

  async *streamChat(request: BrainRequest): AsyncIterable<ProviderRawChunk> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.endpointBase}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: request.modelId,
          messages: request.messages,
          isIncognito: request.isIncognito,
        }),
        signal: request.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        throw err;
      }
      throw new NormalizedBrainError({
        code: 'PROVIDER_UNAVAILABLE',
        message: 'Backend /api/chat proxy is not reachable.',
        providerId: this.id,
        modelId: request.modelId,
        retryable: true,
        fallbackEligible: true,
      });
    }

    if (!response.ok) {
      throw Object.assign(new Error(`Proxy HTTP ${response.status}`), {
        status: response.status,
      });
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      const payload = (await response.json()) as { text?: string };
      if (payload.text) {
        yield { type: 'delta', text: payload.text };
      }
      yield { type: 'done', finishReason: 'stop' };
      return;
    }

    if (contentType.includes('text/event-stream') && response.body) {
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
            if (!line.startsWith('data:')) continue;
            const payload = line.slice(5).trim();
            if (payload === '[DONE]') {
              yield { type: 'done', finishReason: 'stop' };
              return;
            }
            try {
              const parsed = JSON.parse(payload) as { text?: string };
              if (parsed.text) {
                yield { type: 'delta', text: parsed.text };
              }
            } catch {
              // Ignore malformed SSE comment/keepalive chunk
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
      yield { type: 'done', finishReason: 'stop' };
      return;
    }

    throw new NormalizedBrainError({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Backend /api/chat proxy is not configured on this static deployment.',
      providerId: this.id,
      modelId: request.modelId,
      retryable: false,
      fallbackEligible: true,
    });
  }
}
