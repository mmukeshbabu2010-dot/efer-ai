import { lazy, Suspense, useEffect, useState } from 'react';
import { EyeOff, Info, WifiOff, X } from 'lucide-react';
import { Composer } from './components/chat/Composer';
import { EmptyState } from './components/chat/EmptyState';
import { FallbackConsentCard } from './components/chat/FallbackConsentCard';
import { ThreadView } from './components/chat/ThreadView';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useVisualViewport } from './hooks/useVisualViewport';
import { useWorkspaceStore } from './state/useWorkspaceStore';
import { EFER_CAPABILITIES } from './brain/capabilities';
import { downloadConversation, type ExportFormat } from './utils/exportConversation';

const ActivityLogView = lazy(() =>
  import('./components/activity/ActivityLogView').then((mod) => ({
    default: mod.ActivityLogView,
  })),
);

const SettingsView = lazy(() =>
  import('./components/settings/SettingsView').then((mod) => ({
    default: mod.SettingsView,
  })),
);

const MemoryView = lazy(() =>
  import('./components/memory/MemoryView').then((mod) => ({
    default: mod.MemoryView,
  })),
);

const PlannedView = lazy(() =>
  import('./components/roadmap/PlannedView').then((mod) => ({
    default: mod.PlannedView,
  })),
);

