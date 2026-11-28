import { useEffect, useState } from 'react';
import { EyeOff, WifiOff } from 'lucide-react';
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
  }, [store.activeConversationId, store.activeView.kind]);

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
        if (store.activeView.kind !== 'chat') return;
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
        : 'General Chat';

  const canExport =
    store.activeView.kind === 'chat' && store.activeConversation !== null;
  const canSearch =
    store.activeView.kind === 'chat' &&
    store.activeConversation !== null &&
    store.activeConversation.messages.length > 0;

  const handleExport = (format: ExportFormat) => {
    if (!store.activeConversation) return;
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
        onCloseMobile={() => store.setIsMobileDrawerOpen(false)}
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
            className="flex items-center justify-center gap-2 px-3 sm:px-screen py-2 border-b border-accent/30 bg-accent-soft text-xs text-text-primary shrink-0"
          >
            <EyeOff className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
            <span>
              Incognito mode active — conversation stays strictly in memory and bypasses persistent
              storage and long-term memory writes.
            </span>
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
