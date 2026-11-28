import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Cpu,
  Eye,
  EyeOff,
  GitBranch,
  HardDrive,
  KeyRound,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react';
import {
  BYOK_CAPABILITY_OPTIONS,
  BYOK_PRESETS,
  maskApiKey,
  toByokRegistryModelId,
  type ByokCapabilityTag,
  type ByokConnectionTestInput,
  type ByokPresetId,
  type ByokProviderConfig,
  type ByokProviderDraft,
} from '../../brain/adapters/ClientByokAdapter';
import { useOptionalToast } from '../../state/ToastContext';
import type { ServerProxyStatus } from '../../brain/adapters/ServerProxyAdapter';
import type {
  FallbackMode,
  ModelDescriptor,
  ProviderHealthStatus,
} from '../../brain/types';

interface SettingsViewProps {
  availableModels: ModelDescriptor[];
  fallbackMode: FallbackMode;
  ollamaBaseUrl: string;
  ollamaModelName: string;
  ollamaConfigError: string | null;
  ollamaHealth: ProviderHealthStatus | null;
  isCheckingOllama: boolean;
  serverProxyStatus: ServerProxyStatus | null;
  isCheckingProxy: boolean;
  byokProviders?: ByokProviderConfig[];
  onAddByokProvider?: (
    draft: ByokProviderDraft,
  ) => { ok: boolean; error?: string; provider?: ByokProviderConfig };
  onUpdateByokProvider?: (
    id: string,
    draft: ByokProviderDraft,
  ) => { ok: boolean; error?: string; provider?: ByokProviderConfig };
  onToggleByokProvider?: (id: string, enabled?: boolean) => void;
  onDeleteByokProvider?: (id: string) => void;
  onTestByokConnection?: (
    input: ByokConnectionTestInput,
  ) => Promise<ProviderHealthStatus>;
  onSetProviderEnabled: (
    providerId: 'mock-demo' | 'local-ollama' | 'server-proxy',
    enabled: boolean,
  ) => void;
  onUpdateOllamaConfig: (
    baseUrl: string,
    modelName: string,
  ) => { ok: boolean; error?: string };
  onTestOllamaConnection: () => Promise<ProviderHealthStatus>;
  onCheckServerProxy: () => Promise<ServerProxyStatus>;
  onChangeFallbackMode: (mode: FallbackMode) => void;
  onSelectModelAndReturn: (modelId: string) => void;
  onBackToChat: () => void;
}

function isProviderActive(
  models: ModelDescriptor[],
  providerId: string,
): boolean {
  return models.some(
    (model) => model.providerId === providerId && model.availability === 'active',
  );
}

function getModelCapabilitySearchTokens(model: ModelDescriptor): string[] {
  const tokens: string[] = [];
  if (model.capabilities.chat) tokens.push('chat');
  if (model.capabilities.code) tokens.push('code');
  if (model.capabilities.reasoning) tokens.push('think', 'reasoning');
  if (model.capabilities.vision || model.capabilities.image) tokens.push('image', 'vision');
  if (model.capabilities.video) tokens.push('video');
  if (model.capabilities.audio) tokens.push('audio');
  if (model.capabilities.localExecution) tokens.push('local');
  if (model.capabilities.streaming) tokens.push('streaming');
  return tokens;
}

function matchesSearchTerms(
  fields: Array<string | undefined | null>,
  terms: string[],
): boolean {
  if (terms.length === 0) return true;
  const haystack = fields
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .join(' ')
    .toLowerCase();
  return terms.every((term) => haystack.includes(term));
}

function getByokCapabilitySearchTokens(capabilities: ByokCapabilityTag[]): string[] {
  const tokens: string[] = [];
  for (const tag of capabilities) {
    tokens.push(tag);
    const label = BYOK_CAPABILITY_OPTIONS.find((opt) => opt.id === tag)?.label;
    if (label) tokens.push(label);
    if (tag === 'think') tokens.push('reasoning');
    if (tag === 'image') tokens.push('vision');
  }
  return tokens;
}

