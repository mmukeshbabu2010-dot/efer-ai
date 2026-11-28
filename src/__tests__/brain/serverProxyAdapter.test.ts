import { describe, expect, it, vi } from 'vitest';
import { ServerProxyAdapter } from '../../brain/adapters/ServerProxyAdapter';
import { normalizeProviderError } from '../../brain/errors';

describe('ServerProxyAdapter', () => {
  it('inspects /api/providers JSON flags and falls back cleanly on static HTML hosts', async () => {
    const configuredFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          configured: { groq: false, openrouter: true },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const adapter = new ServerProxyAdapter({ fetchImpl: configuredFetch });
    const status = await adapter.inspectProxyProviders();
    expect(status.reachable).toBe(true);
    expect(status.configured).toEqual({
      groq: false,
      openrouter: true,
    });
    expect(status.detail).toContain('openrouter');

    const health = await adapter.checkHealth();
    expect(health.healthy).toBe(true);

    const staticHtmlFetch = vi.fn(async () =>
      new Response('<!doctype html><html><body>SPA</body></html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html' },
      }),
    ) as unknown as typeof fetch;

    const staticAdapter = new ServerProxyAdapter({ fetchImpl: staticHtmlFetch });
    const staticStatus = await staticAdapter.inspectProxyProviders();
    expect(staticStatus.reachable).toBe(false);
    expect(staticStatus.detail).toContain('static-only hosting');
  });

  it('streams SSE and JSON responses from /api/chat and normalizes HTTP status errors', async () => {
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: 'Proxy ' })}\n\n`),
        );
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ text: 'stream' })}\n\n`),
        );
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    });

    const sseFetch = vi.fn(
      async () =>
        new Response(sseStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        }),
    ) as unknown as typeof fetch;

    const sseAdapter = new ServerProxyAdapter({ fetchImpl: sseFetch });
    const chunks = [];
    for await (const chunk of sseAdapter.streamChat({
      requestId: 'req-proxy-1',
      modelId: 'proxy:gemini-flash',
      messages: [{ role: 'user', content: 'Hello proxy' }],
      isIncognito: false,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual([
      { type: 'delta', text: 'Proxy ' },
      { type: 'delta', text: 'stream' },
      { type: 'done', finishReason: 'stop' },
    ]);

    const rateLimitedFetch = vi.fn(
      async () => new Response('Too Many Requests', { status: 429 }),
    ) as unknown as typeof fetch;
    const limitedAdapter = new ServerProxyAdapter({ fetchImpl: rateLimitedFetch });

    let capturedError: unknown;
    try {
      for await (const _chunk of limitedAdapter.streamChat({
        requestId: 'req-proxy-429',
        modelId: 'proxy:gemini-flash',
        messages: [{ role: 'user', content: 'Hello proxy' }],
        isIncognito: false,
      })) {
        // drain
      }
    } catch (err) {
      capturedError = err;
    }

    const normalized = normalizeProviderError(capturedError, {
      providerId: 'server-proxy',
      modelId: 'proxy:gemini-flash',
    });
    expect(normalized.code).toBe('RATE_LIMITED');
    expect(normalized.fallbackEligible).toBe(true);
  });
});
