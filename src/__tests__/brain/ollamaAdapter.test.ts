import { describe, expect, it, vi } from 'vitest';
import {
  isLocalOllamaEndpoint,
  normalizeOllamaBaseUrl,
  OllamaAdapter,
} from '../../brain/adapters/OllamaAdapter';
import { normalizeProviderError } from '../../brain/errors';

describe('OllamaAdapter', () => {
  it('allows local HTTP, requires HTTPS remotely, and rejects unsafe schemes', () => {
    expect(normalizeOllamaBaseUrl('http://localhost:11434/')).toBe(
      'http://localhost:11434',
    );
    expect(normalizeOllamaBaseUrl('https://ollama.example.local///')).toBe(
      'https://ollama.example.local',
    );
    expect(() => normalizeOllamaBaseUrl('http://192.168.1.20:11434')).toThrow(
      /Remote Ollama endpoints must use HTTPS/i,
    );
    expect(normalizeOllamaBaseUrl('https://ollama.example.com')).toBe(
      'https://ollama.example.com',
    );
    expect(() => normalizeOllamaBaseUrl('javascript:alert(1)')).toThrow(
      /http: or https:/i,
    );
    expect(() => normalizeOllamaBaseUrl('ftp://localhost:11434')).toThrow(
      /http: or https:/i,
    );
    expect(isLocalOllamaEndpoint('http://localhost:11434')).toBe(true);
    expect(isLocalOllamaEndpoint('http://127.0.0.1:11434')).toBe(true);
    expect(isLocalOllamaEndpoint('http://192.168.1.20:11434')).toBe(false);
    expect(isLocalOllamaEndpoint('https://ollama.example.com')).toBe(false);
  });

  it('checks /api/tags health honestly on success and unreachable failure', async () => {
    const healthyFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ models: [{ name: 'llama3.2' }, { name: 'qwen2.5' }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const adapter = new OllamaAdapter({ fetchImpl: healthyFetch });
    const okStatus = await adapter.checkHealth();
    expect(okStatus.healthy).toBe(true);
    expect(okStatus.detail).toContain('2 local models detected');

    const failingFetch = vi.fn(async () => {
      throw new Error('Connection refused');
    }) as unknown as typeof fetch;
    const offlineAdapter = new OllamaAdapter({ fetchImpl: failingFetch });
    const errStatus = await offlineAdapter.checkHealth();
    expect(errStatus.healthy).toBe(false);
    expect(errStatus.detail).toContain('Unable to reach Ollama');
  });

  it('streams NDJSON deltas cleanly from /api/chat and respects AbortSignal', async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({ message: { content: 'Hello ' }, done: false })}\n`,
          ),
        );
        controller.enqueue(
          encoder.encode(
            `${JSON.stringify({ message: { content: 'world!' }, done: true })}\n`,
          ),
        );
        controller.close();
      },
    });

    const mockFetch = vi.fn(
      async () => new Response(stream, { status: 200 }),
    ) as unknown as typeof fetch;

    const adapter = new OllamaAdapter({ fetchImpl: mockFetch });
    const chunks = [];
    for await (const chunk of adapter.streamChat({
      requestId: 'req-ollama-1',
      modelId: 'ollama:llama3.2',
      messages: [{ role: 'user', content: 'Hi' }],
      isIncognito: false,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: 'delta', text: 'Hello ' },
      { type: 'delta', text: 'world!' },
      { type: 'done', finishReason: 'stop' },
    ]);

    const controller = new AbortController();
    controller.abort();
    const abortFetch = vi.fn(async () => {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }) as unknown as typeof fetch;
    const abortAdapter = new OllamaAdapter({ fetchImpl: abortFetch });

    await expect(async () => {
      for await (const _chunk of abortAdapter.streamChat({
        requestId: 'req-ollama-abort',
        modelId: 'ollama:llama3.2',
        messages: [{ role: 'user', content: 'Hi' }],
        isIncognito: false,
        signal: controller.signal,
      })) {
        // drain
      }
    }).rejects.toThrow();

    try {
      await abortFetch('http://localhost:11434/api/chat');
    } catch (err) {
      const normalized = normalizeProviderError(err, {
        providerId: 'local-ollama',
        modelId: 'ollama:llama3.2',
      });
      expect(normalized.code).toBe('ABORTED');
    }
  });
});
