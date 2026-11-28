import type { ChatMessage } from '../types/workspace';
import { MockDemoAdapter } from './adapters/MockDemoAdapter';
import { OllamaAdapter } from './adapters/OllamaAdapter';
import { AdapterRegistry } from './adapters/ProviderAdapter';
import { ServerProxyAdapter } from './adapters/ServerProxyAdapter';
import { buildContextWindow, estimateTokenCount } from './contextManager';
import { NormalizedBrainError, normalizeProviderError } from './errors';
import {
  FallbackCoordinator,
  type FallbackConsentPrompt,
} from './fallbackPolicy';
import { classifyPromptIntent } from './intentClassifier';
import { ModelRegistry } from './modelRegistry';
import type {
  BrainFinishReason,
  BrainStreamEvent,
  BrainTraceStage,
  FallbackMode,
  MemoryItem,
  ModelCapabilities,
  ModelDescriptor,
} from './types';

export interface EferBrainOptions {
  adapterRegistry?: AdapterRegistry;
  modelRegistry?: ModelRegistry;
  fallbackCoordinator?: FallbackCoordinator;
}

export interface BrainTurnInput {
  requestId: string;
  modelId?: string;
  messages: ChatMessage[];
  isIncognito: boolean;
  requiredCapability?: keyof ModelCapabilities;
  capabilityMode?: string;
  memories?: MemoryItem[];
  rememberThisChat?: boolean;
  signal?: AbortSignal;
  onFallbackConsent?: FallbackConsentPrompt;
}

function makeTraceEvent(
  requestId: string,
  stage: BrainTraceStage,
  detail: string,
): BrainStreamEvent {
  return {
    type: 'trace',
    requestId,
    step: {
      timestamp: new Date().toISOString(),
      stage,
      detail,
    },
  };
}

export class EferBrain {
  readonly adapters: AdapterRegistry;
  readonly models: ModelRegistry;
  readonly fallback: FallbackCoordinator;

  constructor(options: EferBrainOptions = {}) {
    this.adapters = options.adapterRegistry ?? new AdapterRegistry();
    this.models = options.modelRegistry ?? new ModelRegistry();
    this.fallback = options.fallbackCoordinator ?? new FallbackCoordinator('ask-first');

    if (this.adapters.list().length === 0) {
      this.adapters.register(new MockDemoAdapter());
      this.adapters.register(new OllamaAdapter());
      this.adapters.register(new ServerProxyAdapter());
    }
  }

  getFallbackMode(): FallbackMode {
    return this.fallback.getMode();
  }

  setFallbackMode(mode: FallbackMode): void {
    this.fallback.setMode(mode);
  }

  listModels(): ModelDescriptor[] {
    return this.models.listModels();
  }

  listActiveModels(): ModelDescriptor[] {
    return this.models.listActiveModels();
  }

