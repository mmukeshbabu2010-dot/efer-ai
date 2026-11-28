import { useEffect, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Cpu,
  EyeOff,
  GitBranch,
  HardDrive,
  RefreshCw,
  Server,
  Settings,
  ShieldCheck,
} from 'lucide-react';
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
  onSetProviderEnabled,
  onUpdateOllamaConfig,
  onTestOllamaConnection,
  onCheckServerProxy,
  onChangeFallbackMode,
  onSelectModelAndReturn,
  onBackToChat,
}: SettingsViewProps) {
  const [draftOllamaUrl, setDraftOllamaUrl] = useState(ollamaBaseUrl);
  const [draftOllamaModel, setDraftOllamaModel] = useState(ollamaModelName);
  const [ollamaSavedNotice, setOllamaSavedNotice] = useState<string | null>(null);

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

  const handleSaveOllama = (event: React.FormEvent) => {
    event.preventDefault();
    setOllamaSavedNotice(null);
    const result = onUpdateOllamaConfig(draftOllamaUrl, draftOllamaModel);
    if (result.ok) {
      setOllamaSavedNotice('Saved Ollama endpoint and local model name.');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-screen py-5 sm:py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-text-secondary">
              <Settings className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Phase 4 · Providers &amp; Fallback</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
              Settings &amp; Providers
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary">
              Configure EFER Brain adapters, local Ollama connectivity, server-side proxy
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
              Zero Browser API Key Storage
            </p>
            <p>
              EFER AI does not collect external AI API keys in the browser, does not persist
              secrets in browser storage, and does not ship a PIN-based browser key vault. Server
              proxy credentials stay strictly in backend environment variables
              (<code className="font-mono text-text-primary">GEMINI_API_KEY</code>,{' '}
              <code className="font-mono text-text-primary">GROQ_API_KEY</code>,{' '}
              <code className="font-mono text-text-primary">OPENROUTER_API_KEY</code>).
            </p>
          </div>
        </div>

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
          <div className="p-4 rounded-card bg-card border border-border space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <Cpu className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                    <span>EFER Demo Provider</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">mock-demo</span>
                  <span aria-hidden="true">·</span>
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
                onClick={() => onSetProviderEnabled('mock-demo', !demoEnabled)}
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

          {/* 2. Local Ollama */}
          <div className="p-4 rounded-card bg-card border border-border space-y-3.5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <HardDrive className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                    <span>Local Ollama</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">local-ollama</span>
                  <span aria-hidden="true">·</span>
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
                onClick={() => onSetProviderEnabled('local-ollama', !ollamaEnabled)}
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
                    void onTestOllamaConnection();
                  }}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border bg-bg hover:border-accent disabled:opacity-55 text-xs font-medium text-text-primary transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isCheckingOllama ? 'animate-spin' : ''}`}
                    aria-hidden="true"
                  />
                  <span>{isCheckingOllama ? 'Testing…' : 'Test Connection'}</span>
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

          {/* 3. Server Proxy */}
          <div className="p-4 rounded-card bg-card border border-border space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-text-primary">
                    <Server className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                    <span>Server Proxy (/api/*)</span>
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono">server-proxy</span>
                  <span aria-hidden="true">·</span>
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
                onClick={() => onSetProviderEnabled('server-proxy', !proxyEnabled)}
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
                  void onCheckServerProxy();
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-[10px] border border-border bg-bg hover:border-accent disabled:opacity-55 text-xs font-medium text-text-primary transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isCheckingProxy ? 'animate-spin' : ''}`}
                  aria-hidden="true"
                />
                <span>{isCheckingProxy ? 'Checking…' : 'Check Proxy Status'}</span>
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

          {/* 4. Planned Local GGUF WASM */}
          {ggufPlanned && (
            <div className="p-4 rounded-card bg-card-subtle border border-border space-y-1 opacity-85">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                <span className="text-sm font-semibold text-text-primary">
                  {ggufPlanned.displayName}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono">Planned · Phase 5+</span>
              </div>
              <p className="text-xs text-text-secondary">{ggufPlanned.shortDescription}</p>
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
              onClick={() => onChangeFallbackMode('ask-first')}
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
              onClick={() => onChangeFallbackMode('always-allow')}
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
