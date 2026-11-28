import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  isLocalOllamaEndpoint,
  normalizeOllamaBaseUrl,
  OllamaAdapter,
} from '../brain/adapters/OllamaAdapter';
import {
  ServerProxyAdapter,
  type ServerProxyStatus,
} from '../brain/adapters/ServerProxyAdapter';
import {
  createInitialConversations,
  EFER_CAPABILITIES,
  EFER_PLANNED_SECTIONS,
} from '../brain/capabilities';
import { createDefaultEferBrain, type EferBrain } from '../brain/eferBrain';
import {
  DEFAULT_DEMO_PRIMARY_MODEL_ID,
  DEFAULT_OLLAMA_MODEL_ID,
} from '../brain/modelRegistry';
import type {
  BrainTraceStep,
  FallbackConsentRequest,
  FallbackDecision,
  FallbackMode,
  ProviderHealthStatus,
} from '../brain/types';
import type {
  ActivityLogEntry,
  ActiveWorkspaceView,
  CapabilityId,
  ChatMessage,
  Conversation,
  MessageReaction,
  PendingFallbackConsent,
  PlannedSectionId,
  SendMessageResult,
  ThemeMode,
} from '../types/workspace';

function formatCurrentTime(): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

function buildConversationTitle(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'New conversation';
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

function createIncognitoSession(): Conversation {
  const timestamp = formatCurrentTime();
  return {
    id: `incognito-${Date.now()}`,
    title: 'Incognito Session',
    capabilityId: 'general-chat',
    messages: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    isIncognito: true,
  };
}

export interface WorkspaceStoreOptions {
  brain?: EferBrain;
}

/**
 * Phase 2 workspace store backed by EFER Brain.
 *
 * Persistence & Privacy boundary:
 * - No automatic localStorage/IndexedDB conversation persistence exists yet.
 * - Normal conversations and Incognito sessions are strictly separated in React state.
 * - Exiting Incognito aborts any active stream and wipes `incognitoConversation`
 *   from memory immediately so no chunks can leak back after exit.
 */
export function useWorkspaceStore(options: WorkspaceStoreOptions = {}) {
  const brainRef = useRef<EferBrain | null>(null);
  if (!brainRef.current) {
    brainRef.current = options.brain ?? createDefaultEferBrain();
  }
  const brain = brainRef.current;

  const [theme, setTheme] = useState<ThemeMode>('light');
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    createInitialConversations(),
  );
  const [activeConversationId, setActiveConversationId] = useState<string>('thread-new-1');
  const [incognitoConversation, setIncognitoConversation] = useState<Conversation | null>(null);
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>({ kind: 'chat' });

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const [composerText, setComposerText] = useState<string>('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null);
  const [composerFocusTick, setComposerFocusTick] = useState<number>(0);

  const [selectedModelId, setSelectedModelId] = useState<string>(
    () => brain.models.getDefaultModel()?.id ?? DEFAULT_DEMO_PRIMARY_MODEL_ID,
  );
  const [modelsVersion, setModelsVersion] = useState<number>(0);
  const [fallbackMode, setFallbackModeState] = useState<FallbackMode>(() =>
    brain.getFallbackMode(),
  );
  const [pendingFallback, setPendingFallback] = useState<PendingFallbackConsent | null>(null);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);

  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string>(() => {
    const adapter = brain.adapters.get('local-ollama');
    return adapter instanceof OllamaAdapter ? adapter.getBaseUrl() : 'http://localhost:11434';
  });
  const [ollamaModelName, setOllamaModelName] = useState<string>(() =>
    DEFAULT_OLLAMA_MODEL_ID.replace(/^ollama:/, ''),
  );
  const [ollamaConfigError, setOllamaConfigError] = useState<string | null>(null);
  const [ollamaHealth, setOllamaHealth] = useState<ProviderHealthStatus | null>(null);
  const [isCheckingOllama, setIsCheckingOllama] = useState<boolean>(false);

  const [serverProxyStatus, setServerProxyStatus] = useState<ServerProxyStatus | null>(null);
  const [isCheckingProxy, setIsCheckingProxy] = useState<boolean>(false);

  const isIncognito = incognitoConversation !== null;

  const submissionLockRef = useRef<boolean>(false);
  const composerTextRef = useRef<string>(composerText);
  const conversationsRef = useRef<Conversation[]>(conversations);
  const incognitoRef = useRef<Conversation | null>(incognitoConversation);
  const activeConversationIdRef = useRef<string>(activeConversationId);
  const selectedModelIdRef = useRef<string>(selectedModelId);
  const isIncognitoRef = useRef<boolean>(isIncognito);
  const isMountedRef = useRef<boolean>(true);
  const idSequenceRef = useRef<number>(0);
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const pendingFallbackResolverRef = useRef<((decision: FallbackDecision) => void) | null>(
    null,
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      activeAbortControllerRef.current?.abort();
      activeAbortControllerRef.current = null;
      pendingFallbackResolverRef.current = null;
    };
  }, []);

  useEffect(() => {
    composerTextRef.current = composerText;
  }, [composerText]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  useEffect(() => {
    incognitoRef.current = incognitoConversation;
  }, [incognitoConversation]);

  useEffect(() => {
    activeConversationIdRef.current = activeConversationId;
  }, [activeConversationId]);

  useEffect(() => {
    selectedModelIdRef.current = selectedModelId;
  }, [selectedModelId]);

  useEffect(() => {
    isIncognitoRef.current = isIncognito;
  }, [isIncognito]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const activeConversation = useMemo(() => {
    if (incognitoConversation) return incognitoConversation;
    return conversations.find((item) => item.id === activeConversationId) ?? null;
  }, [incognitoConversation, conversations, activeConversationId]);

  const availableModels = useMemo(() => {
    void modelsVersion;
    return brain.listModels();
  }, [brain, modelsVersion]);

  const activeCapability = useMemo(
    () =>
      EFER_CAPABILITIES.find(
        (cap) =>
          cap.id ===
          (activeView.kind === 'planned-capability'
            ? activeView.capabilityId
            : 'general-chat'),
      ) ?? EFER_CAPABILITIES[0],
    [activeView],
  );

  const activePlannedSection = useMemo(
    () =>
      activeView.kind === 'planned-section'
        ? EFER_PLANNED_SECTIONS.find((sec) => sec.id === activeView.sectionId) ?? null
        : null,
    [activeView],
  );

  const setFallbackMode = useCallback(
    (mode: FallbackMode) => {
      brain.setFallbackMode(mode);
      setFallbackModeState(mode);
    },
    [brain],
  );

  const selectModel = useCallback((modelId: string) => {
    selectedModelIdRef.current = modelId;
    setSelectedModelId(modelId);
  }, []);

  const setProviderEnabled = useCallback(
    (providerId: 'mock-demo' | 'local-ollama' | 'server-proxy', enabled: boolean) => {
      brain.models.setProviderAvailability(providerId, enabled ? 'active' : 'disabled');
      setModelsVersion((prev) => prev + 1);

      const currentModel = brain.models.getModel(selectedModelIdRef.current);
      if (!currentModel || currentModel.availability !== 'active') {
        const nextDefault = brain.models.getDefaultModel()?.id ?? DEFAULT_DEMO_PRIMARY_MODEL_ID;
        selectedModelIdRef.current = nextDefault;
        setSelectedModelId(nextDefault);
      }
    },
    [brain],
  );

  const updateOllamaConfig = useCallback(
    (rawBaseUrl: string, rawModelName: string): { ok: boolean; error?: string } => {
      let normalizedUrl: string;
      try {
        normalizedUrl = normalizeOllamaBaseUrl(rawBaseUrl);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Please enter a valid http:// or https:// Ollama endpoint URL.';
        setOllamaConfigError(message);
        return { ok: false, error: message };
      }

      const cleanModelName = rawModelName.trim().replace(/^ollama:/i, '');
      if (!cleanModelName) {
        const message = 'Please specify a local Ollama model name (for example: llama3.2).';
        setOllamaConfigError(message);
        return { ok: false, error: message };
      }

      const adapter = brain.adapters.get('local-ollama');
      if (adapter instanceof OllamaAdapter) {
        adapter.setBaseUrl(normalizedUrl);
      }

      const existingOllamaModels = brain.models
        .listModels()
        .filter((model) => model.providerId === 'local-ollama');
      const currentAvailability =
        existingOllamaModels[0]?.availability === 'active' ? 'active' : 'disabled';
      const nextModelId = `ollama:${cleanModelName}`;
      const wasSelected = existingOllamaModels.some(
        (model) => model.id === selectedModelIdRef.current,
      );

      for (const existing of existingOllamaModels) {
        if (existing.id !== nextModelId) {
          brain.models.removeModel(existing.id);
        }
      }

      brain.models.upsertModel({
        id: nextModelId,
        providerId: 'local-ollama',
        displayName: `Ollama · ${cleanModelName}`,
        shortDescription: `Local Ollama runtime at ${normalizedUrl}.`,
        capabilities: {
          chat: true,
          streaming: true,
          code: true,
          reasoning: true,
          vision: false,
          localExecution: true,
        },
        contextWindowTokens: 8192,
        privacyTier: isLocalOllamaEndpoint(normalizedUrl) ? 'local-device' : 'remote-endpoint',
        availability: currentAvailability,
      });

      if (wasSelected) {
        selectedModelIdRef.current = nextModelId;
        setSelectedModelId(nextModelId);
      }

      setOllamaBaseUrl(normalizedUrl);
      setOllamaModelName(cleanModelName);
      setOllamaConfigError(null);
      setOllamaHealth(null);
      setModelsVersion((prev) => prev + 1);
      return { ok: true };
    },
    [brain],
  );

  const testOllamaConnection = useCallback(async (): Promise<ProviderHealthStatus> => {
    setIsCheckingOllama(true);
    try {
      const adapter = brain.adapters.get('local-ollama');
      if (!(adapter instanceof OllamaAdapter)) {
        const status: ProviderHealthStatus = {
          providerId: 'local-ollama',
          healthy: false,
          detail: 'Local Ollama adapter is not registered.',
        };
        if (isMountedRef.current) setOllamaHealth(status);
        return status;
      }
      const status = await adapter.checkHealth();
      if (isMountedRef.current) setOllamaHealth(status);
      return status;
    } finally {
      if (isMountedRef.current) setIsCheckingOllama(false);
    }
  }, [brain]);

  const checkServerProxy = useCallback(async (): Promise<ServerProxyStatus> => {
    setIsCheckingProxy(true);
    try {
      const adapter = brain.adapters.get('server-proxy');
      if (!(adapter instanceof ServerProxyAdapter)) {
        const status: ServerProxyStatus = {
          reachable: false,
          configured: { groq: false, openrouter: false },
          detail: 'Server Proxy adapter is not registered.',
        };
        if (isMountedRef.current) setServerProxyStatus(status);
        return status;
      }
      const status = await adapter.inspectProxyProviders();
      if (isMountedRef.current) setServerProxyStatus(status);
      return status;
    } finally {
      if (isMountedRef.current) setIsCheckingProxy(false);
    }
  }, [brain]);

  const stopGeneration = useCallback(() => {
    activeAbortControllerRef.current?.abort();
    activeAbortControllerRef.current = null;
    pendingFallbackResolverRef.current = null;
    setPendingFallback(null);
  }, []);

  const resolveFallbackConsent = useCallback(
    (decision: FallbackDecision) => {
      const canRememberPermission =
        pendingFallback !== null &&
        !pendingFallback.isIncognito &&
        pendingFallback.fromProviderId === pendingFallback.toProviderId &&
        pendingFallback.fromPrivacyTier === pendingFallback.toPrivacyTier;
      if (decision === 'always-allow' && canRememberPermission) {
        brain.setFallbackMode('always-allow');
        setFallbackModeState('always-allow');
      }
      const resolver = pendingFallbackResolverRef.current;
      pendingFallbackResolverRef.current = null;
      setPendingFallback(null);
      resolver?.(decision);
    },
    [brain, pendingFallback],
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const enterIncognito = useCallback(() => {
    stopGeneration();
    const freshIncognito = createIncognitoSession();
    incognitoRef.current = freshIncognito;
    setIncognitoConversation(freshIncognito);
    composerTextRef.current = '';
    setComposerText('');
    setComposerError(null);
    setSelectedStarterId(null);
    setWorkspaceNotice(null);
    setActiveView({ kind: 'chat' });
    setIsMobileDrawerOpen(false);
  }, [stopGeneration]);

  const exitIncognito = useCallback(() => {
    stopGeneration();
    incognitoRef.current = null;
    setIncognitoConversation(null);
    composerTextRef.current = '';
    setComposerText('');
    setComposerError(null);
    setSelectedStarterId(null);
    setWorkspaceNotice(
      'Exited Incognito mode. Temporary session messages were cleared from app memory.',
    );
    setActiveView({ kind: 'chat' });
    setIsMobileDrawerOpen(false);
  }, [stopGeneration]);

  const toggleIncognito = useCallback(() => {
    if (isIncognitoRef.current) {
      exitIncognito();
    } else {
      enterIncognito();
    }
  }, [enterIncognito, exitIncognito]);

  const createNewThread = useCallback(() => {
    stopGeneration();
    if (isIncognitoRef.current) {
      const freshIncognito = createIncognitoSession();
      incognitoRef.current = freshIncognito;
      setIncognitoConversation(freshIncognito);
      composerTextRef.current = '';
      setComposerText('');
      setComposerError(null);
      setWorkspaceNotice(null);
      setSelectedStarterId(null);
      setActiveView({ kind: 'chat' });
      setIsMobileDrawerOpen(false);
      return;
    }

    const timestamp = formatCurrentTime();
    idSequenceRef.current += 1;
    const newId = `thread-${Date.now()}-${idSequenceRef.current}`;
    const nextConversation: Conversation = {
      id: newId,
      title: 'New conversation',
      capabilityId: 'general-chat',
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setConversations((prev) => [nextConversation, ...prev]);
    setActiveConversationId(newId);
    setActiveView({ kind: 'chat' });
    setComposerError(null);
    setWorkspaceNotice(null);
    setSelectedStarterId(null);
    setIsMobileDrawerOpen(false);
  }, [stopGeneration]);

  const selectThread = useCallback(
    (threadId: string) => {
      stopGeneration();
      if (isIncognitoRef.current) {
        incognitoRef.current = null;
        setIncognitoConversation(null);
        composerTextRef.current = '';
        setComposerText('');
      }
      setActiveConversationId(threadId);
      setActiveView({ kind: 'chat' });
      setComposerError(null);
      setWorkspaceNotice(null);
      setIsMobileDrawerOpen(false);
    },
    [stopGeneration],
  );

  const deleteThread = useCallback(
    (threadId: string) => {
      if (threadId === activeConversationIdRef.current) {
        stopGeneration();
      }
      setConversations((prev) => {
        const remaining = prev.filter((item) => item.id !== threadId);
        if (activeConversationId === threadId) {
          if (remaining.length > 0) {
            setActiveConversationId(remaining[0].id);
          } else {
            const timestamp = formatCurrentTime();
            idSequenceRef.current += 1;
            const fallbackId = `thread-${Date.now()}-${idSequenceRef.current}`;
            const fresh: Conversation = {
              id: fallbackId,
              title: 'New conversation',
              capabilityId: 'general-chat',
              messages: [],
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            setActiveConversationId(fallbackId);
            return [fresh];
          }
        }
        return remaining;
      });
    },
    [activeConversationId, stopGeneration],
  );

  const selectCapability = useCallback((capabilityId: CapabilityId) => {
    if (capabilityId === 'general-chat') {
      setActiveView({ kind: 'chat' });
    } else {
      setActiveView({ kind: 'planned-capability', capabilityId });
    }
    setIsMobileDrawerOpen(false);
  }, []);

  const selectPlannedSection = useCallback((sectionId: PlannedSectionId) => {
    if (sectionId === 'activity') {
      setActiveView({ kind: 'activity' });
    } else if (sectionId === 'settings') {
      setActiveView({ kind: 'settings' });
    } else {
      setActiveView({ kind: 'planned-section', sectionId });
    }
    setIsMobileDrawerOpen(false);
  }, []);

  const clearActivityLogs = useCallback(() => {
    setActivityLogs([]);
  }, []);

  const populateStarterPrompt = useCallback((starterId: string, prompt: string) => {
    setSelectedStarterId(starterId);
    composerTextRef.current = prompt;
    setComposerText(prompt);
    setComposerError(null);
    setActiveView({ kind: 'chat' });
    setComposerFocusTick((tick) => tick + 1);
  }, []);

  const clearAndFocusComposer = useCallback(() => {
    composerTextRef.current = '';
    setComposerText('');
    setComposerError(null);
    setSelectedStarterId(null);
    setActiveView({ kind: 'chat' });
    setIsMobileDrawerOpen(false);
    setComposerFocusTick((tick) => tick + 1);
  }, []);

  const updateComposerText = useCallback(
    (value: string) => {
      composerTextRef.current = value;
      setComposerText(value);
      if (composerError && value.trim().length > 0) {
        setComposerError(null);
      }
    },
    [composerError],
  );

  const runBrainStream = useCallback(
    async (params: {
      requestId: string;
      inIncognito: boolean;
      targetIncognitoId: string | null;
      targetConversationId: string;
      assistantMessageId: string;
      contextMessages: ChatMessage[];
    }): Promise<SendMessageResult> => {
      const {
        requestId,
        inIncognito,
        targetIncognitoId,
        targetConversationId,
        assistantMessageId,
        contextMessages,
      } = params;

      const controller = new AbortController();
      activeAbortControllerRef.current = controller;

      const patchTargetMessage = (
        updater: (msg: ChatMessage) => ChatMessage,
      ) => {
        if (inIncognito) {
          setIncognitoConversation((prev) => {
            if (!prev || prev.id !== targetIncognitoId) return prev;
            return {
              ...prev,
              updatedAt: formatCurrentTime(),
              messages: prev.messages.map((m) =>
                m.id === assistantMessageId ? updater(m) : m,
              ),
            };
          });
          return;
        }

        setConversations((prev) =>
          prev.map((thread) => {
            if (thread.id !== targetConversationId) return thread;
            return {
              ...thread,
              updatedAt: formatCurrentTime(),
              messages: thread.messages.map((m) =>
                m.id === assistantMessageId ? updater(m) : m,
              ),
            };
          }),
        );
      };

      const requestConsentFromUi = (
        consentRequest: FallbackConsentRequest,
        signal?: AbortSignal,
      ): Promise<FallbackDecision> => {
        if (signal?.aborted) {
          return Promise.reject(new DOMException('The operation was aborted.', 'AbortError'));
        }
        return new Promise<FallbackDecision>((resolve, reject) => {
          const onAbort = () => {
            pendingFallbackResolverRef.current = null;
            if (isMountedRef.current) {
              setPendingFallback(null);
            }
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          };

          signal?.addEventListener('abort', onAbort, { once: true });

          pendingFallbackResolverRef.current = (decision) => {
            signal?.removeEventListener('abort', onAbort);
            resolve(decision);
          };

          if (isMountedRef.current) {
            setPendingFallback({
              requestId: consentRequest.requestId,
              fromModelName: consentRequest.fromModel.displayName,
              toModelName: consentRequest.toModel.displayName,
              fromProviderId: consentRequest.fromModel.providerId,
              toProviderId: consentRequest.toModel.providerId,
              fromPrivacyTier: consentRequest.fromModel.privacyTier,
              toPrivacyTier: consentRequest.toModel.privacyTier,
              isIncognito: consentRequest.isIncognito,
              reason: consentRequest.reason,
              errorCode: consentRequest.errorCode,
            });
          }
        });
      };

      let streamedText = '';
      const traceSteps: BrainTraceStep[] = [];
      let currentIntent: ActivityLogEntry['intent'] = 'general';
      let activeModelIdUsed = selectedModelIdRef.current;
      let activeProviderUsed = 'mock-demo';
      let fallbackWasUsed = false;
      let capturedFallbackReason: string | undefined;
      const runStartedAt = Date.now();

      const recordActivity = (entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) => {
        if (inIncognito || !isMountedRef.current) return;
        const fullEntry: ActivityLogEntry = {
          ...entry,
          id: `activity-${entry.requestId}`,
          timestamp: formatCurrentTime(),
        };
        setActivityLogs((prev) => [fullEntry, ...prev].slice(0, 100));
      };

      try {
        for await (const event of brain.streamTurn({
          requestId,
          modelId: selectedModelIdRef.current,
          messages: contextMessages,
          isIncognito: inIncognito,
          signal: controller.signal,
          onFallbackConsent: requestConsentFromUi,
        })) {
          if (event.type === 'trace') {
            if (!inIncognito) {
              traceSteps.push(event.step);
              if (event.step.stage === 'intent') {
                const match = /"([^"]+)"/.exec(event.step.detail);
                if (
                  match &&
                  (match[1] === 'general' ||
                    match[1] === 'code' ||
                    match[1] === 'reasoning' ||
                    match[1] === 'writing')
                ) {
                  currentIntent = match[1];
                }
              }
            }
          } else if (event.type === 'start') {
            activeModelIdUsed = event.modelId;
            activeProviderUsed = event.providerId;
            const activeModel = brain.models.getModel(event.modelId);
            patchTargetMessage((msg) => ({
              ...msg,
              modelId: event.modelId,
              modelName: activeModel?.displayName ?? event.modelId,
              providerId: event.providerId,
            }));
          } else if (event.type === 'delta') {
            streamedText += event.text;
            const snapshot = streamedText;
            patchTargetMessage((msg) => ({
              ...msg,
              content: snapshot,
              status: 'streaming',
            }));
          } else if (event.type === 'fallback-switched') {
            streamedText = '';
            activeModelIdUsed = event.toModelId;
            fallbackWasUsed = true;
            capturedFallbackReason = event.reason;
            const nextModel = brain.models.getModel(event.toModelId);
            patchTargetMessage((msg) => ({
              ...msg,
              content: '',
              modelId: event.toModelId,
              modelName: nextModel?.displayName ?? event.toModelId,
              isFallback: true,
              fallbackReason: event.reason,
              status: 'streaming',
            }));
          } else if (event.type === 'complete') {
            const finalModel = brain.models.getModel(event.metadata.modelId);
            const finalModelName = finalModel?.displayName ?? event.metadata.modelId;
            patchTargetMessage((msg) => ({
              ...msg,
              content: event.fullText,
              status: 'complete',
              modelId: event.metadata.modelId,
              modelName: finalModelName,
              providerId: event.metadata.providerId,
              isFallback: event.metadata.fallbackUsed,
              fallbackReason: event.metadata.fallbackReason,
              latencyMs: event.metadata.latencyMs,
            }));
            recordActivity({
              requestId,
              intent: event.metadata.intent,
              modelId: event.metadata.modelId,
              modelName: finalModelName,
              providerId: event.metadata.providerId,
              outcome: event.metadata.fallbackUsed ? 'fallback' : 'success',
              latencyMs: event.metadata.latencyMs,
              fallbackUsed: event.metadata.fallbackUsed,
              fallbackReason: event.metadata.fallbackReason,
              steps: traceSteps,
            });
            return { ok: true };
          } else if (event.type === 'error') {
            const isAborted = event.error.code === 'ABORTED';
            const errModelId = event.error.modelId ?? activeModelIdUsed;
            const errModel = brain.models.getModel(errModelId);
            patchTargetMessage((msg) => ({
              ...msg,
              status: isAborted ? 'aborted' : 'error',
              errorCode: event.error.code,
              errorMessage: !isAborted && streamedText ? event.error.message : undefined,
              content: streamedText || (
                isAborted
                  ? 'Generation stopped before completion.'
                  : event.error.message
              ),
            }));
            recordActivity({
              requestId,
              intent: currentIntent,
              modelId: errModelId,
              modelName: errModel?.displayName ?? errModelId,
              providerId: event.error.providerId ?? activeProviderUsed,
              outcome: isAborted ? 'aborted' : 'error',
              latencyMs: Math.max(0, Date.now() - runStartedAt),
              fallbackUsed: fallbackWasUsed,
              fallbackReason: capturedFallbackReason,
              errorCode: event.error.code,
              steps: traceSteps,
            });
            return { ok: false, reason: isAborted ? 'aborted' : 'error' };
          }
        }

        return { ok: true };
      } finally {
        if (activeAbortControllerRef.current === controller) {
          activeAbortControllerRef.current = null;
        }
        pendingFallbackResolverRef.current = null;
        if (isMountedRef.current) {
          setPendingFallback(null);
        }
      }
    },
    [brain],
  );

  const sendMessage = useCallback(
    async (rawContent?: string): Promise<SendMessageResult> => {
      if (submissionLockRef.current) {
        return { ok: false, reason: 'in-flight' };
      }

      const sourceText = rawContent !== undefined ? rawContent : composerTextRef.current;
      const content = sourceText.trim();

      if (!content) {
        setComposerError('Please enter a message before sending.');
        return { ok: false, reason: 'empty' };
      }

      if (content.length > 8000) {
        setComposerError(
          'Message is too long for Phase 2 in-memory workspace (max 8,000 characters).',
        );
        return { ok: false, reason: 'too-long' };
      }

      submissionLockRef.current = true;
      setIsSubmitting(true);
      setComposerError(null);
      setWorkspaceNotice(null);

      try {
        const timestamp = formatCurrentTime();
        idSequenceRef.current += 1;
        const seq = idSequenceRef.current;
        const inIncognito = isIncognitoRef.current;
        const selectedModel =
          brain.models.getModel(selectedModelIdRef.current) ??
          brain.models.getDefaultModel();

        const userMessage: ChatMessage = {
          id: `msg-user-${Date.now()}-${seq}`,
          role: 'user',
          content,
          timestamp,
          status: 'complete',
        };

        const assistantMessage: ChatMessage = {
          id: `msg-assistant-${Date.now()}-${seq}`,
          role: 'assistant',
          content: '',
          timestamp,
          status: 'streaming',
          modelId: selectedModel?.id,
          modelName: selectedModel?.displayName,
          providerId: selectedModel?.providerId,
        };

        let contextMessages: ChatMessage[] = [];
        let targetIncognitoId: string | null = null;
        const targetConversationId = activeConversationIdRef.current;

        if (inIncognito) {
          const base = incognitoRef.current ?? createIncognitoSession();
          targetIncognitoId = base.id;
          contextMessages = [...base.messages, userMessage];
          const updatedSession: Conversation = {
            ...base,
            messages: [...base.messages, userMessage, assistantMessage],
            updatedAt: timestamp,
          };
          incognitoRef.current = updatedSession;
          setIncognitoConversation(updatedSession);
        } else {
          const existing = conversationsRef.current.find(
            (item) => item.id === targetConversationId,
          );
          contextMessages = existing ? [...existing.messages, userMessage] : [userMessage];

          setConversations((prev) => {
            const exists = prev.some((item) => item.id === targetConversationId);
            if (!exists) {
              const fresh: Conversation = {
                id: targetConversationId,
                title: buildConversationTitle(content),
                capabilityId: 'general-chat',
                messages: [userMessage, assistantMessage],
                createdAt: timestamp,
                updatedAt: timestamp,
              };
              return [fresh, ...prev];
            }

            return prev.map((thread) => {
              if (thread.id !== targetConversationId) return thread;
              const isFirstUserMessage = !thread.messages.some(
                (m) => m.role === 'user' && !m.isPreviewSample,
              );
              return {
                ...thread,
                title:
                  thread.title === 'New conversation' && isFirstUserMessage
                    ? buildConversationTitle(content)
                    : thread.title,
                messages: [...thread.messages, userMessage, assistantMessage],
                updatedAt: timestamp,
              };
            });
          });
        }

        composerTextRef.current = '';
        setComposerText('');
        setSelectedStarterId(null);
        setActiveView({ kind: 'chat' });

        return await runBrainStream({
          requestId: `req-${Date.now()}-${seq}`,
          inIncognito,
          targetIncognitoId,
          targetConversationId,
          assistantMessageId: assistantMessage.id,
          contextMessages,
        });
      } finally {
        submissionLockRef.current = false;
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [brain, runBrainStream],
  );

  const toggleMessageReaction = useCallback(
    (messageId: string, emoji: MessageReaction) => {
      const updateReactions = (messages: ChatMessage[]) =>
        messages.map((msg) => {
          if (msg.id !== messageId) return msg;
          const existing = msg.reactions ?? [];
          const hasReaction = existing.includes(emoji);
          const nextReactions = hasReaction
            ? existing.filter((item) => item !== emoji)
            : [...existing, emoji];
          return {
            ...msg,
            reactions: nextReactions,
          };
        });

      if (isIncognitoRef.current) {
        setIncognitoConversation((prev) =>
          prev ? { ...prev, messages: updateReactions(prev.messages) } : prev,
        );
        return;
      }

      setConversations((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeConversationId) return thread;
          return {
            ...thread,
            messages: updateReactions(thread.messages),
          };
        }),
      );
    },
    [activeConversationId],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      const timestamp = formatCurrentTime();
      if (isIncognitoRef.current) {
        setIncognitoConversation((prev) =>
          prev
            ? {
                ...prev,
                messages: prev.messages.filter((msg) => msg.id !== messageId),
                updatedAt: timestamp,
              }
            : prev,
        );
        return;
      }

      setConversations((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeConversationId) return thread;
          return {
            ...thread,
            messages: thread.messages.filter((msg) => msg.id !== messageId),
            updatedAt: timestamp,
          };
        }),
      );
    },
    [activeConversationId],
  );

  const regenerateMessage = useCallback(
    async (messageId: string): Promise<SendMessageResult> => {
      if (submissionLockRef.current) {
        return { ok: false, reason: 'in-flight' };
      }

      const inIncognito = isIncognitoRef.current;
      const currentConversation = inIncognito
        ? incognitoRef.current
        : conversationsRef.current.find(
            (item) => item.id === activeConversationIdRef.current,
          ) ?? null;

      if (!currentConversation) {
        return { ok: false, reason: 'error' };
      }

      const targetIndex = currentConversation.messages.findIndex(
        (msg) => msg.id === messageId,
      );
      if (targetIndex === -1 || currentConversation.messages[targetIndex].role === 'user') {
        return { ok: false, reason: 'error' };
      }

      submissionLockRef.current = true;
      setIsSubmitting(true);

      try {
        const timestamp = formatCurrentTime();
        idSequenceRef.current += 1;
        const seq = idSequenceRef.current;
        const contextMessages = currentConversation.messages.slice(0, targetIndex);
        const selectedModel =
          brain.models.getModel(selectedModelIdRef.current) ??
          brain.models.getDefaultModel();

        const resetMessage = (msg: ChatMessage): ChatMessage => {
          if (msg.id !== messageId) return msg;
          return {
            ...msg,
            role: 'assistant',
            content: '',
            timestamp,
            reactions: [],
            regenerationCount: (msg.regenerationCount ?? 0) + 1,
            status: 'streaming',
            modelId: selectedModel?.id,
            modelName: selectedModel?.displayName,
            providerId: selectedModel?.providerId,
            isFallback: false,
            fallbackReason: undefined,
            errorCode: undefined,
          };
        };

        if (inIncognito) {
          setIncognitoConversation((prev) =>
            prev
              ? {
                  ...prev,
                  updatedAt: timestamp,
                  messages: prev.messages.map(resetMessage),
                }
              : prev,
          );
        } else {
          const targetId = currentConversation.id;
          setConversations((prev) =>
            prev.map((thread) =>
              thread.id === targetId
                ? {
                    ...thread,
                    updatedAt: timestamp,
                    messages: thread.messages.map(resetMessage),
                  }
                : thread,
            ),
          );
        }

        return await runBrainStream({
          requestId: `regen-${Date.now()}-${seq}`,
          inIncognito,
          targetIncognitoId: inIncognito ? currentConversation.id : null,
          targetConversationId: currentConversation.id,
          assistantMessageId: messageId,
          contextMessages,
        });
      } finally {
        submissionLockRef.current = false;
        if (isMountedRef.current) {
          setIsSubmitting(false);
        }
      }
    },
    [brain, runBrainStream],
  );

  return {
    theme,
    setTheme,
    toggleTheme,
    conversations,
    activeConversation,
    activeConversationId,
    incognitoConversation,
    activeView,
    activeCapability,
    activePlannedSection,
    isDesktopSidebarOpen,
    setIsDesktopSidebarOpen,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    composerText,
    updateComposerText,
    composerError,
    setComposerError,
    workspaceNotice,
    setWorkspaceNotice,
    isSubmitting,
    selectedStarterId,
    composerFocusTick,
    isIncognito,
    availableModels,
    selectedModelId,
    setSelectedModelId: selectModel,
    setProviderEnabled,
    ollamaBaseUrl,
    ollamaModelName,
    ollamaConfigError,
    ollamaHealth,
    isCheckingOllama,
    updateOllamaConfig,
    testOllamaConnection,
    serverProxyStatus,
    isCheckingProxy,
    checkServerProxy,
    fallbackMode,
    setFallbackMode,
    pendingFallback,
    resolveFallbackConsent,
    stopGeneration,
    activityLogs,
    clearActivityLogs,
    enterIncognito,
    exitIncognito,
    toggleIncognito,
    createNewThread,
    selectThread,
    deleteThread,
    selectCapability,
    selectPlannedSection,
    populateStarterPrompt,
    clearAndFocusComposer,
    sendMessage,
    toggleMessageReaction,
    deleteMessage,
    regenerateMessage,
  };
}
