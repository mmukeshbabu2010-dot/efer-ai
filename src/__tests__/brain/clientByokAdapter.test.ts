import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BYOK_STORAGE_KEY,
  ClientByokAdapter,
  loadByokProvidersFromStorage,
  maskApiKey,
  normalizeByokBaseUrl,
  saveByokProvidersToStorage,
  toByokRegistryModelId,
  type ByokProviderConfig,
} from '../../brain/adapters/ClientByokAdapter';
import { AdapterRegistry } from '../../brain/adapters/ProviderAdapter';
import { MockDemoAdapter } from '../../brain/adapters/MockDemoAdapter';
import { EferBrain } from '../../brain/eferBrain';
import { FallbackCoordinator } from '../../brain/fallbackPolicy';
import { ModelRegistry } from '../../brain/modelRegistry';
import type { BrainStreamEvent } from '../../brain/types';

function createSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

function makeSampleConfig(
  overrides: Partial<ByokProviderConfig> = {},
): ByokProviderConfig {
  return {
    id: 'groq-1',
    presetId: 'groq',
    displayName: 'My Groq Key',
    baseUrl: 'https://api.groq.com/openai/v1',
    modelId: 'llama-3.3-70b-versatile',
    apiKey: 'gsk_secret_key_89a2',
    capabilities: ['chat', 'code', 'think'],
    enabled: true,
    createdAt: '2026-11-28T00:00:00.000Z',
    updatedAt: '2026-11-28T00:00:00.000Z',
    ...overrides,
  };
}

