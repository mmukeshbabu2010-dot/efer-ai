import { describe, expect, it, vi } from 'vitest';
import { FallbackCoordinator } from '../../brain/fallbackPolicy';
import type { FallbackConsentRequest, ModelDescriptor } from '../../brain/types';

function model(id: string, providerId: string, privacyTier: ModelDescriptor['privacyTier']): ModelDescriptor {
  return {
    id,
    providerId,
    displayName: id,
    shortDescription: '',
    capabilities: { chat: true, streaming: true, code: false, reasoning: false, vision: false, localExecution: false },
    contextWindowTokens: 4096,
    privacyTier,
    availability: 'active',
  };
}

function request(from: ModelDescriptor, to: ModelDescriptor, isIncognito = false): FallbackConsentRequest {
  return { requestId: 'fallback-test', fromModel: from, toModel: to, reason: 'test failure', errorCode: 'PROVIDER_UNAVAILABLE', isIncognito };
}

describe('FallbackCoordinator permission scope', () => {
  it('remembers permission only for the same provider and privacy tier', async () => {
    const coordinator = new FallbackCoordinator();
    const from = model('a', 'provider-a', 'local-device');
    const to = model('b', 'provider-a', 'local-device');
    const prompt = vi.fn().mockResolvedValue('always-allow');

    await expect(coordinator.resolveConsent(request(from, to), prompt)).resolves.toBe('always-allow');
    expect(coordinator.getMode()).toBe('always-allow');
    const secondPrompt = vi.fn();
    await expect(coordinator.resolveConsent(request(from, to), secondPrompt)).resolves.toBe('allow-once');
    expect(secondPrompt).not.toHaveBeenCalled();
  });

  it('requires fresh consent for a different provider even in Always Allow mode', async () => {
    const coordinator = new FallbackCoordinator('always-allow');
    const from = model('a', 'provider-a', 'local-device');
    const to = model('b', 'provider-b', 'local-device');
    const prompt = vi.fn().mockResolvedValue('allow-once');

    await expect(coordinator.resolveConsent(request(from, to), prompt)).resolves.toBe('allow-once');
    expect(prompt).toHaveBeenCalledTimes(1);
  });

  it('does not persist Always Allow across a privacy-boundary change', async () => {
    const coordinator = new FallbackCoordinator();
    const from = model('a', 'provider-a', 'local-device');
    const to = model('b', 'provider-a', 'remote-endpoint');
    const prompt = vi.fn().mockResolvedValue('always-allow');

    await expect(coordinator.resolveConsent(request(from, to), prompt)).resolves.toBe('allow-once');
    expect(coordinator.getMode()).toBe('ask-first');
  });

  it('does not auto-approve a cross-provider Incognito fallback', async () => {
    const coordinator = new FallbackCoordinator('always-allow');
    const from = model('a', 'provider-a', 'local-device');
    const to = model('b', 'provider-b', 'local-device');
    const prompt = vi.fn().mockResolvedValue('allow-once');

    await expect(coordinator.resolveConsent(request(from, to, true), prompt)).resolves.toBe('allow-once');
    expect(prompt).toHaveBeenCalledTimes(1);
  });
});
