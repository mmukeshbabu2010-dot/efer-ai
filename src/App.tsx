import { useEffect, useState } from 'react';
import { EyeOff, Info, WifiOff, X } from 'lucide-react';
import { Composer } from './components/chat/Composer';
import { EmptyState } from './components/chat/EmptyState';
import { ThreadView } from './components/chat/ThreadView';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { PlannedView } from './components/roadmap/PlannedView';
import { useNetworkStatus } from './hooks/useNetworkStatus';
import { useVisualViewport } from './hooks/useVisualViewport';
import { useWorkspaceStore } from './state/useWorkspaceStore';
import { downloadConversation, type ExportFormat } from './utils/exportConversation';

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

  const headerTitle =
    store.activeView.kind === 'planned-capability'
      ? store.activeCapability.label
      : store.activeView.kind === 'planned-section' && store.activePlannedSection
        ? store.activePlannedSection.label
        : store.activeConversation?.title ?? 'General Chat';

  const headerSubtitle =
    store.activeView.kind === 'planned-capability'
      ? store.activeCapability.phaseLabel
      : store.activeView.kind === 'planned-section' && store.activePlannedSection
        ? store.activePlannedSection.phaseLabel
        : store.isIncognito
          ? 'Incognito · RAM only'
          : 'General Chat';

  const canExport =
    store.activeView.kind === 'chat' &&
    store.activeConversation !== null &&
    !store.isIncognito &&
    !store.activeConversation.isIncognito;
  const canSearch =
    store.activeView.kind === 'chat' &&
    store.activeConversation !== null &&
    store.activeConversation.messages.length > 0;

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
        theme={store.theme}
        isDesktopOpen={store.isDesktopSidebarOpen}
        isMobileOpen={store.isMobileDrawerOpen}
        isIncognito={store.isIncognito}
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
          isSearchOpen={isThreadSearchOpen}
          isDesktopSidebarOpen={store.isDesktopSidebarOpen}
          onToggleDesktopSidebar={() =>
            store.setIsDesktopSidebarOpen((prev) => !prev)
          }
          onOpenMobileDrawer={handleOpenMobileDrawer}
          onToggleTheme={store.toggleTheme}
          onToggleIncognito={store.toggleIncognito}
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
          {store.activeView.kind === 'planned-capability' ? (
            <PlannedView
              title={store.activeCapability.label}
              phaseLabel={store.activeCapability.phaseLabel}
              description={store.activeCapability.roadmapSummary}
              onBackToChat={() => store.selectCapability('general-chat')}
            />
          ) : store.activeView.kind === 'planned-section' &&
            store.activePlannedSection ? (
            <PlannedView
              title={store.activePlannedSection.label}
              phaseLabel={store.activePlannedSection.phaseLabel}
              description={store.activePlannedSection.description}
              highlights={store.activePlannedSection.plannedItems}
              onBackToChat={() => store.selectCapability('general-chat')}
            />
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
                />
              ) : (
                <EmptyState
                  selectedStarterId={store.selectedStarterId}
                  onSelectStarter={store.populateStarterPrompt}
                  onOpenSamplePreview={() =>
                    store.selectThread('thread-sample-layout')
                  }
                />
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
