import { useEffect, useState } from 'react';
import { Composer } from './components/chat/Composer';
import { EmptyState } from './components/chat/EmptyState';
import { ThreadView } from './components/chat/ThreadView';
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { PlannedView } from './components/roadmap/PlannedView';
import { useWorkspaceStore } from './state/useWorkspaceStore';

export function App() {
  const store = useWorkspaceStore();
  const [shortcutAnnouncement, setShortcutAnnouncement] = useState<string | null>(null);

  const { clearAndFocusComposer, sendMessage } = store;

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
        event.preventDefault();
        sendMessage();
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [clearAndFocusComposer, sendMessage]);

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

  return (
    <div className="flex h-dvh w-full bg-bg text-text-primary overflow-hidden">
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

      <div className="flex-1 flex flex-col min-w-0 h-full">
        <TopBar
          title={headerTitle}
          subtitle={headerSubtitle}
          theme={store.theme}
          isDesktopSidebarOpen={store.isDesktopSidebarOpen}
          onToggleDesktopSidebar={() =>
            store.setIsDesktopSidebarOpen((prev) => !prev)
          }
          onOpenMobileDrawer={() => store.setIsMobileDrawerOpen(true)}
          onToggleTheme={store.toggleTheme}
          onNewThread={store.createNewThread}
        />

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
                <ThreadView conversation={store.activeConversation} />
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
