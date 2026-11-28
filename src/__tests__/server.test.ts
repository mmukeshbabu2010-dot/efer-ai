// @vitest-environment node
/// <reference types="node" />
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createProductionServer } from '../../server.js';

describe('production static & SPA server', () => {
  let tempDir: string;
  let distDir: string;
  let baseUrl: string;
  let server: ReturnType<typeof createProductionServer>;

  beforeAll(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'efer-server-test-'));
    distDir = path.join(tempDir, 'dist');
    await fs.mkdir(path.join(distDir, 'assets'), { recursive: true });
    await fs.writeFile(path.join(distDir, 'index.html'), '<!doctype html><html><body>EFER APP</body></html>');
    await fs.writeFile(path.join(distDir, 'assets', 'app.js'), 'console.log("efer");');

    server = createProductionServer(distDir);
    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('serves /health, index.html, static JS assets with proper MIME types, and SPA fallback', async () => {
    const healthRes = await fetch(`${baseUrl}/health`);
    expect(healthRes.status).toBe(200);
    expect(await healthRes.json()).toEqual({ status: 'ok', buildReady: true });

    const rootRes = await fetch(`${baseUrl}/`);
    expect(rootRes.status).toBe(200);
    expect(rootRes.headers.get('content-type')).toContain('text/html');
    expect(await rootRes.text()).toContain('EFER APP');

    const assetRes = await fetch(`${baseUrl}/assets/app.js`);
    expect(assetRes.status).toBe(200);
    expect(assetRes.headers.get('content-type')).toContain('application/javascript');
    expect(assetRes.headers.get('cache-control')).toContain('immutable');

    const spaRes = await fetch(`${baseUrl}/conversations/sample-route`);
    expect(spaRes.status).toBe(200);
    expect(spaRes.headers.get('content-type')).toContain('text/html');
    expect(await spaRes.text()).toContain('EFER APP');

    const missingAssetRes = await fetch(`${baseUrl}/assets/missing.js`);
    expect(missingAssetRes.status).toBe(404);
  });

  it('blocks path traversal and returns 503 when dist/index.html is missing', async () => {
    const traversalRes = await fetch(`${baseUrl}/%2e%2e/package.json`);
    expect([403, 404]).toContain(traversalRes.status);

    const emptyDist = path.join(tempDir, 'empty-dist');
    await fs.mkdir(emptyDist, { recursive: true });
    const unbuiltServer = createProductionServer(emptyDist);
    await new Promise<void>((resolve) => unbuiltServer.listen(0, '127.0.0.1', () => resolve()));
    const unbuiltAddr = unbuiltServer.address() as AddressInfo;

    try {
      const res = await fetch(`http://127.0.0.1:${unbuiltAddr.port}/`);
      expect(res.status).toBe(503);
      expect(await res.text()).toContain('npm run build');
    } finally {
      await new Promise<void>((resolve) => unbuiltServer.close(() => resolve()));
    }
  });

  it('reports /api/providers configuration booleans without leaking secret values', async () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    const prevGroq = process.env.GROQ_API_KEY;
    const prevOpenRouter = process.env.OPENROUTER_API_KEY;
    process.env.GEMINI_API_KEY = 'AIza-secret-should-never-appear-in-response';
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENROUTER_API_KEY;

    try {
      const res = await fetch(`${baseUrl}/api/providers`);
      expect(res.status).toBe(200);
      expect(res.headers.get('cache-control')).toBe('no-store');
      const rawText = await res.text();
      expect(rawText).not.toContain('AIza-secret-should-never-appear-in-response');
      const parsed = JSON.parse(rawText) as {
        configured: { gemini: boolean; groq: boolean; openrouter: boolean };
        note: string;
      };
      expect(parsed.configured).toEqual({
        gemini: true,
        groq: false,
        openrouter: false,
      });
      expect(parsed.note).toContain('server-side');
    } finally {
      if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevGemini;
      if (prevGroq === undefined) delete process.env.GROQ_API_KEY;
      else process.env.GROQ_API_KEY = prevGroq;
      if (prevOpenRouter === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = prevOpenRouter;
    }
  });

  it('validates POST /api/chat requests, returns 503 when env key is missing, and streams upstream Gemini SSE chunks', async () => {
    const prevGemini = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;

    try {
      const badBodyRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: 'invalid-model', messages: [] }),
      });
      expect(badBodyRes.status).toBe(400);

      const unconfiguredRes = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'proxy:gemini-flash',
          messages: [{ role: 'user', content: 'Hello proxy' }],
        }),
      });
      expect(unconfiguredRes.status).toBe(503);
      const errBody = (await unconfiguredRes.json()) as { error: string };
      expect(errBody.error).toContain('GEMINI_API_KEY');
    } finally {
      if (prevGemini === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevGemini;
    }

    // Mocked upstream SSE server test
    const fakeGeminiSse = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"from Gemini!"}]}}]}\n\n',
    ].join('');

    const mockFetch = async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new TextEncoder().encode(fakeGeminiSse));
            controller.close();
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream; charset=utf-8' },
        },
      );

    const prevKey = process.env.GEMINI_API_KEY;
    process.env.GEMINI_API_KEY = 'AIza-mock-server-key-not-leaked';
    const proxyServer = createProductionServer(distDir, {
      fetchImpl: mockFetch as typeof fetch,
    });
    await new Promise<void>((resolve) => {
      proxyServer.listen(0, '127.0.0.1', () => resolve());
    });
    const proxyAddr = proxyServer.address() as AddressInfo;

    try {
      const streamRes = await fetch(`http://127.0.0.1:${proxyAddr.port}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId: 'proxy:gemini-flash',
          messages: [
            { role: 'system', content: 'Be helpful.' },
            { role: 'user', content: 'Say hi' },
          ],
        }),
      });

      expect(streamRes.status).toBe(200);
      expect(streamRes.headers.get('content-type')).toContain('text/event-stream');
      const sseText = await streamRes.text();
      expect(sseText).toContain('"text":"Hello "');
      expect(sseText).toContain('"text":"from Gemini!"');
      expect(sseText).toContain('data: [DONE]');
      expect(sseText).not.toContain('AIza-mock-server-key-not-leaked');
    } finally {
      await new Promise<void>((resolve) => proxyServer.close(() => resolve()));
      if (prevKey === undefined) delete process.env.GEMINI_API_KEY;
      else process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
