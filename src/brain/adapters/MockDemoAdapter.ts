import { NormalizedBrainError } from '../errors';
import {
  DEFAULT_DEMO_FALLBACK_MODEL_ID,
  DEFAULT_DEMO_PRIMARY_MODEL_ID,
} from '../modelRegistry';
import type {
  BrainRequest,
  ProviderHealthStatus,
  ProviderRawChunk,
} from '../types';
import type { ProviderAdapter } from './ProviderAdapter';

export interface MockDemoAdapterOptions {
  chunkDelayMs?: number;
}

function waitWithAbort(ms: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
  }
  if (ms <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);

    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('The operation was aborted.', 'AbortError'));
    };

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

function detectSimulatedFault(
  prompt: string,
  modelId: string,
): NormalizedBrainError | null {
  if (modelId !== DEFAULT_DEMO_PRIMARY_MODEL_ID) {
    return null;
  }

  const lower = prompt.toLowerCase();

  if (lower.includes('[demo:rate-limit]')) {
    return new NormalizedBrainError({
      code: 'RATE_LIMITED',
      message: 'Simulated 429 rate limit on EFER Demo · Balanced.',
      providerId: 'mock-demo',
      modelId,
      retryable: true,
      fallbackEligible: true,
    });
  }

  if (lower.includes('[demo:timeout]')) {
    return new NormalizedBrainError({
      code: 'TIMEOUT',
      message: 'Simulated request timeout on EFER Demo · Balanced.',
      providerId: 'mock-demo',
      modelId,
      retryable: true,
      fallbackEligible: true,
    });
  }

  if (lower.includes('[demo:unavailable]')) {
    return new NormalizedBrainError({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'Simulated 503 service unavailability on EFER Demo · Balanced.',
      providerId: 'mock-demo',
      modelId,
      retryable: true,
      fallbackEligible: true,
    });
  }

  if (lower.includes('[demo:offline]')) {
    return new NormalizedBrainError({
      code: 'OFFLINE',
      message: 'Simulated offline network failure on EFER Demo · Balanced.',
      providerId: 'mock-demo',
      modelId,
      retryable: true,
      fallbackEligible: true,
    });
  }

  if (lower.includes('[demo:auth-error]')) {
    return new NormalizedBrainError({
      code: 'AUTH_ERROR',
      message: 'Simulated credential failure on EFER Demo · Balanced.',
      providerId: 'mock-demo',
      modelId,
      retryable: false,
      fallbackEligible: true,
    });
  }

  if (lower.includes('[demo:context-limit]')) {
    return new NormalizedBrainError({
      code: 'CONTEXT_TOO_LONG',
      message: 'Simulated context window limit exceeded.',
      providerId: 'mock-demo',
      modelId,
      retryable: false,
      fallbackEligible: false,
    });
  }

  return null;
}

function stripFaultDirectives(text: string): string {
  return text
    .replace(
      /\[demo:(?:rate-limit|timeout|unavailable|offline|auth-error|context-limit)\]/gi,
      '',
    )
    .trim();
}

function buildDemoReply(request: BrainRequest): string {
  const lastUserMessage = [...request.messages]
    .reverse()
    .find((msg) => msg.role === 'user');
  const rawPrompt = lastUserMessage?.content ?? '';
  const cleanedPrompt = stripFaultDirectives(rawPrompt);
  const snippet =
    cleanedPrompt.length > 140 ? `${cleanedPrompt.slice(0, 140)}…` : cleanedPrompt;

  const isFallback = request.modelId === DEFAULT_DEMO_FALLBACK_MODEL_ID;
  const modelHeading = isFallback
    ? '**EFER Demo · Fast Fallback** (Local Phase 2 Mock Adapter)'
    : '**EFER Demo · Balanced** (Local Phase 2 Mock Adapter)';

  const lines = [
    `${modelHeading}`,
    '',
    snippet
      ? `Processed your prompt in local Phase 2 demo mode: "${snippet}"`
      : 'Processed your turn in local Phase 2 demo mode.',
    '',
    request.isIncognito
      ? '- **Privacy scope**: Running inside an isolated Incognito session (RAM only, excluded from exports, wiped on exit).'
      : '- **Privacy scope**: Held in active workspace memory without sending keys or prompts to external servers.',
    '- **Architecture status**: Streaming, context windowing, error normalization, and permission-based fallback are routed through `EferBrain`. Live provider keys remain unconnected.',
  ];

  if (!isFallback) {
    lines.push(
      '- **Fallback test tip**: Include `[demo:rate-limit]` or `[demo:timeout]` in a prompt to test permission-based fallback switching.',
    );
  }

  return lines.join('\n');
}

function splitIntoStreamChunks(text: string): string[] {
  const tokens = text.match(/\S+\s*/g);
  if (!tokens || tokens.length === 0) return [text];
  const chunks: string[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    chunks.push(tokens.slice(i, i + 2).join(''));
  }
  return chunks;
}

export class MockDemoAdapter implements ProviderAdapter {
  readonly id = 'mock-demo';
  readonly displayName = 'EFER Demo Provider';
  readonly isMock = true;

  private readonly chunkDelayMs: number;

  constructor(options: MockDemoAdapterOptions = {}) {
    this.chunkDelayMs = options.chunkDelayMs ?? 12;
  }

  supportsModel(modelId: string): boolean {
    return (
      modelId === DEFAULT_DEMO_PRIMARY_MODEL_ID ||
      modelId === DEFAULT_DEMO_FALLBACK_MODEL_ID
    );
  }

  async checkHealth(): Promise<ProviderHealthStatus> {
    return {
      providerId: this.id,
      healthy: true,
      detail: 'Local Phase 2 mock adapter ready (no network or API keys required).',
    };
  }

  async *streamChat(request: BrainRequest): AsyncIterable<ProviderRawChunk> {
    await waitWithAbort(this.chunkDelayMs, request.signal);

    const lastUserMessage = [...request.messages]
      .reverse()
      .find((msg) => msg.role === 'user');
    const fault = detectSimulatedFault(lastUserMessage?.content ?? '', request.modelId);
    if (fault) {
      throw fault;
    }

    const reply = buildDemoReply(request);
    const chunks = splitIntoStreamChunks(reply);

    for (const chunk of chunks) {
      await waitWithAbort(this.chunkDelayMs, request.signal);
      yield { type: 'delta', text: chunk };
    }

    yield { type: 'done', finishReason: 'stop' };
  }
}
