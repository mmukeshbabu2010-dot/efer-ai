import type {
  FallbackConsentRequest,
  FallbackDecision,
  FallbackMode,
} from './types';

export type FallbackConsentPrompt = (
  request: FallbackConsentRequest,
  signal?: AbortSignal,
) => Promise<FallbackDecision>;

function canUseRememberedPermission(request: FallbackConsentRequest): boolean {
  return (
    request.fromModel.providerId === request.toModel.providerId &&
    request.fromModel.privacyTier === request.toModel.privacyTier
  );
}

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

    const canRemember = canUseRememberedPermission(request);
    if (this.mode === 'always-allow' && canRemember) {
      return 'allow-once';
    }

    if (!promptHandler) {
      return 'deny';
    }

    const decision = await promptHandler(request, signal);
    if (decision === 'always-allow' && canRemember) {
      this.mode = 'always-allow';
      return 'always-allow';
    }

    // A cross-provider or cross-privacy-boundary choice is valid only once.
    return decision === 'always-allow' ? 'allow-once' : decision;
  }
}
