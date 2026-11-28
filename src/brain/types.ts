export type BrainRole = 'system' | 'user' | 'assistant';

export interface BrainMessage {
  role: BrainRole;
  content: string;
}

export type ModelPrivacyTier =
  | 'mock-local'
  | 'local-device'
  | 'server-proxy'
  | 'byok-browser';

export type ModelAvailability = 'active' | 'planned' | 'disabled';

export interface ModelCapabilities {
  chat: boolean;
  streaming: boolean;
  code: boolean;
  reasoning: boolean;
  vision: boolean;
  localExecution: boolean;
}

export interface ModelDescriptor {
  id: string;
  providerId: string;
  displayName: string;
  shortDescription: string;
  capabilities: ModelCapabilities;
  contextWindowTokens: number;
  privacyTier: ModelPrivacyTier;
  availability: ModelAvailability;
  isDefault?: boolean;
}

export type BrainErrorCode =
  | 'OFFLINE'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'AUTH_ERROR'
  | 'CONTEXT_TOO_LONG'
  | 'PROVIDER_UNAVAILABLE'
  | 'MODEL_UNSUPPORTED'
  | 'ABORTED'
  | 'UNKNOWN';

export interface NormalizedBrainErrorShape {
  code: BrainErrorCode;
  message: string;
  providerId?: string;
  modelId?: string;
  retryable: boolean;
  fallbackEligible: boolean;
}

export type BrainFinishReason = 'stop' | 'length' | 'aborted' | 'error';

export interface BrainRequest {
  requestId: string;
  modelId: string;
  messages: BrainMessage[];
  isIncognito: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  signal?: AbortSignal;
}

export type ProviderRawChunk =
  | { type: 'delta'; text: string }
  | { type: 'done'; finishReason: BrainFinishReason };

export interface ProviderHealthStatus {
  providerId: string;
  healthy: boolean;
  detail: string;
}

export type FallbackMode = 'ask-first' | 'always-allow';

export type FallbackDecision = 'allow-once' | 'always-allow' | 'deny';

export interface FallbackConsentRequest {
  requestId: string;
  fromModel: ModelDescriptor;
  toModel: ModelDescriptor;
  reason: string;
  errorCode: BrainErrorCode;
}

export type BrainTraceStage =
  | 'intent'
  | 'context'
  | 'route'
  | 'fallback'
  | 'stream'
  | 'complete'
  | 'error';

export interface BrainTraceStep {
  timestamp: string;
  stage: BrainTraceStage;
  detail: string;
}

export interface BrainMetadata {
  requestId: string;
  providerId: string;
  modelId: string;
  intent: 'general' | 'code' | 'reasoning' | 'writing';
  latencyMs: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  finishReason: BrainFinishReason;
  isMockDemo: boolean;
}

export type BrainStreamEvent =
  | {
      type: 'start';
      requestId: string;
      modelId: string;
      providerId: string;
    }
  | {
      type: 'delta';
      requestId: string;
      text: string;
    }
  | {
      type: 'fallback-pending';
      requestId: string;
      consentRequest: FallbackConsentRequest;
    }
  | {
      type: 'fallback-switched';
      requestId: string;
      fromModelId: string;
      toModelId: string;
      reason: string;
    }
  | {
      type: 'trace';
      requestId: string;
      step: BrainTraceStep;
    }
  | {
      type: 'complete';
      requestId: string;
      fullText: string;
      metadata: BrainMetadata;
    }
  | {
      type: 'error';
      requestId: string;
      error: NormalizedBrainErrorShape;
    };