export function SettingsView({
  availableModels,
  fallbackMode,
  ollamaBaseUrl,
  ollamaModelName,
  ollamaConfigError,
  ollamaHealth,
  isCheckingOllama,
  serverProxyStatus,
  isCheckingProxy,
  byokProviders = [],
  onAddByokProvider,
  onUpdateByokProvider,
  onToggleByokProvider,
  onDeleteByokProvider,
  onTestByokConnection,
  onSetProviderEnabled,
  onUpdateOllamaConfig,
  onTestOllamaConnection,
  onCheckServerProxy,
  onChangeFallbackMode,
  onSelectModelAndReturn,
  onBackToChat,
}: SettingsViewProps) {
  const toast = useOptionalToast();
  const [draftOllamaUrl, setDraftOllamaUrl] = useState(ollamaBaseUrl);
  const [draftOllamaModel, setDraftOllamaModel] = useState(ollamaModelName);
  const [ollamaSavedNotice, setOllamaSavedNotice] = useState<string | null>(null);

  const defaultPreset = BYOK_PRESETS[0];
  const [isByokFormOpen, setIsByokFormOpen] = useState(false);
  const [editingByokId, setEditingByokId] = useState<string | null>(null);
  const [byokPresetId, setByokPresetId] = useState<ByokPresetId>(defaultPreset.id);
  const [byokDisplayName, setByokDisplayName] = useState('');
  const [byokBaseUrl, setByokBaseUrl] = useState(defaultPreset.defaultBaseUrl);
  const [byokModelId, setByokModelId] = useState('');
  const [byokApiKey, setByokApiKey] = useState('');
  const [showByokKey, setShowByokKey] = useState(false);
  const [byokCapabilities, setByokCapabilities] = useState<ByokCapabilityTag[]>([
    'chat',
    'code',
  ]);
  const [byokFormError, setByokFormError] = useState<string | null>(null);
  const [byokTestStatus, setByokTestStatus] =
    useState<ProviderHealthStatus | null>(null);
  const [isTestingByok, setIsTestingByok] = useState(false);
  const [modelSearchQuery, setModelSearchQuery] = useState('');

  useEffect(() => {
    setDraftOllamaUrl(ollamaBaseUrl);
    setDraftOllamaModel(ollamaModelName);
  }, [ollamaBaseUrl, ollamaModelName]);

  const demoEnabled = isProviderActive(availableModels, 'mock-demo');
  const ollamaEnabled = isProviderActive(availableModels, 'local-ollama');
  const proxyEnabled = isProviderActive(availableModels, 'server-proxy');

  const ollamaDescriptor = availableModels.find(
    (model) => model.providerId === 'local-ollama',
  );
  const proxyDescriptor = availableModels.find(
    (model) => model.providerId === 'server-proxy',
  );
  const ggufPlanned = availableModels.find(
    (model) => model.providerId === 'local-gguf',
  );

  const normalizedSearchTerms = useMemo(
    () =>
      modelSearchQuery
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter(Boolean),
    [modelSearchQuery],
  );

  const filteredByokProviders = useMemo(() => {
    if (normalizedSearchTerms.length === 0) return byokProviders;
    return byokProviders.filter((provider) => {
      const presetLabel =
        BYOK_PRESETS.find((preset) => preset.id === provider.presetId)?.label ?? 'Custom';
      return matchesSearchTerms(
        [
          provider.displayName,
          provider.modelId,
          provider.presetId,
          presetLabel,
          provider.baseUrl,
          provider.enabled ? 'active enabled' : 'inactive disabled',
          ...getByokCapabilitySearchTokens(provider.capabilities),
        ],
        normalizedSearchTerms,
      );
    });
  }, [byokProviders, normalizedSearchTerms]);

  const showDemoCard = useMemo(() => {
    const demoModels = availableModels.filter((m) => m.providerId === 'mock-demo');
    return matchesSearchTerms(
      [
        'EFER Demo Provider',
        'mock-demo',
        'demo',
        'local',
        demoEnabled ? 'enabled active' : 'disabled',
        ...demoModels.flatMap((m) => [
          m.displayName,
          m.id,
          m.shortDescription,
          ...getModelCapabilitySearchTokens(m),
        ]),
      ],
      normalizedSearchTerms,
    );
  }, [availableModels, demoEnabled, normalizedSearchTerms]);

  const showOllamaCard = useMemo(() => {
    const ollamaModels = availableModels.filter((m) => m.providerId === 'local-ollama');
    return matchesSearchTerms(
      [
        'Local Ollama',
        'local-ollama',
        'ollama',
        'local',
        ollamaModelName,
        draftOllamaModel,
        ollamaBaseUrl,
        ollamaEnabled ? 'enabled active' : 'disabled',
        ...ollamaModels.flatMap((m) => [
          m.displayName,
          m.id,
          m.shortDescription,
          ...getModelCapabilitySearchTokens(m),
        ]),
      ],
      normalizedSearchTerms,
    );
  }, [
    availableModels,
    draftOllamaModel,
    normalizedSearchTerms,
    ollamaBaseUrl,
    ollamaEnabled,
    ollamaModelName,
  ]);

  const showProxyCard = useMemo(() => {
    const proxyModels = availableModels.filter((m) => m.providerId === 'server-proxy');
    return matchesSearchTerms(
      [
        'Server Proxy',
        'server-proxy',
        '/api/chat',
        'proxy',
        'gemini',
        'groq',
        'openrouter',
        proxyEnabled ? 'enabled active' : 'disabled',
        ...proxyModels.flatMap((m) => [
          m.displayName,
          m.id,
          m.shortDescription,
          ...getModelCapabilitySearchTokens(m),
        ]),
      ],
      normalizedSearchTerms,
    );
  }, [availableModels, normalizedSearchTerms, proxyEnabled]);

  const showGgufCard = useMemo(() => {
    if (!ggufPlanned) return false;
    return matchesSearchTerms(
      [
        ggufPlanned.displayName,
        ggufPlanned.id,
        ggufPlanned.shortDescription,
        'local-gguf',
        'gguf',
        'wasm',
        'roadmap',
        ...getModelCapabilitySearchTokens(ggufPlanned),
      ],
      normalizedSearchTerms,
    );
  }, [ggufPlanned, normalizedSearchTerms]);

  const totalModularCount = ggufPlanned ? 4 : 3;
  const visibleModularCount =
    Number(showDemoCard) +
    Number(showOllamaCard) +
    Number(showProxyCard) +
    Number(showGgufCard);

  const handleToggleProvider = (
    providerId: 'mock-demo' | 'local-ollama' | 'server-proxy',
    label: string,
    nextEnabled: boolean,
  ) => {
    onSetProviderEnabled(providerId, nextEnabled);
    toast?.showToast({
      title: 'Settings saved',
      message: `${label} ${nextEnabled ? 'enabled' : 'disabled'}.`,
      variant: 'info',
      dedupeKey: `provider-${providerId}`,
    });
  };

  const handleSaveOllama = (event: React.FormEvent) => {
    event.preventDefault();
    setOllamaSavedNotice(null);
    const result = onUpdateOllamaConfig(draftOllamaUrl, draftOllamaModel);
    if (result.ok) {
      if (toast) {
        toast.showToast({
          title: 'Settings saved',
          message: 'Saved Ollama endpoint and local model name.',
          variant: 'success',
          dedupeKey: 'ollama-config',
        });
      } else {
        setOllamaSavedNotice('Saved Ollama endpoint and local model name.');
      }
    }
  };

  const handleTestOllama = async () => {
    const status = await onTestOllamaConnection();
    toast?.showToast({
      title: status.healthy ? 'Ollama reachable' : 'Ollama unreachable',
      message: status.detail,
      variant: status.healthy ? 'success' : 'warning',
      dedupeKey: 'ollama-health',
    });
  };

  const handleCheckProxy = async () => {
    const status = await onCheckServerProxy();
    toast?.showToast({
      title: status.reachable ? 'Server proxy ready' : 'Server proxy unavailable',
      message: status.detail,
      variant: status.reachable ? 'success' : 'info',
      dedupeKey: 'proxy-status',
    });
  };

  const handleFallbackChange = (mode: FallbackMode) => {
    onChangeFallbackMode(mode);
    toast?.showToast({
      title: 'Settings saved',
      message: `Fallback policy set to ${mode === 'always-allow' ? 'Always allow' : 'Ask first'}.`,
      variant: 'success',
      dedupeKey: 'fallback-policy',
    });
  };

  const selectedPreset =
    BYOK_PRESETS.find((preset) => preset.id === byokPresetId) ?? BYOK_PRESETS[0];

  const resetByokForm = () => {
    const preset = BYOK_PRESETS[0];
    setEditingByokId(null);
    setByokPresetId(preset.id);
    setByokDisplayName('');
    setByokBaseUrl(preset.defaultBaseUrl);
    setByokModelId('');
    setByokApiKey('');
    setShowByokKey(false);
    setByokCapabilities(['chat', 'code']);
    setByokFormError(null);
    setByokTestStatus(null);
  };

  const openAddByokForm = () => {
    resetByokForm();
    setIsByokFormOpen(true);
  };

  const openEditByokForm = (provider: ByokProviderConfig) => {
    setEditingByokId(provider.id);
    setByokPresetId(provider.presetId);
    setByokDisplayName(provider.displayName);
    setByokBaseUrl(provider.baseUrl);
    setByokModelId(provider.modelId);
    setByokApiKey(provider.apiKey);
    setShowByokKey(false);
    setByokCapabilities(provider.capabilities);
    setByokFormError(null);
    setByokTestStatus(null);
    setIsByokFormOpen(true);
  };

  const handlePresetChange = (nextPresetId: ByokPresetId) => {
    const nextPreset =
      BYOK_PRESETS.find((item) => item.id === nextPresetId) ?? BYOK_PRESETS[0];
    setByokPresetId(nextPresetId);
    setByokBaseUrl(nextPreset.defaultBaseUrl);
    setByokTestStatus(null);
    setByokFormError(null);
  };

  const handleToggleByokTag = (tag: ByokCapabilityTag) => {
    setByokCapabilities((prev) => {
      if (prev.includes(tag)) {
        if (prev.length === 1) return prev;
        return prev.filter((item) => item !== tag);
      }
      return [...prev, tag];
    });
  };

  const handleTestByok = async () => {
    if (!onTestByokConnection) return;
    setIsTestingByok(true);
    setByokFormError(null);
    try {
      const status = await onTestByokConnection({
        presetId: byokPresetId,
        baseUrl: byokBaseUrl,
        modelId: byokModelId,
        apiKey: byokApiKey,
      });
      setByokTestStatus(status);
    } finally {
      setIsTestingByok(false);
    }
  };

  const handleSaveByokSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setByokFormError(null);
    const draft: ByokProviderDraft = {
      presetId: byokPresetId,
      displayName: byokDisplayName,
      baseUrl: byokBaseUrl,
      modelId: byokModelId,
      apiKey: byokApiKey,
      capabilities: byokCapabilities,
    };

    if (editingByokId && onUpdateByokProvider) {
      const res = onUpdateByokProvider(editingByokId, draft);
      if (!res.ok) {
        setByokFormError(res.error ?? 'Unable to update custom API.');
        return;
      }
      setIsByokFormOpen(false);
      resetByokForm();
      toast?.showToast({
        title: 'Settings saved',
        message: `Updated custom API "${draft.displayName.trim()}".`,
        variant: 'success',
        dedupeKey: 'byok-save',
      });
      return;
    }

    if (onAddByokProvider) {
      const res = onAddByokProvider(draft);
      if (!res.ok) {
        setByokFormError(res.error ?? 'Unable to save custom API.');
        return;
      }
      setIsByokFormOpen(false);
      resetByokForm();
      toast?.showToast({
        title: 'Settings saved',
        message: `Added custom API "${draft.displayName.trim()}".`,
        variant: 'success',
        dedupeKey: 'byok-save',
      });
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-screen pt-5 pb-8 sm:py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-text-secondary">
              <Settings className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Providers &amp; Fallback</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
              Settings &amp; Providers
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary">
              Configure custom browser BYOK keys, local Ollama connectivity, server-side proxy
              status, and fallback permission rules.
            </p>
          </div>

          <button
            type="button"
            onClick={onBackToChat}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-card bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Back to Chat</span>
          </button>
        </div>

        <div className="flex items-start gap-3 p-4 rounded-card bg-card-subtle border border-border text-xs text-text-secondary leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-accent mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold text-text-primary">
              Browser BYOK &amp; Server Proxy Boundary
            </p>
            <p>
              Custom BYOK keys stay strictly in your browser&apos;s{' '}
              <code className="font-mono text-text-primary">localStorage</code>{' '}
              (<code className="font-mono text-text-primary">efer-byok-providers-v1</code>) and
              connect directly from your browserânever transmitted to{' '}
              <code className="font-mono text-text-primary">/api/chat</code> or{' '}
              <code className="font-mono text-text-primary">server.js</code>. Server Proxy
              credentials remain strictly in backend environment variables.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="efer-settings-model-search" className="sr-only">
            Search saved BYOK providers and local models
          </label>
          <div className="flex items-center gap-2 h-10 px-3 rounded-[12px] bg-card border border-border focus-within:border-accent transition-colors">
            <Search className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
            <input
              id="efer-settings-model-search"
              type="search"
              value={modelSearchQuery}
              onChange={(event) => setModelSearchQuery(event.target.value)}
              placeholder="Search saved BYOK providers or local models by name or capability (e.g. think, code, local)..."
              className="flex-1 min-w-0 h-full bg-transparent text-xs sm:text-sm text-text-primary placeholder:text-placeholder focus:outline-none"
            />
            {modelSearchQuery.trim().length > 0 && (
              <button
                type="button"
                aria-label="Clear model search"
                onClick={() => setModelSearchQuery('')}
                className="inline-flex items-center justify-center w-6 h-6 rounded-[7px] text-text-secondary hover:text-text-primary hover:bg-card-subtle transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          {normalizedSearchTerms.length > 0 && (
            <p className="text-[11px] font-mono tabular-nums text-text-secondary px-0.5">
              Showing {filteredByokProviders.length} of {byokProviders.length} custom APIs Â·{' '}
              {visibleModularCount} of {totalModularCount} modular providers
            </p>
          )}
        </div>

        {/* Custom APIs (BYOK) Manager */}
        <section aria-labelledby="efer-byok-heading" className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                <h3
                  id="efer-byok-heading"
                  className="text-sm font-semibold text-text-primary"
                >
                  Your Custom APIs (BYOK)
                </h3>
                <span className="text-xs text-text-secondary font-mono tabular-nums">
                  {byokProviders.filter((p) => p.enabled).length} active
                </span>
              </div>
              <p className="text-xs text-text-secondary">
                Connect OpenAI-compatible endpoints or Google Gemini REST directly from your browser.
              </p>
            </div>

            {!isByokFormOpen ? (
              <button
                type="button"
                onClick={openAddByokForm}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Add Custom API</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsByokFormOpen(false);
                  resetByokForm();
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border bg-card text-xs font-medium text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Cancel</span>
              </button>
            )}
          </div>

          {isByokFormOpen && (
            <form
              aria-label="Custom API configuration"
              onSubmit={handleSaveByokSubmit}
              className="p-4 rounded-card bg-card border border-border space-y-4"
            >
              <div className="flex flex-col items-start gap-1 min-w-0">
                <h4 className="text-sm font-semibold text-text-primary whitespace-nowrap">
                  {editingByokId ? 'Edit Custom API' : 'Add Custom API'}
                </h4>
                <span className="text-[11px] font-mono text-text-secondary break-all">
                  Stored locally in efer-byok-providers-v1
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label
                    htmlFor="efer-byok-preset"
                    className="block text-xs font-medium text-text-secondary"
                  >
                    Quick Preset
                  </label>
                  <div className="relative">
                    <select
                      id="efer-byok-preset"
                      value={byokPresetId}
                      onChange={(event) =>
                        handlePresetChange(event.target.value as ByokPresetId)
                      }
                      className="w-full h-9 appearance-none pl-2.5 pr-8 rounded-[10px] bg-bg border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
                    >
                      {BYOK_PRESETS.map((preset) => (
                        <option key={preset.id} value={preset.id}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" aria-hidden="true" />
                  </div>
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="efer-byok-name"
                    className="block text-xs font-medium text-text-secondary"
                  >
                    Display Name
                  </label>
                  <input
                    id="efer-byok-name"
                    type="text"
                    value={byokDisplayName}
                    onChange={(event) => {
                      setByokDisplayName(event.target.value);
                      setByokFormError(null);
                    }}
                    placeholder={`My ${selectedPreset.label} Key`}
                    className="w-full h-9 px-3 rounded-[10px] bg-bg border border-border text-xs text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label
                    htmlFor="efer-byok-url"
                    className="block text-xs font-medium text-text-secondary"
                  >
                    Base URL
                  </label>
                  <input
                    id="efer-byok-url"
                    type="url"
                    value={byokBaseUrl}
                    onChange={(event) => {
                      setByokBaseUrl(event.target.value);
                      setByokTestStatus(null);
                      setByokFormError(null);
                    }}
                    placeholder="https://api.openai.com/v1"
                    className="w-full h-9 px-3 rounded-[10px] bg-bg border border-border text-xs font-mono text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="efer-byok-model"
                    className="block text-xs font-medium text-text-secondary"
                  >
                    Model ID
                  </label>
                  <input
                    id="efer-byok-model"
                    type="text"
                    value={byokModelId}
                    onChange={(event) => {
                      setByokModelId(event.target.value);
                      setByokTestStatus(null);
                      setByokFormError(null);
                    }}
                    placeholder={selectedPreset.defaultModelPlaceholder}
                    className="w-full h-9 px-3 rounded-[10px] bg-bg border border-border text-xs font-mono text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent"
                  />
                </div>

                <div className="space-y-1">
                  <label
                    htmlFor="efer-byok-key"
                    className="block text-xs font-medium text-text-secondary"
                  >
                    API Key
                  </label>
                  <div className="flex items-center h-9 rounded-[10px] bg-bg border border-border focus-within:border-accent overflow-hidden">
                    <input
                      id="efer-byok-key"
                      type={showByokKey ? 'text' : 'password'}
                      autoComplete="off"
                      spellCheck={false}
                      value={byokApiKey}
                      onChange={(event) => {
                        setByokApiKey(event.target.value);
                        setByokTestStatus(null);
                        setByokFormError(null);
                      }}
                      placeholder="Paste provider API key"
                      className="flex-1 min-w-0 h-full px-3 bg-transparent text-xs font-mono text-text-primary placeholder:text-placeholder focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowByokKey((prev) => !prev)}
                      aria-label={showByokKey ? 'Hide API key' : 'Show API key'}
                      className="inline-flex items-center justify-center w-9 h-full text-text-secondary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent shrink-0"
                    >
                      {showByokKey ? (
                        <EyeOff className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-medium text-text-secondary">
                  Capability Tags
                </span>
                <div
                  role="group"
                  aria-label="Capability tags"
                  className="flex flex-wrap items-center gap-1.5"
                >
                  {BYOK_CAPABILITY_OPTIONS.map((tag) => {
                    const isSelected = byokCapabilities.includes(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => handleToggleByokTag(tag.id)}
                        className={`h-7 px-2.5 rounded-pill border text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent ${
                          isSelected
                            ? 'bg-accent-soft border-accent text-text-primary'
                            : 'bg-bg border-border text-text-secondary hover:text-text-primary'
                        }`}
                      >
                        {tag.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {byokFormError && (
                <div role="alert" className="flex items-start gap-2 text-xs text-danger">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{byokFormError}</span>
                </div>
              )}

              {byokTestStatus && (
                <div
                  role="status"
                  className="flex flex-wrap items-center gap-2 text-xs"
                >
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[8px] border font-medium ${
                      byokTestStatus.healthy
                        ? 'bg-success/10 border-success/40 text-success'
                        : 'bg-danger/10 border-danger/40 text-danger'
                    }`}
                  >
                    {byokTestStatus.healthy ? (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    )}
                    <span>{byokTestStatus.healthy ? 'Connected' : 'Error'}</span>
                  </span>
                  <span className="text-text-secondary">{byokTestStatus.detail}</span>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={isTestingByok || !onTestByokConnection}
                  onClick={() => {
                    void handleTestByok();
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border bg-bg hover:border-accent disabled:opacity-55 text-xs font-medium text-text-primary transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isTestingByok ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isTestingByok ? 'Testingâ¦' : 'Test Connection'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsByokFormOpen(false);
                      resetByokForm();
                    }}
                    className="inline-flex items-center h-9 px-3 rounded-[10px] border border-border bg-card-subtle text-xs font-medium text-text-secondary hover:text-text-primary transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  >
                    <span>{editingByokId ? 'Update Custom API' : 'Save Custom API'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}

          {byokProviders.length === 0 ? (
            <div className="p-4 rounded-card bg-card border border-border text-xs text-text-secondary leading-relaxed">
              No custom APIs saved yet. Click{' '}
              <span className="font-medium text-text-primary">+ Add Custom API</span> to connect
              OpenAI, Google Gemini, Groq, OpenRouter, DeepSeek, Together AI, Fal.ai, or any
              custom OpenAI-compatible endpoint.
            </div>
          ) : filteredByokProviders.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-card bg-card border border-border text-xs text-text-secondary">
              <span>
                No saved custom APIs match &ldquo;{modelSearchQuery.trim()}&rdquo;.
              </span>
              <button
                type="button"
                onClick={() => setModelSearchQuery('')}
                className="inline-flex items-center h-8 px-2.5 rounded-[9px] border border-border bg-card-subtle text-xs font-medium text-text-primary hover:border-accent transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
              >
                Clear search
              </button>
            </div>
          ) : (
            <ul className="space-y-2.5" aria-label="Saved custom APIs">
              {filteredByokProviders.map((provider) => {
                const presetLabel =
                  BYOK_PRESETS.find((p) => p.id === provider.presetId)?.label ?? 'Custom';
                const registryModelId = toByokRegistryModelId(provider.id);
                return (
                  <li
                    key={provider.id}
                    className="p-4 rounded-card bg-card border border-border space-y-2.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                          <span className="text-sm font-semibold text-text-primary">
                            {provider.displayName}
                          </span>
                          <span aria-hidden="true">Â·</span>
                          <span>{presetLabel}</span>
                          <span aria-hidden="true">Â·</span>
                          <span className="font-mono text-text-primary">{provider.modelId}</span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono text-text-secondary">
                          <span className="truncate max-w-[260px] sm:max-w-md">
                            {provider.baseUrl}
                          </span>
                          <span aria-hidden="true">Â·</span>
                          <span>Key {maskApiKey(provider.apiKey)}</span>
                          <span aria-hidden="true">Â·</span>
                          <span>{provider.enabled ? 'Active' : 'Inactive'}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={provider.enabled}
                          aria-label={`Toggle ${provider.displayName}`}
                          onClick={() => {
                            if (!onToggleByokProvider) return;
                            const nextState = !provider.enabled;
                            onToggleByokProvider(provider.id, nextState);
                            toast?.showToast({
                              title: 'Settings saved',
                              message: `${provider.displayName} ${nextState ? 'activated' : 'paused'}.`,
                              variant: 'info',
                              dedupeKey: `byok-toggle-${provider.id}`,
                            });
                          }}
                          className={`h-8 px-2.5 rounded-[10px] border text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                            provider.enabled
                              ? 'bg-accent-soft border-accent text-text-primary'
                              : 'bg-card-subtle border-border text-text-secondary hover:text-text-primary'
                          }`}
                        >
                          {provider.enabled ? 'Active' : 'Inactive'}
                        </button>

                        {provider.enabled && (
                          <button
                            type="button"
                            onClick={() => onSelectModelAndReturn(registryModelId)}
                            className="inline-flex items-center h-8 px-2.5 rounded-[10px] bg-accent-soft border border-accent text-xs font-medium text-text-primary hover:bg-accent hover:text-accent-text transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                          >
                            Use in Chat
                          </button>
                        )}

                        <button
                          type="button"
                          aria-label={`Edit ${provider.displayName}`}
                          onClick={() => openEditByokForm(provider)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-[9px] border border-border bg-card-subtle text-text-secondary hover:text-text-primary hover:border-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>

                        <button
                          type="button"
                          aria-label={`Delete ${provider.displayName}`}
                          onClick={() => {
                            if (!onDeleteByokProvider) return;
                            onDeleteByokProvider(provider.id);
                            if (editingByokId === provider.id) {
                              setIsByokFormOpen(false);
                              resetByokForm();
                            }
                            toast?.showToast({
                              title: 'Settings saved',
                              message: `Removed custom API "${provider.displayName}".`,
                              variant: 'info',
                              dedupeKey: 'byok-delete',
                            });
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-[9px] border border-border bg-card-subtle text-text-secondary hover:text-danger hover:border-danger/40 transition-colors focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {provider.capabilities.map((tag) => {
                        const label =
                          BYOK_CAPABILITY_OPTIONS.find((opt) => opt.id === tag)?.label ?? tag;
                        return (
                          <span
                            key={`${provider.id}-${tag}`}
                            className="inline-flex items-center px-2 py-0.5 rounded-pill bg-card-subtle border border-border text-[11px] font-medium text-text-secondary"
                          >
                            {label}
                          </span>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="efer-providers-heading" className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3
              id="efer-providers-heading"
              className="text-sm font-semibold text-text-primary"
            >
              Modular Provider Adapters
            </h3>
            <span className="text-xs text-text-secondary font-mono tabular-nums">
              {availableModels.filter((m) => m.availability === 'active').length} active models
            </span>
          </div>

          {/* 1. EFER Demo Provider */}
          {showDemoCard && (
            <div className="p-4 rounded-card bg-card border border-border space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <Cpu className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                    <span>EFER Demo Provider</span>
                  </span>
                  <span aria-hidden="true">Â·</span>
                  <span className="font-mono">mock-demo</span>
                  <span aria-hidden="true">Â·</span>
                  <span>{demoEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Local simulated streaming adapter for testing prompts, intent classification,
                  stop/abort, and fallback consent without external network traffic.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={demoEnabled}
                aria-label="Enable EFER Demo Provider"
                onClick={() =>
                  handleToggleProvider('mock-demo', 'EFER Demo Provider', !demoEnabled)
                }
                className={`h-8 px-3 rounded-[10px] border text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  demoEnabled
                    ? 'bg-accent-soft border-accent text-text-primary'
                    : 'bg-card-subtle border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {demoEnabled ? 'Enabled' : 'Enable'}
              </button>
            </div>
            </div>
          )}

          {/* 2. Local Ollama */}
          {showOllamaCard && (
            <div className="p-4 rounded-card bg-card border border-border space-y-3.5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <HardDrive className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                    <span>Local Ollama</span>
                  </span>
                  <span aria-hidden="true">Â·</span>
                  <span className="font-mono">local-ollama</span>
                  <span aria-hidden="true">Â·</span>
                  <span>{ollamaEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Connects directly from your browser to a local Ollama daemon over HTTP/HTTPS
                  (requires <code className="font-mono text-text-primary">OLLAMA_ORIGINS</code>{' '}
                  CORS permission on the device running Ollama).
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={ollamaEnabled}
                aria-label="Enable Local Ollama"
                onClick={() =>
                  handleToggleProvider('local-ollama', 'Local Ollama', !ollamaEnabled)
                }
                className={`h-8 px-3 rounded-[10px] border text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  ollamaEnabled
                    ? 'bg-accent-soft border-accent text-text-primary'
                    : 'bg-card-subtle border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {ollamaEnabled ? 'Enabled' : 'Enable'}
              </button>
            </div>

            <form
              onSubmit={handleSaveOllama}
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1"
            >
              <div className="space-y-1">
                <label
                  htmlFor="efer-ollama-url"
                  className="block text-xs font-medium text-text-secondary"
                >
                  Ollama Endpoint URL
                </label>
                <input
                  id="efer-ollama-url"
                  type="url"
                  value={draftOllamaUrl}
                  onChange={(event) => {
                    setDraftOllamaUrl(event.target.value);
                    setOllamaSavedNotice(null);
                  }}
                  placeholder="http://localhost:11434"
                  className="w-full h-9 px-3 rounded-[10px] bg-bg border border-border text-xs font-mono text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="efer-ollama-model"
                  className="block text-xs font-medium text-text-secondary"
                >
                  Local Model Name
                </label>
                <input
                  id="efer-ollama-model"
                  type="text"
                  value={draftOllamaModel}
                  onChange={(event) => {
                    setDraftOllamaModel(event.target.value);
                    setOllamaSavedNotice(null);
                  }}
                  placeholder="llama3.2"
                  className="w-full h-9 px-3 rounded-[10px] bg-bg border border-border text-xs font-mono text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent"
                />
              </div>

              <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border bg-card-subtle hover:border-accent text-xs font-medium text-text-primary transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span>Save Ollama Config</span>
                </button>
                <button
                  type="button"
                  disabled={isCheckingOllama}
                  onClick={() => {
                    void handleTestOllama();
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border bg-bg hover:border-accent disabled:opacity-55 text-xs font-medium text-text-primary transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isCheckingOllama ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isCheckingOllama ? 'Testingâ¦' : 'Test Connection'}</span>
                </button>

                {ollamaEnabled && ollamaDescriptor && (
                  <button
                    type="button"
                    onClick={() => onSelectModelAndReturn(ollamaDescriptor.id)}
                    className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] bg-accent-soft border border-accent text-xs font-medium text-text-primary hover:bg-accent hover:text-accent-text transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <span>Use in Chat</span>
                  </button>
                )}
              </div>
            </form>

            {ollamaConfigError && (
              <div
                role="alert"
                className="flex items-start gap-2 text-xs text-danger"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{ollamaConfigError}</span>
              </div>
            )}

            {ollamaSavedNotice && !ollamaConfigError && (
              <div
                role="status"
                className="flex items-center gap-2 text-xs text-success"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{ollamaSavedNotice}</span>
              </div>
            )}

            {ollamaHealth && (
              <div
                role="status"
                className={`flex items-start gap-2 text-xs ${
                  ollamaHealth.healthy ? 'text-success' : 'text-danger'
                }`}
              >
                {ollamaHealth.healthy ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                )}
                <span>{ollamaHealth.detail}</span>
              </div>
            )}
          </div>
          )}

          {/* 3. Server Proxy */}
          {showProxyCard && (
            <div className="p-4 rounded-card bg-card border border-border space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <Server className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                    <span>Server Proxy (/api/*)</span>
                  </span>
                  <span aria-hidden="true">Â·</span>
                  <span className="font-mono">server-proxy</span>
                  <span aria-hidden="true">Â·</span>
                  <span>{proxyEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  Routes prompts through same-origin <code className="font-mono text-text-primary">/api/chat</code>{' '}
                  when hosted with a backend server holding environment API keys. Static-only
                  deployments report no backend without failing.
                </p>
              </div>

              <button
                type="button"
                role="switch"
                aria-checked={proxyEnabled}
                aria-label="Enable Server Proxy"
                onClick={() =>
                  handleToggleProvider('server-proxy', 'Server Proxy', !proxyEnabled)
                }
                className={`h-8 px-3 rounded-[10px] border text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  proxyEnabled
                    ? 'bg-accent-soft border-accent text-text-primary'
                    : 'bg-card-subtle border-border text-text-secondary hover:text-text-primary'
                }`}
              >
                {proxyEnabled ? 'Enabled' : 'Enable'}
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={isCheckingProxy}
                onClick={() => {
                  void handleCheckProxy();
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border bg-bg hover:border-accent disabled:opacity-55 text-xs font-medium text-text-primary transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isCheckingProxy ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isCheckingProxy ? 'Checkingâ¦' : 'Check Proxy Status'}</span>
              </button>

              {proxyEnabled && proxyDescriptor && (
                <button
                  type="button"
                  onClick={() => onSelectModelAndReturn(proxyDescriptor.id)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] bg-accent-soft border border-accent text-xs font-medium text-text-primary hover:bg-accent hover:text-accent-text transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <span>Use in Chat</span>
                </button>
              )}
            </div>

            {serverProxyStatus && (
              <div role="status" className="space-y-1.5 text-xs">
                <div
                  className={`flex items-start gap-2 ${
                    serverProxyStatus.reachable ? 'text-text-primary' : 'text-text-secondary'
                  }`}
                >
                  {serverProxyStatus.reachable ? (
                    <CheckCircle2
                      className="w-4 h-4 text-success mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                  ) : (
                    <AlertCircle
                      className="w-4 h-4 text-warning mt-0.5 shrink-0"
                      aria-hidden="true"
                    />
                  )}
                  <span>{serverProxyStatus.detail}</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-6 text-text-secondary font-mono">
                  <span>
                    Gemini: {serverProxyStatus.configured.gemini ? 'Configured' : 'Not set'}
                  </span>
                  <span>
                    Groq: {serverProxyStatus.configured.groq ? 'Configured' : 'Not set'}
                  </span>
                  <span>
                    OpenRouter:{' '}
                    {serverProxyStatus.configured.openrouter ? 'Configured' : 'Not set'}
                  </span>
                </div>
              </div>
            )}
          </div>
          )}

          {/* 4. Planned Local GGUF WASM */}
          {showGgufCard && ggufPlanned && (
            <div className="p-4 rounded-card bg-card-subtle border border-border space-y-1 opacity-85">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                <span className="text-sm font-semibold text-text-primary">
                  {ggufPlanned.displayName}
                </span>
                <span aria-hidden="true">Â·</span>
                <span className="font-mono">Roadmap</span>
              </div>
              <p className="text-xs text-text-secondary">{ggufPlanned.shortDescription}</p>
            </div>
          )}

          {visibleModularCount === 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-card bg-card border border-border text-xs text-text-secondary">
              <span>
                No local or built-in providers match &ldquo;{modelSearchQuery.trim()}&rdquo;.
              </span>
              <button
                type="button"
                onClick={() => setModelSearchQuery('')}
                className="inline-flex items-center h-8 px-2.5 rounded-[9px] border border-border bg-card-subtle text-xs font-medium text-text-primary hover:border-accent transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
              >
                Clear search
              </button>
            </div>
          )}
        </section>

        {/* Fallback Permission Policy */}
        <section
          aria-labelledby="efer-fallback-heading"
          className="p-4 rounded-card bg-card border border-border space-y-3"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
              <h3
                id="efer-fallback-heading"
                className="text-sm font-semibold text-text-primary"
              >
                Fallback Permission Policy
              </h3>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Controls what EFER Brain does when the selected model encounters a rate limit,
              endpoint error, or unavailable backend and an alternative active model exists.
            </p>
          </div>

          <div
            role="radiogroup"
            aria-label="Fallback permission policy"
            className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
          >
            <button
              type="button"
              role="radio"
              aria-checked={fallbackMode === 'ask-first'}
              onClick={() => handleFallbackChange('ask-first')}
              className={`p-3 rounded-[12px] border text-left space-y-1 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                fallbackMode === 'ask-first'
                  ? 'bg-accent-soft border-accent text-text-primary'
                  : 'bg-bg border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="text-xs font-semibold text-text-primary">Ask first</div>
              <p className="text-xs text-text-secondary leading-snug">
                Show the inline consent card before switching to another provider or model.
              </p>
            </button>

            <button
              type="button"
              role="radio"
              aria-checked={fallbackMode === 'always-allow'}
              onClick={() => handleFallbackChange('always-allow')}
              className={`p-3 rounded-[12px] border text-left space-y-1 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                fallbackMode === 'always-allow'
                  ? 'bg-accent-soft border-accent text-text-primary'
                  : 'bg-bg border-border text-text-secondary hover:text-text-primary'
              }`}
            >
              <div className="text-xs font-semibold text-text-primary">Always allow</div>
              <p className="text-xs text-text-secondary leading-snug">
                Automatically switch to the next eligible active model on failure.
              </p>
            </button>
          </div>
        </section>

        {/* Privacy Boundaries */}
        <section
          aria-labelledby="efer-privacy-heading"
          className="p-4 rounded-card bg-card-subtle border border-border space-y-2"
        >
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
            <h3
              id="efer-privacy-heading"
              className="text-sm font-semibold text-text-primary"
            >
              Privacy &amp; Routing Boundaries
            </h3>
          </div>
          <ul className="space-y-1.5 text-xs text-text-secondary list-disc pl-5 leading-relaxed">
            <li>
              Incognito sessions live exclusively in temporary RAM, block exports, and never record
              Activity Log traces.
            </li>
            <li>
              Enabling Local Ollama sends prompts only to your configured device endpoint over
              HTTP/HTTPS.
            </li>
            <li>
              Custom BYOK APIs store credentials only in browser{' '}
              <code className="font-mono text-text-primary">localStorage</code> (
              <code className="font-mono text-text-primary">efer-byok-providers-v1</code>) and
              call your configured provider URL directly without passing keys through{' '}
              <code className="font-mono text-text-primary">/api/chat</code> or{' '}
              <code className="font-mono text-text-primary">server.js</code>.
            </li>
            <li>
              Enabling Server Proxy transmits prompts to your backend{' '}
              <code className="font-mono text-text-primary">/api/chat</code> route and any upstream
              provider configured there.
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

export default SettingsView;