  async *streamTurn(input: BrainTurnInput): AsyncIterable<BrainStreamEvent> {
    const startedAt = Date.now();
    const lastUserMessage = [...input.messages]
      .reverse()
      .find((msg) => msg.role === 'user');
    const classification = classifyPromptIntent(lastUserMessage?.content ?? '');
    const effectiveCapability =
      input.requiredCapability ?? classification.requiredCapability;

    yield makeTraceEvent(
      input.requestId,
      'intent',
      `Classified intent as "${classification.intent}" (${classification.reason})`,
    );

    const primaryModel =
      (input.modelId ? this.models.getModel(input.modelId) : undefined) ??
      this.models.getDefaultModel();

    if (!primaryModel || primaryModel.availability !== 'active') {
      const err = new NormalizedBrainError({
        code: 'MODEL_UNSUPPORTED',
        message: 'Selected model is not active in the current phase.',
        modelId: input.modelId ?? primaryModel?.id,
        providerId: primaryModel?.providerId,
        retryable: false,
        fallbackEligible: false,
      });
      yield makeTraceEvent(input.requestId, 'error', err.message);
      yield { type: 'error', requestId: input.requestId, error: err.toShape() };
      return;
    }

    let currentModel: ModelDescriptor = primaryModel;
    let fallbackUsed = false;
    let fallbackReason: string | undefined;
    const triedModelIds = new Set<string>();

    while (true) {
      triedModelIds.add(currentModel.id);

      const adapter = this.adapters.resolveForModel(
        currentModel.providerId,
        currentModel.id,
      );

      if (!adapter) {
        const missingErr = new NormalizedBrainError({
          code: 'MODEL_UNSUPPORTED',
          message: `No provider adapter is registered for ${currentModel.displayName}.`,
          providerId: currentModel.providerId,
          modelId: currentModel.id,
          retryable: false,
          fallbackEligible: true,
        });

        const nextCandidate = this.models
          .getFallbackCandidates(currentModel.id, effectiveCapability)
          .find(
            (candidate) =>
              !triedModelIds.has(candidate.id) &&
              (!input.isIncognito || candidate.providerId === currentModel.providerId),
          );

        if (!nextCandidate) {
          yield makeTraceEvent(input.requestId, 'error', missingErr.message);
          yield {
            type: 'error',
            requestId: input.requestId,
            error: missingErr.toShape(),
          };
          return;
        }

        const consentReq = {
          requestId: input.requestId,
          fromModel: currentModel,
          toModel: nextCandidate,
          reason: missingErr.message,
          errorCode: missingErr.code,
          isIncognito: input.isIncognito,
        };
        yield makeTraceEvent(
          input.requestId,
          'fallback',
          `Requesting permission to switch from ${currentModel.displayName} to ${nextCandidate.displayName} (${missingErr.code}).`,
        );
        yield {
          type: 'fallback-pending',
          requestId: input.requestId,
          consentRequest: consentReq,
        };

        try {
          const decision = await this.fallback.resolveConsent(
            consentReq,
            input.onFallbackConsent,
            input.signal,
          );
          if (decision === 'deny') {
            yield makeTraceEvent(
              input.requestId,
              'error',
              `Fallback to ${nextCandidate.displayName} denied by user.`,
            );
            yield {
              type: 'error',
              requestId: input.requestId,
              error: missingErr.toShape(),
            };
            return;
          }
          fallbackUsed = true;
          fallbackReason = missingErr.message;
          yield makeTraceEvent(
            input.requestId,
            'fallback',
            `Fallback approved (${decision}); switching to ${nextCandidate.displayName}.`,
          );
          yield {
            type: 'fallback-switched',
            requestId: input.requestId,
            fromModelId: currentModel.id,
            toModelId: nextCandidate.id,
            reason: missingErr.message,
          };
          currentModel = nextCandidate;
          continue;
        } catch (consentErr) {
          const normalized = normalizeProviderError(consentErr, {
            providerId: currentModel.providerId,
            modelId: currentModel.id,
          });
          yield makeTraceEvent(input.requestId, 'error', normalized.message);
          yield {
            type: 'error',
            requestId: input.requestId,
            error: normalized.toShape(),
          };
          return;
        }
      }

      yield makeTraceEvent(
        input.requestId,
        'route',
        `Routed to ${currentModel.displayName} via adapter "${adapter.id}".`,
      );

      yield {
        type: 'start',
        requestId: input.requestId,
        modelId: currentModel.id,
        providerId: adapter.id,
      };

      const appliedMemories =
        !input.isIncognito &&
        input.rememberThisChat !== false &&
        Array.isArray(input.memories)
          ? input.memories
          : [];

      const contextMessages = buildContextWindow(input.messages, {
        contextWindowTokens: currentModel.contextWindowTokens,
        isIncognito: input.isIncognito,
        memories: appliedMemories,
        rememberThisChat: input.rememberThisChat,
        capabilityMode: input.capabilityMode,
      });
      const approxTokens = contextMessages.reduce(
        (sum, msg) => sum + estimateTokenCount(msg.content),
        0,
      );

      const memoryTraceLabel = input.isIncognito
        ? 'excluded (Incognito)'
        : input.rememberThisChat === false
          ? 'excluded (chat toggle off)'
          : `${appliedMemories.length} applied`;

      yield makeTraceEvent(
        input.requestId,
        'context',
        `Built context window (${contextMessages.length} message(s), ~${approxTokens} tokens, memories=${memoryTraceLabel}, privacy=${input.isIncognito ? 'incognito-ram' : 'workspace'}).`,
      );

      let fullText = '';
      let finishReason: BrainFinishReason = 'stop';

      try {
        yield makeTraceEvent(
          input.requestId,
          'stream',
          `Streaming response from ${currentModel.displayName}.`,
        );

        for await (const chunk of adapter.streamChat({
          requestId: input.requestId,
          modelId: currentModel.id,
          messages: contextMessages,
          isIncognito: input.isIncognito,
          signal: input.signal,
        })) {
          if (input.signal?.aborted) {
            throw new DOMException('The operation was aborted.', 'AbortError');
          }
          if (chunk.type === 'delta') {
            fullText += chunk.text;
            yield {
              type: 'delta',
              requestId: input.requestId,
              text: chunk.text,
            };
          } else if (chunk.type === 'done') {
            finishReason = chunk.finishReason;
          }
        }

        const latencyMs = Math.max(0, Date.now() - startedAt);
        yield makeTraceEvent(
          input.requestId,
          'complete',
          `Completed in ${latencyMs}ms (${fallbackUsed ? 'via fallback' : 'primary model'}).`,
        );

        yield {
          type: 'complete',
          requestId: input.requestId,
          fullText,
          metadata: {
            requestId: input.requestId,
            providerId: adapter.id,
            modelId: currentModel.id,
            intent: classification.intent,
            latencyMs,
            fallbackUsed,
            fallbackReason,
            finishReason,
            isMockDemo: Boolean(adapter.isMock),
          },
        };
        return;
      } catch (rawError) {
        const normalized = normalizeProviderError(rawError, {
          providerId: adapter.id,
          modelId: currentModel.id,
        });

        // Once answer text has reached the UI, restarting could duplicate or
        // contradict visible output. Stop and let the user explicitly retry.
        if (fullText.length > 0) {
          const partialOutputError = { ...normalized.toShape(), fallbackEligible: false };
          yield makeTraceEvent(
            input.requestId,
            'error',
            'Provider stopped after partial output; automatic fallback was withheld.',
          );
          yield { type: 'error', requestId: input.requestId, error: partialOutputError };
          return;
        }

        const nextCandidate = normalized.fallbackEligible
          ? this.models
              .getFallbackCandidates(currentModel.id, effectiveCapability)
              .find(
                (candidate) =>
                  !triedModelIds.has(candidate.id) &&
                  (!input.isIncognito || candidate.providerId === currentModel.providerId),
              ) ??
            this.models
              .getFallbackCandidates(currentModel.id)
              .find(
                (candidate) =>
                  !triedModelIds.has(candidate.id) &&
                  (!input.isIncognito || candidate.providerId === currentModel.providerId),
              )
          : undefined;

        if (!nextCandidate) {
          yield makeTraceEvent(
            input.requestId,
            'error',
            `${normalized.code}: ${normalized.message}`,
          );
          yield {
            type: 'error',
            requestId: input.requestId,
            error: normalized.toShape(),
          };
          return;
        }

        const consentReq = {
          requestId: input.requestId,
          fromModel: currentModel,
          toModel: nextCandidate,
          reason: normalized.message,
          errorCode: normalized.code,
          isIncognito: input.isIncognito,
        };

        yield makeTraceEvent(
          input.requestId,
          'fallback',
          `${normalized.code} on ${currentModel.displayName}; requesting consent for ${nextCandidate.displayName}.`,
        );
        yield {
          type: 'fallback-pending',
          requestId: input.requestId,
          consentRequest: consentReq,
        };

        try {
          const decision = await this.fallback.resolveConsent(
            consentReq,
            input.onFallbackConsent,
            input.signal,
          );
          if (decision === 'deny') {
            yield makeTraceEvent(
              input.requestId,
              'error',
              `Fallback to ${nextCandidate.displayName} denied by user.`,
            );
            yield {
              type: 'error',
              requestId: input.requestId,
              error: normalized.toShape(),
            };
            return;
          }

          fallbackUsed = true;
          fallbackReason = normalized.message;
          yield makeTraceEvent(
            input.requestId,
            'fallback',
            `Fallback approved (${decision}); switching to ${nextCandidate.displayName}.`,
          );
          yield {
            type: 'fallback-switched',
            requestId: input.requestId,
            fromModelId: currentModel.id,
            toModelId: nextCandidate.id,
            reason: normalized.message,
          };
          currentModel = nextCandidate;
        } catch (consentErr) {
          const consentNormalized = normalizeProviderError(consentErr, {
            providerId: adapter.id,
            modelId: currentModel.id,
          });
          yield makeTraceEvent(
            input.requestId,
            'error',
            `${consentNormalized.code}: ${consentNormalized.message}`,
          );
          yield {
            type: 'error',
            requestId: input.requestId,
            error: consentNormalized.toShape(),
          };
          return;
        }
      }
    }
  }
}

export function createDefaultEferBrain(): EferBrain {
  return new EferBrain();
}