export function App() {
  const store = useWorkspaceStore();
  const isOnline = useNetworkStatus();
  const { isCompactHeight } = useVisualViewport();
  const [shortcutAnnouncement, setShortcutAnnouncement] = useState<string | null>(null);
  const [isThreadSearchOpen, setIsThreadSearchOpen] = useState<boolean>(false);
  const [threadSearchQuery, setThreadSearchQuery] = useState<string>('');
  const [composerForceSendTick, setComposerForceSendTick] = useState<number>(0);

  const { clearAndFocusComposer } = store;

  useEffect(() => {
    setIsThreadSearchOpen(false);
    setThreadSearchQuery('');
  }, [store.activeConversationId, store.activeView.kind, store.isIncognito]);

  const handleOpenMobileDrawer = () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    store.setIsMobileDrawerOpen(true);
  };

  useEffect(() => {
    const handleGlobalKeyDown = (event: KeyboardEvent) => {
      const hasPrimaryModifier = event.ctrlKey || event.metaKey;
      if (!hasPrimaryModifier || event.altKey) return;

      if (!event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        clearAndFocusComposer();
        setShortcutAnnouncement('Composer cleared and focused.');
        return;
      }

      if (event.key === 'Enter') {
        if (event.repeat || store.activeView.kind !== 'chat') return;
        event.preventDefault();
        setComposerForceSendTick((tick) => tick + 1);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [clearAndFocusComposer, store.activeView.kind]);

  const activeModeLabel =
    EFER_CAPABILITIES.find((c) => c.id === store.activeCapabilityMode)?.label ??
    'General Chat';

  const headerTitle =
    store.activeView.kind === 'activity'
      ? 'Activity Log'
      : store.activeView.kind === 'settings'
        ? 'Settings & Providers'
        : store.activeView.kind === 'memory'
          ? 'Memory Controls'
          : store.activeView.kind === 'planned-capability'
            ? store.activeCapability.label
            : store.activeView.kind === 'planned-section' && store.activePlannedSection
              ? store.activePlannedSection.label
              : store.activeConversation?.title ?? 'General Chat';

  const headerSubtitle =
    store.activeView.kind === 'activity'
      ? 'Routing Traces'
      : store.activeView.kind === 'settings'
        ? 'Providers & Fallback'
        : store.activeView.kind === 'memory'
          ? 'User-Owned Context'
          : store.activeView.kind === 'planned-capability'
            ? store.activeCapability.phaseLabel
            : store.activeView.kind === 'planned-section' && store.activePlannedSection
              ? store.activePlannedSection.phaseLabel
              : store.isIncognito
                ? 'Incognito · RAM only'
                : activeModeLabel;

  const canExport =
    store.activeView.kind === 'chat' &&
    store.activeConversation !== null &&
    !store.isIncognito &&
    !store.activeConversation.isIncognito;
  const canSearch =
    store.activeView.kind === 'chat' &&
    store.activeConversation !== null &&
    store.activeConversation.messages.length > 0;
  const canToggleRemember =
    store.activeView.kind === 'chat' &&
    store.activeConversation !== null &&
    !store.isIncognito &&
    !store.activeConversation.isIncognito;
  const isChatRemembered =
    !store.isIncognito && store.activeConversation?.rememberThisChat !== false;

  const handleExport = (format: ExportFormat) => {
    if (!store.activeConversation || store.isIncognito || store.activeConversation.isIncognito) {
      return;
    }
    downloadConversation(store.activeConversation, format);
  };

  return (
    <div className="flex h-[var(--efer-app-height,100dvh)] w-full bg-bg text-text-primary overflow-hidden">
      <Sidebar
        conversations={store.conversations}
        activeConversationId={store.activeConversationId}
        activeView={store.activeView}
        activeCapabilityMode={store.activeCapabilityMode}
        theme={store.theme}
        isDesktopOpen={store.isDesktopSidebarOpen}
        isMobileOpen={store.isMobileDrawerOpen}
        isIncognito={store.isIncognito}
        activityLogCount={store.activityLogs.length}
        memoryCount={store.memories.length}
        onCloseMobile={() => store.setIsMobileDrawerOpen(false)}
        onExitIncognito={store.exitIncognito}
        onNewThread={store.createNewThread}
        onSelectThread={store.selectThread}
        onDeleteThread={store.deleteThread}
        onSelectCapability={store.selectCapability}
        onSelectPlannedSection={store.selectPlannedSection}
        onSetTheme={store.setTheme}
      />

      <div
        className="flex-1 flex flex-col min-w-0 h-full"
        inert={store.isMobileDrawerOpen ? true : undefined}
      >
        <TopBar
          title={headerTitle}
          subtitle={headerSubtitle}
          theme={store.theme}
          isOnline={isOnline}
          isIncognito={store.isIncognito}
          canExport={canExport}
          canSearch={canSearch}
          canToggleRemember={canToggleRemember}
          isChatRemembered={isChatRemembered}
          isSearchOpen={isThreadSearchOpen}
          isDesktopSidebarOpen={store.isDesktopSidebarOpen}
          onToggleDesktopSidebar={() =>
            store.setIsDesktopSidebarOpen((prev) => !prev)
          }
          onOpenMobileDrawer={handleOpenMobileDrawer}
          onToggleTheme={store.toggleTheme}
          onToggleIncognito={store.toggleIncognito}
          onToggleChatRemember={() => {
            if (store.activeConversation && !store.isIncognito) {
              store.toggleConversationRemember(store.activeConversation.id);
            }
          }}
          onNewThread={store.createNewThread}
          onToggleSearch={() => {
            setIsThreadSearchOpen((prev) => {
              const next = !prev;
              if (!next) setThreadSearchQuery('');
              return next;
            });
          }}
          onExport={handleExport}
        />

        {store.isIncognito && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-3 px-3 sm:px-screen py-2 border-b border-accent/30 bg-accent-soft text-xs text-text-primary shrink-0"
          >
            <span className="flex items-center gap-2 min-w-0">
              <EyeOff className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
              <span>
                Incognito active — messages stay in temporary RAM only, are excluded from normal
                history and exports, and are wiped on exit. (Does not prevent browser, network, OS,
                or external speech/AI provider logging.)
              </span>
            </span>
            <button
              type="button"
              onClick={store.exitIncognito}
              className="px-2.5 py-1 rounded-[8px] bg-card border border-border text-xs font-medium text-text-primary hover:border-accent shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
            >
              Exit
            </button>
          </div>
        )}

        {!store.isIncognito && store.workspaceNotice && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-between gap-2 px-3 sm:px-screen py-2 border-b border-border bg-card-subtle text-xs text-text-primary shrink-0"
          >
            <span className="flex items-center gap-2 min-w-0">
              <Info className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
              <span>{store.workspaceNotice}</span>
            </span>
            <button
              type="button"
              onClick={() => store.setWorkspaceNotice(null)}
              aria-label="Dismiss notice"
              className="p-1 rounded-card text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent shrink-0"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {!isOnline && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-center justify-center gap-2 px-3 sm:px-screen py-2 border-b border-border bg-card-subtle text-xs text-text-primary shrink-0"
          >
            <WifiOff className="w-3.5 h-3.5 text-warning shrink-0" aria-hidden="true" />
            <span>
              You are offline. Local interface and in-memory drafting remain available; external AI
              providers require an internet connection.
            </span>
          </div>
        )}

        <main className="flex-1 flex flex-col min-h-0">
          {store.activeView.kind === 'activity' ? (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
                  Loading Activity Log…
                </div>
              }
            >
              <ActivityLogView
                entries={store.activityLogs}
                onClear={store.clearActivityLogs}
                onBackToChat={() => store.selectCapability('general-chat')}
              />
            </Suspense>
          ) : store.activeView.kind === 'settings' ? (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
                  Loading Settings &amp; Providers…
                </div>
              }
            >
              <SettingsView
                availableModels={store.availableModels}
                fallbackMode={store.fallbackMode}
                ollamaBaseUrl={store.ollamaBaseUrl}
                ollamaModelName={store.ollamaModelName}
                ollamaConfigError={store.ollamaConfigError}
                ollamaHealth={store.ollamaHealth}
                isCheckingOllama={store.isCheckingOllama}
                serverProxyStatus={store.serverProxyStatus}
                isCheckingProxy={store.isCheckingProxy}
                onSetProviderEnabled={store.setProviderEnabled}
                onUpdateOllamaConfig={store.updateOllamaConfig}
                onTestOllamaConnection={store.testOllamaConnection}
                onCheckServerProxy={store.checkServerProxy}
                onChangeFallbackMode={store.setFallbackMode}
                onSelectModelAndReturn={(modelId) => {
                  store.setSelectedModelId(modelId);
                  store.selectCapability('general-chat');
                }}
                onBackToChat={() => store.selectCapability('general-chat')}
              />
            </Suspense>
          ) : store.activeView.kind === 'memory' ? (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
                  Loading Memory Controls…
                </div>
              }
            >
              <MemoryView
                memories={store.memories}
                activeConversation={store.activeConversation}
                isIncognito={store.isIncognito}
                onAddMemory={store.addMemory}
                onUpdateMemory={store.updateMemory}
                onDeleteMemory={store.deleteMemory}
                onClearMemories={store.clearMemories}
                onToggleConversationRemember={store.toggleConversationRemember}
                onBackToChat={() => store.selectCapability('general-chat')}
              />
            </Suspense>
          ) : store.activeView.kind === 'planned-capability' ? (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
                  Loading view…
                </div>
              }
            >
              <PlannedView
                title={store.activeCapability.label}
                phaseLabel={store.activeCapability.phaseLabel}
                description={store.activeCapability.roadmapSummary}
                onBackToChat={() => store.selectCapability('general-chat')}
              />
            </Suspense>
          ) : store.activeView.kind === 'planned-section' &&
            store.activePlannedSection ? (
            <Suspense
              fallback={
                <div className="flex-1 flex items-center justify-center text-xs text-text-secondary">
                  Loading view…
                </div>
              }
            >
              <PlannedView
                title={store.activePlannedSection.label}
                phaseLabel={store.activePlannedSection.phaseLabel}
                description={store.activePlannedSection.description}
                highlights={store.activePlannedSection.plannedItems}
                onBackToChat={() => store.selectCapability('general-chat')}
              />
            </Suspense>
          ) : (
            <>
              {store.activeConversation &&
              store.activeConversation.messages.length > 0 ? (
                <ThreadView
                  conversation={store.activeConversation}
                  isSearchOpen={isThreadSearchOpen}
                  searchQuery={threadSearchQuery}
                  onSearchQueryChange={setThreadSearchQuery}
                  onCloseSearch={() => {
                    setIsThreadSearchOpen(false);
                    setThreadSearchQuery('');
                  }}
                  onToggleReaction={store.toggleMessageReaction}
                  onDeleteMessage={store.deleteMessage}
                  onRegenerateMessage={store.regenerateMessage}
                  onSaveToMemory={store.saveMessageToMemory}
                />
              ) : (
                <EmptyState
                  activeCapabilityMode={store.activeCapabilityMode}
                  selectedStarterId={store.selectedStarterId}
                  onSelectStarter={store.populateStarterPrompt}
                  onOpenSamplePreview={() =>
                    store.selectThread('thread-sample-layout')
                  }
                />
              )}

              {store.pendingFallback && (
                <div className="px-3 sm:px-screen pt-2 shrink-0">
                  <FallbackConsentCard
                    consent={store.pendingFallback}
                    onDecision={store.resolveFallbackConsent}
                  />
                </div>
              )}

              <Composer
                value={store.composerText}
                error={store.composerError}
                isSubmitting={store.isSubmitting}
                focusTick={store.composerFocusTick}
                forceSendTick={composerForceSendTick}
                conversationKey={store.activeConversation?.id ?? 'none'}
                isCompactViewport={isCompactHeight}
                shortcutStatusMessage={shortcutAnnouncement}
                availableModels={store.availableModels}
                selectedModelId={store.selectedModelId}
                fallbackMode={store.fallbackMode}
                draftAttachments={store.draftAttachments}
                attachmentError={store.attachmentError}
                onAddAttachments={store.addFileAttachments}
                onRemoveAttachment={store.removeDraftAttachment}
                onSelectModel={store.setSelectedModelId}
                onChangeFallbackMode={store.setFallbackMode}
                onStopGeneration={store.stopGeneration}
                onChange={store.updateComposerText}
                onSend={() => store.sendMessage()}
              />
            </>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
