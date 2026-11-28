import { describe, expect, it } from 'vitest';
import { NormalizedBrainError, normalizeProviderError } from '../../brain/errors';

describe('normalizeProviderError', () => {
  it('maps HTTP status codes and abort errors into safe NormalizedBrainError shapes', () => {
    const rateLimited = normalizeProviderError(
      { status: 429, message: '429 Too Many Requests with secret sk-12345' },
      { providerId: 'mock-demo', modelId: 'efer-demo-primary' },
    );
    expect(rateLimited).toBeInstanceOf(NormalizedBrainError);
    expect(rateLimited.code).toBe('RATE_LIMITED');
    expect(rateLimited.fallbackEligible).toBe(true);
    expect(rateLimited.retryable).toBe(true);
    expect(rateLimited.message).not.toContain('sk-12345');

    const timeout = normalizeProviderError({ status: 504, message: 'Gateway timeout' });
    expect(timeout.code).toBe('TIMEOUT');
    expect(timeout.fallbackEligible).toBe(true);

    const auth = normalizeProviderError({ status: 401, message: 'Invalid API key sk-secret' });
    expect(auth.code).toBe('AUTH_ERROR');
    expect(auth.fallbackEligible).toBe(true);
    expect(auth.message).not.toContain('sk-secret');

    const contextTooLong = normalizeProviderError({ status: 413, message: 'Maximum context length' });
    expect(contextTooLong.code).toBe('CONTEXT_TOO_LONG');
    expect(contextTooLong.fallbackEligible).toBe(false);

    const aborted = normalizeProviderError(new DOMException('Aborted', 'AbortError'));
    expect(aborted.code).toBe('ABORTED');
    expect(aborted.fallbackEligible).toBe(false);
    expect(aborted.retryable).toBe(false);
  });

  it('normalizes unknown errors safely without leaking raw error text', () => {
    const unknown = normalizeProviderError(new Error('Internal secret token leaked'));
    expect(unknown.code).toBe('UNKNOWN');
    expect(unknown.fallbackEligible).toBe(false);
    expect(unknown.message).not.toContain('Internal secret token');
  });
});
