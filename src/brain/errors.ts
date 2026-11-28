import type { BrainErrorCode, NormalizedBrainErrorShape } from './types';

export interface ErrorNormalizationContext {
  providerId?: string;
  modelId?: string;
}

export class NormalizedBrainError extends Error implements NormalizedBrainErrorShape {
  readonly code: BrainErrorCode;
  readonly providerId?: string;
  readonly modelId?: string;
  readonly retryable: boolean;
  readonly fallbackEligible: boolean;

  constructor(shape: NormalizedBrainErrorShape) {
    super(shape.message);
    this.name = 'NormalizedBrainError';
    this.code = shape.code;
    this.providerId = shape.providerId;
    this.modelId = shape.modelId;
    this.retryable = shape.retryable;
    this.fallbackEligible = shape.fallbackEligible;
  }

  toShape(): NormalizedBrainErrorShape {
    return {
      code: this.code,
      message: this.message,
      providerId: this.providerId,
      modelId: this.modelId,
      retryable: this.retryable,
      fallbackEligible: this.fallbackEligible,
    };
  }
}

interface HttpLikeError {
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  name?: unknown;
  message?: unknown;
}

export function normalizeProviderError(
  error: unknown,
  context: ErrorNormalizationContext = {},
): NormalizedBrainError {
  if (error instanceof NormalizedBrainError) {
    return new NormalizedBrainError({
      ...error.toShape(),
      providerId: error.providerId ?? context.providerId,
      modelId: error.modelId ?? context.modelId,
    });
  }

  const candidate = (typeof error === 'object' && error !== null ? error : {}) as HttpLikeError;
  const rawName = typeof candidate.name === 'string' ? candidate.name : '';
  const rawCode = typeof candidate.code === 'string' ? candidate.code.toUpperCase() : '';
  const rawMessage =
    error instanceof Error
      ? error.message
      : typeof candidate.message === 'string'
        ? candidate.message
        : '';
  const lowerMessage = rawMessage.toLowerCase();
  const status =
    typeof candidate.status === 'number'
      ? candidate.status
      : typeof candidate.statusCode === 'number'
        ? candidate.statusCode
        : undefined;

  if (
    rawName === 'AbortError' ||
    rawCode === 'ABORT_ERR' ||
    rawCode === 'ABORTED' ||
    lowerMessage.includes('aborted') ||
    lowerMessage.includes('cancelled') ||
    lowerMessage.includes('canceled')
  ) {
    return new NormalizedBrainError({
      code: 'ABORTED',
      message: 'Generation was stopped before completion.',
      providerId: context.providerId,
      modelId: context.modelId,
      retryable: false,
      fallbackEligible: false,
    });
  }

  if (
    rawCode === 'OFFLINE' ||
    (typeof navigator !== 'undefined' && navigator.onLine === false && lowerMessage.includes('network')) ||
    lowerMessage.includes('offline')
  ) {
    return new NormalizedBrainError({
      code: 'OFFLINE',
      message: 'You appear to be offline, so remote providers cannot be reached.',
      providerId: context.providerId,
      modelId: context.modelId,
      retryable: true,
      fallbackEligible: true,
    });
  }

  if (
    status === 429 ||
    rawCode === 'RATE_LIMITED' ||
    lowerMessage.includes('rate limit') ||
    lowerMessage.includes('too many requests')
  ) {
    return new NormalizedBrainError({
      code: 'RATE_LIMITED',
      message: 'The active model reached its rate limit or quota.',
      providerId: context.providerId,
      modelId: context.modelId,
      retryable: true,
      fallbackEligible: true,
    });
  }

  if (
    status === 408 ||
    status === 504 ||
    rawCode === 'TIMEOUT' ||
    rawCode === 'ETIMEDOUT' ||
    lowerMessage.includes('timed out') ||
    lowerMessage.includes('timeout')
  ) {
    return new NormalizedBrainError({
      code: 'TIMEOUT',
      message: 'The model provider took too long to respond.',
      providerId: context.providerId,
      modelId: context.modelId,
      retryable: true,
      fallbackEligible: true,
    });
  }

  if (
    status === 401 ||
    status === 403 ||
    rawCode === 'AUTH_ERROR' ||
    lowerMessage.includes('unauthorized') ||
    lowerMessage.includes('invalid api key') ||
    lowerMessage.includes('authentication')
  ) {
    return new NormalizedBrainError({
      code: 'AUTH_ERROR',
      message: 'Provider credentials are missing, invalid, or rejected.',
      providerId: context.providerId,
      modelId: context.modelId,
      retryable: false,
      fallbackEligible: true,
    });
  }

  if (
    status === 413 ||
    rawCode === 'CONTEXT_TOO_LONG' ||
    lowerMessage.includes('context length') ||
    lowerMessage.includes('maximum context') ||
    lowerMessage.includes('token limit')
  ) {
    return new NormalizedBrainError({
      code: 'CONTEXT_TOO_LONG',
      message: 'The conversation exceeds the selected model context window.',
      providerId: context.providerId,
      modelId: context.modelId,
      retryable: false,
      fallbackEligible: false,
    });
  }

  if (rawCode === 'MODEL_UNSUPPORTED' || lowerMessage.includes('model unsupported')) {
    return new NormalizedBrainError({
      code: 'MODEL_UNSUPPORTED',
      message: 'The selected model is unavailable or not yet connected.',
      providerId: context.providerId,
      modelId: context.modelId,
      retryable: false,
      fallbackEligible: true,
    });
  }

  if (
    (status !== undefined && status >= 500) ||
    rawCode === 'PROVIDER_UNAVAILABLE' ||
    lowerMessage.includes('unavailable') ||
    lowerMessage.includes('service error') ||
    lowerMessage.includes('bad gateway')
  ) {
    return new NormalizedBrainError({
      code: 'PROVIDER_UNAVAILABLE',
      message: 'The model provider is temporarily unavailable.',
      providerId: context.providerId,
      modelId: context.modelId,
      retryable: true,
      fallbackEligible: true,
    });
  }

  return new NormalizedBrainError({
    code: 'UNKNOWN',
    message: 'The model request could not be completed due to an unexpected provider error.',
    providerId: context.providerId,
    modelId: context.modelId,
    retryable: true,
    fallbackEligible: false,
  });
}
