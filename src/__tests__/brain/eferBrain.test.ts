import { describe, expect, it, vi } from 'vitest';
import { MockDemoAdapter } from '../../brain/adapters/MockDemoAdapter';
import { AdapterRegistry } from '../../brain/adapters/ProviderAdapter';
import { EferBrain } from '../../brain/eferBrain';
import {
  DEFAULT_DEMO_FALLBACK_MODEL_ID,
  DEFAULT_DEMO_PRIMARY_MODEL_ID,
  ModelRegistry,
} from '../../brain/modelRegistry';
import type { BrainStreamEvent } from '../../brain/types';
import type { ChatMessage } from '../../types/workspace';

function createFastTestBrain(): EferBrain {
  const adapters = new AdapterRegistry();
  adapters.register(new MockDemoAdapter({ chunkDelayMs: 0 }));
  return new EferBrain({
    adapterRegistry: adapters,
    modelRegistry: new ModelRegistry(),
  });
}

function makeUserHistory(text: string): ChatMessage[] {
  return [{ id: 'u1', role: 'user', content: text, timestamp: '10:00 AM' }];
}

describe('EferBrain orchestrator', () => {
  it('streams chunks from MockDemoAdapter and completes with metadata', async () => {
    const brain = createFastTestBrain();
    const events: BrainStreamEvent[] = [];

    for await (const event of brain.streamTurn({
      requestId: 'req-1',
      modelId: DEFAULT_DEMO_PRIMARY_MODEL_ID,
      messages: makeUserHistory('Explain event-driven architecture'),
      isIncognito: false,
    })) {
      events.push(event);
    }

    const startEvent = events.find((e) => e.type === 'start');
    expect(startEvent).toMatchObject({
      type: 'start',
      modelId: DEFAULT_DEMO_PRIMARY_MODEL_ID,
      providerId: 'mock-demo',
    });
    const deltas = events.filter((e) => e.type === 'delta');
    expect(deltas.length).toBeGreaterThan(2);

    expect(
      events.some((e) => e.type === 'trace' && e.step.stage === 'intent'),
    ).toBe(true);
    expect(
      events.some((e) => e.type === 'trace' && e.step.stage === 'route'),
    ).toBe(true);
    expect(
      events.some((e) => e.type === 'trace' && e.step.stage === 'context'),
    ).toBe(true);

    const complete = events.find((e) => e.type === 'complete');
    expect(complete).toBeDefined();
    if (complete?.type === 'complete') {
      expect(complete.metadata.fallbackUsed).toBe(false);
      expect(complete.metadata.isMockDemo).toBe(true);
      expect(complete.metadata.intent).toBe('reasoning');
      expect(complete.fullText).toContain('EFER Demo · Balanced');
    }
  });

  it('requests fallback permission on eligible errors and honors Allow Once vs Deny vs Always Allow', async () => {
    const brain = createFastTestBrain();
    const askConsent = vi.fn().mockResolvedValueOnce('allow-once');

    const allowOnceEvents: BrainStreamEvent[] = [];
    for await (const event of brain.streamTurn({
      requestId: 'req-allow',
      modelId: DEFAULT_DEMO_PRIMARY_MODEL_ID,
      messages: makeUserHistory('Test [demo:rate-limit] fallback'),
      isIncognito: true,
      onFallbackConsent: askConsent,
    })) {
      allowOnceEvents.push(event);
    }

    expect(askConsent).toHaveBeenCalledTimes(1);
    expect(allowOnceEvents.some((e) => e.type === 'fallback-pending')).toBe(true);
    expect(
      allowOnceEvents.some(
        (e) =>
          e.type === 'fallback-switched' &&
          e.toModelId === DEFAULT_DEMO_FALLBACK_MODEL_ID,
      ),
    ).toBe(true);

    const complete = allowOnceEvents.find((e) => e.type === 'complete');
    expect(complete?.type === 'complete' && complete.metadata.fallbackUsed).toBe(true);
    expect(
      complete?.type === 'complete' && complete.fullText.includes('isolated Incognito session'),
    ).toBe(true);

    // Deny flow stops without switching
    const denyConsent = vi.fn().mockResolvedValueOnce('deny');
    const denyEvents: BrainStreamEvent[] = [];
    for await (const event of brain.streamTurn({
      requestId: 'req-deny',
      modelId: DEFAULT_DEMO_PRIMARY_MODEL_ID,
      messages: makeUserHistory('Test [demo:timeout] deny'),
      isIncognito: false,
      onFallbackConsent: denyConsent,
    })) {
      denyEvents.push(event);
    }

    expect(denyEvents.some((e) => e.type === 'fallback-switched')).toBe(false);
    const errEvent = denyEvents.find((e) => e.type === 'error');
    expect(errEvent?.type === 'error' && errEvent.error.code).toBe('TIMEOUT');

    // Always Allow updates coordinator mode and skips prompting next time
    const alwaysAllowConsent = vi.fn().mockResolvedValueOnce('always-allow');
    for await (const _event of brain.streamTurn({
      requestId: 'req-always-1',
      modelId: DEFAULT_DEMO_PRIMARY_MODEL_ID,
      messages: makeUserHistory('Test [demo:rate-limit] always'),
      isIncognito: false,
      onFallbackConsent: alwaysAllowConsent,
    })) {
      // drain
    }
    expect(brain.getFallbackMode()).toBe('always-allow');

    const shouldNotBeCalled = vi.fn();
    const autoEvents: BrainStreamEvent[] = [];
    for await (const event of brain.streamTurn({
      requestId: 'req-always-2',
      modelId: DEFAULT_DEMO_PRIMARY_MODEL_ID,
      messages: makeUserHistory('Test [demo:rate-limit] auto'),
      isIncognito: false,
      onFallbackConsent: shouldNotBeCalled,
    })) {
      autoEvents.push(event);
    }
    expect(shouldNotBeCalled).not.toHaveBeenCalled();
    expect(autoEvents.some((e) => e.type === 'fallback-switched')).toBe(true);
  });

  it('aborts streaming cleanly when AbortSignal fires', async () => {
    const adapters = new AdapterRegistry();
    adapters.register(new MockDemoAdapter({ chunkDelayMs: 15 }));
    const brain = new EferBrain({ adapterRegistry: adapters });
    const controller = new AbortController();

    const events: BrainStreamEvent[] = [];
    for await (const event of brain.streamTurn({
      requestId: 'req-abort',
      modelId: DEFAULT_DEMO_PRIMARY_MODEL_ID,
      messages: makeUserHistory('Stream something and cancel mid-flight'),
      isIncognito: false,
      signal: controller.signal,
    })) {
      events.push(event);
      if (event.type === 'delta') {
        controller.abort();
      }
    }

    const errEvent = events.find((e) => e.type === 'error');
    expect(errEvent?.type === 'error' && errEvent.error.code).toBe('ABORTED');
    expect(events.some((e) => e.type === 'complete')).toBe(false);
  });
});