describe('ClientByokAdapter', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('masks keys safely, validates BYOK URLs, and persists configs in localStorage', () => {
    expect(maskApiKey('gsk_secret_key_89a2')).toBe('••••89a2');
    expect(maskApiKey('abc')).toBe('••••');

    expect(() => normalizeByokBaseUrl('ftp://example.com')).toThrow(/http: or https:/i);
    expect(() => normalizeByokBaseUrl('https://user:pass@example.com/v1')).toThrow(
      /credentials/i,
    );
    expect(() => normalizeByokBaseUrl('http://169.254.169.254/latest')).toThrow(
      /metadata/i,
    );

    const activeItem = makeSampleConfig();
    const disabledItem = makeSampleConfig({
      id: 'disabled-1',
      displayName: 'Disabled Key',
      enabled: false,
    });
    saveByokProvidersToStorage([activeItem, disabledItem]);

    const loaded = loadByokProvidersFromStorage();
    expect(loaded).toHaveLength(2);
    expect(localStorage.getItem(BYOK_STORAGE_KEY)).toContain('My Groq Key');
  });

  it('dynamically registers enabled BYOK providers into ModelRegistry with selected capability tags', () => {
    const enabledConfig = makeSampleConfig({
      id: 'fal-1',
      presetId: 'fal',
      displayName: 'Fal Multimodal',
      baseUrl: 'https://api.fal.ai/v1',
      modelId: 'fal-ai/any-llm',
      capabilities: ['chat', 'image', 'video', 'audio'],
      enabled: true,
    });
    const disabledConfig = makeSampleConfig({
      id: 'off-1',
      displayName: 'Paused Provider',
      enabled: false,
    });
    saveByokProvidersToStorage([enabledConfig, disabledConfig]);

    const adapter = new ClientByokAdapter();
    const registry = new ModelRegistry();
    adapter.syncModelsToRegistry(registry);

    const registeredId = toByokRegistryModelId('fal-1');
    const descriptor = registry.getModel(registeredId);
    expect(descriptor).toBeDefined();
    expect(descriptor?.providerId).toBe('client-byok');
    expect(descriptor?.privacyTier).toBe('byok-browser');
    expect(descriptor?.availability).toBe('active');
    expect(descriptor?.capabilities).toMatchObject({
      chat: true,
      code: false,
      reasoning: false,
      vision: true,
      image: true,
      video: true,
      audio: true,
      localExecution: false,
    });

    expect(registry.getModel(toByokRegistryModelId('off-1'))).toBeUndefined();
    expect(adapter.supportsModel(registeredId)).toBe(true);
    expect(adapter.supportsModel(toByokRegistryModelId('off-1'))).toBe(false);
  });

  it('streams OpenAI-compatible SSE chunks and sends Bearer auth directly to provider URL', async () => {
    const config = makeSampleConfig();
    saveByokProvidersToStorage([config]);

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        createSseStream([
          'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
          'data: {"choices":[{"delta":{"content":"from Groq!"},"finish_reason":"stop"}]}\n\n',
          'data: [DONE]\n\n',
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      ),
    );

    const adapter = new ClientByokAdapter({ fetchImpl: mockFetch });
    const chunks: string[] = [];
    let finishReason: string | undefined;

    for await (const chunk of adapter.streamChat({
      requestId: 'req-1',
      modelId: toByokRegistryModelId(config.id),
      isIncognito: false,
      messages: [{ role: 'user', content: 'Say hello' }],
    })) {
      if (chunk.type === 'delta') chunks.push(chunk.text);
      if (chunk.type === 'done') finishReason = chunk.finishReason;
    }

    expect(chunks.join('')).toBe('Hello from Groq!');
    expect(finishReason).toBe('stop');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(url).not.toContain('/api/chat');
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      `Bearer ${config.apiKey}`,
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      model: 'llama-3.3-70b-versatile',
      stream: true,
    });
  });

  it('streams Google Gemini REST SSE responses and maps system/assistant roles cleanly', async () => {
    const geminiConfig = makeSampleConfig({
      id: 'gem-1',
      presetId: 'gemini',
      displayName: 'My Gemini Key',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      modelId: 'gemini-2.5-flash',
      apiKey: 'AIza_test_browser_key_1234',
      capabilities: ['chat', 'think', 'image'],
    });
    saveByokProvidersToStorage([geminiConfig]);

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        createSseStream([
          'data: {"candidates":[{"content":{"parts":[{"text":"Gemini "}]}}]}\n\n',
          'data: {"candidates":[{"content":{"parts":[{"text":"streaming works."}]},"finishReason":"STOP"}]}\n\n',
        ]),
        {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        },
      ),
    );

    const adapter = new ClientByokAdapter({ fetchImpl: mockFetch });
    const chunks: string[] = [];

    for await (const chunk of adapter.streamChat({
      requestId: 'req-gem',
      modelId: toByokRegistryModelId(geminiConfig.id),
      isIncognito: false,
      messages: [
        { role: 'system', content: 'Be concise.' },
        { role: 'user', content: 'Hi' },
        { role: 'assistant', content: 'Hello!' },
        { role: 'user', content: 'Status?' },
      ],
    })) {
      if (chunk.type === 'delta') chunks.push(chunk.text);
    }

    expect(chunks.join('')).toBe('Gemini streaming works.');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse',
    );
    expect((init?.headers as Record<string, string>)['x-goog-api-key']).toBe(
      geminiConfig.apiKey,
    );
    expect(JSON.parse(String(init?.body))).toMatchObject({
      systemInstruction: { parts: [{ text: 'Be concise.' }] },
      contents: [
        { role: 'user', parts: [{ text: 'Hi' }] },
        { role: 'model', parts: [{ text: 'Hello!' }] },
        { role: 'user', parts: [{ text: 'Status?' }] },
      ],
    });
  });

  it('normalizes 429/401 errors via EferBrain and triggers Fallback Permission consent prompt', async () => {
    const config = makeSampleConfig();
    saveByokProvidersToStorage([config]);

    const mockFetch = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const adapters = new AdapterRegistry();
    const models = new ModelRegistry();
    const byokAdapter = new ClientByokAdapter({ fetchImpl: mockFetch });
    adapters.register(new MockDemoAdapter({ chunkDelayMs: 0 }));
    adapters.register(byokAdapter);
    byokAdapter.syncModelsToRegistry(models);

    const brain = new EferBrain({
      adapterRegistry: adapters,
      modelRegistry: models,
      fallbackCoordinator: new FallbackCoordinator('ask-first'),
    });

    const events: BrainStreamEvent[] = [];
    const onFallbackConsent = vi.fn().mockResolvedValue('allow-once');

    for await (const event of brain.streamTurn({
      requestId: 'req-fallback-byok',
      modelId: toByokRegistryModelId(config.id),
      isIncognito: false,
      messages: [
        {
          id: 'm1',
          role: 'user',
          content: 'Explain closures briefly',
          timestamp: '10:00 AM',
        },
      ],
      onFallbackConsent,
    })) {
      events.push(event);
    }

    expect(onFallbackConsent).toHaveBeenCalledTimes(1);
    const consentArg = onFallbackConsent.mock.calls[0][0];
    expect(consentArg.errorCode).toBe('AUTH_ERROR');
    expect(consentArg.fromModel.id).toBe(toByokRegistryModelId(config.id));
    expect(events.some((e) => e.type === 'fallback-switched')).toBe(true);
    expect(events.some((e) => e.type === 'complete')).toBe(true);
  });

  it('runs minimal 1-token testConnection checks cleanly for OpenAI-compatible and Gemini', async () => {
    const mockFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: { message: 'Unauthorized' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    const adapter = new ClientByokAdapter({ fetchImpl: mockFetch });

    const okResult = await adapter.testConnection({
      presetId: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      modelId: 'gpt-4o-mini',
      apiKey: 'sk-test-1234',
    });
    expect(okResult.healthy).toBe(true);
    expect(okResult.detail).toContain('Connected to gpt-4o-mini');

    const failResult = await adapter.testConnection({
      presetId: 'gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      modelId: 'gemini-2.5-flash',
      apiKey: 'bad-key',
    });
    expect(failResult.healthy).toBe(false);
    expect(failResult.detail).toContain('HTTP 401');
    expect(failResult.detail).not.toContain('bad-key');
  });
});
