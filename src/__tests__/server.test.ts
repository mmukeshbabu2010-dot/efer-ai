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
        configured: { groq: boolean; openrouter: boolean };
        note: string;
      };
      expect(parsed.configured).toEqual({
        groq: false,
        openrouter: false,
      });
      expect(rawText).not.toContain('gemini');
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
});
