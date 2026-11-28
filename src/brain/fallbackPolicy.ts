import type {
  FallbackConsentRequest,
  FallbackDecision,
  FallbackMode,
} from './types';

export type FallbackConsentPrompt = (
  request: FallbackConsentRequest,
  signal?: AbortSignal,
) => Promise<FallbackDecision>;

export class FallbackCoordinator {
  private mode: FallbackMode;

  constructor(initialMode: FallbackMode = 'ask-first') {
    this.mode = initialMode;
  }

  getMode(): FallbackMode {
    return this.mode;
  }

  setMode(mode: FallbackMode): void {
    this.mode = mode;
  }

  async resolveConsent(
    request: FallbackConsentRequest,
    promptHandler?: FallbackConsentPrompt,
    signal?: AbortSignal,
  ): Promise<FallbackDecision> {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    if (this.mode === 'always-allow') {
      return 'allow-once';
    }

    if (!promptHandler) {
      return 'deny';
    }

    const decision = await promptHandler(request, signal);
    if (decision === 'always-allow') {
      this.mode = 'always-allow';
    }
    return decision;
  }
}
