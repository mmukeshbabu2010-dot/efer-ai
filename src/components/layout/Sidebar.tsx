import { useEffect } from 'react';
import {
  Activity,
  BookmarkCheck,
  Code2,
  FileText,
  Film,
  Image as ImageIcon,
  MessageSquare,
  Mic,
  Settings,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from 'lucide-react';
import { EFER_CAPABILITIES, EFER_PLANNED_SECTIONS } from '../../brain/capabilities';
import { EferWordmark } from '../common/EferWordmark';
import type {
  ActiveWorkspaceView,
  CapabilityId,
  Conversation,
  PlannedSectionId,
  ThemeMode,
} from '../../types/workspace';

interface SidebarProps {
  conversations: Conversation[];
  activeConversationId: string;
  activeView: ActiveWorkspaceView;
  theme: ThemeMode;
  isDesktopOpen: boolean;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  onNewThread: () => void;
  onSelectThread: (id: string) => void;
  onDeleteThread: (id: string) => void;
  onSelectCapability: (id: CapabilityId) => void;
  onSelectPlannedSection: (id: PlannedSectionId) => void;
  onSetTheme: (theme: ThemeMode) => void;
}

function renderCapabilityIcon(id: CapabilityId) {
  switch (id) {
    case 'general-chat':
      return <MessageSquare className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'code':
      return <Code2 className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'documents':
      return <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'image':
      return <ImageIcon className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'voice':
      return <Mic className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'video':
      return <Film className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'memory':
      return <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />;
  }
}

function renderSectionIcon(id: PlannedSectionId) {
  switch (id) {
    case 'settings':
      return <Settings className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'activity':
      return <Activity className="w-4 h-4 shrink-0" aria-hidden="true" />;
    case 'memory':
      return <BookmarkCheck className="w-4 h-4 shrink-0" aria-hidden="true" />;
  }
}

export function Sidebar({
  conversations,
  activeConversationId,
  activeView,
  theme,
  isDesktopOpen,
  isMobileOpen,
  onCloseMobile,
  onNewThread,
  onSelectThread,
  onDeleteThread,
  onSelectCapability,
  onSelectPlannedSection,
  onSetTheme,
}: SidebarProps) {
  useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseMobile();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMobileOpen, onCloseMobile]);

  const railContent = (
    <div className="flex flex-col h-full bg-rail text-text-primary">
      <div className="flex items-center justify-between gap-2 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 border-b border-border shrink-0">
        <EferWordmark size="lg" />
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation menu"
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-card text-text-secondary hover:text-text-primary hover:bg-card active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-accent"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      <div className="p-3 shrink-0">
        <button
          type="button"
          onClick={onNewThread}
          className="w-full flex items-center justify-center gap-2 h-11 md:h-10 px-4 rounded-card bg-card border border-border text-sm font-medium text-text-primary hover:bg-accent-soft hover:border-accent active:scale-[0.99] transition-all focus-visible:outline-2 focus-visible:outline-accent"
        >
          <SquarePen className="w-4 h-4 text-accent" aria-hidden="true" />
          <span>New conversation</span>
        </button>
      </div>

      <nav
        aria-label="Workspace navigation"
        className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4 space-y-6"
      >
        <div>
          <h2 className="px-2 pb-2 text-xs font-semibold text-text-secondary">
            Conversations
          </h2>
          <ul className="space-y-1">
            {conversations.map((thread) => {
              const isSelected =
                activeView.kind === 'chat' && thread.id === activeConversationId;
              return (
                <li key={thread.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onSelectThread(thread.id)}
                    className={`flex-1 min-w-0 flex items-center justify-between gap-2 px-2.5 py-2 rounded-card text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                      isSelected
                        ? 'bg-accent-soft text-text-primary font-medium border border-accent'
                        : 'text-text-primary hover:bg-card border border-transparent'
                    }`}
                  >
                    <span className="truncate">{thread.title}</span>
                    {thread.isSamplePreview && (
                      <span className="text-[11px] font-mono text-text-secondary shrink-0">
                        Sample
                      </span>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteThread(thread.id)}
                    aria-label={`Delete conversation ${thread.title}`}
                    className="opacity-70 md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 inline-flex items-center justify-center w-8 h-8 rounded-card text-text-secondary hover:text-danger hover:bg-card transition-all shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h2 className="px-2 pb-2 text-xs font-semibold text-text-secondary">
            Capabilities
          </h2>
          <ul className="space-y-1">
            {EFER_CAPABILITIES.map((cap) => {
              const isSelected =
                (cap.id === 'general-chat' && activeView.kind === 'chat') ||
                (activeView.kind === 'planned-capability' &&
                  activeView.capabilityId === cap.id);

              return (
                <li key={cap.id}>
                  <button
                    type="button"
                    onClick={() => onSelectCapability(cap.id)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-card text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                      isSelected
                        ? 'bg-card text-text-primary font-medium border border-border'
                        : 'text-text-primary hover:bg-card border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={
                          cap.status === 'active' ? 'text-accent' : 'text-text-secondary'
                        }
                      >
                        {renderCapabilityIcon(cap.id)}
                      </span>
                      <span className="truncate">{cap.label}</span>
                    </span>
                    <span className="text-[11px] font-mono text-text-secondary shrink-0">
                      {cap.status === 'active' ? 'Active' : 'Planned'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h2 className="px-2 pb-2 text-xs font-semibold text-text-secondary">
            EFER Brain &amp; Tools
          </h2>
          <ul className="space-y-1">
            {EFER_PLANNED_SECTIONS.map((section) => {
              const isSelected =
                activeView.kind === 'planned-section' &&
                activeView.sectionId === section.id;

              return (
                <li key={section.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPlannedSection(section.id)}
                    className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-card text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                      isSelected
                        ? 'bg-card text-text-primary font-medium border border-border'
                        : 'text-text-primary hover:bg-card border border-transparent'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="text-text-secondary">
                        {renderSectionIcon(section.id)}
                      </span>
                      <span className="truncate">{section.label}</span>
                    </span>
                    <span className="text-[11px] font-mono text-text-secondary shrink-0">
                      Planned
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>

      <div className="p-3 border-t border-border space-y-2.5 pb-[max(12px,env(safe-area-inset-bottom))]">
        <div
          role="group"
          aria-label="Appearance mode"
          className="grid grid-cols-2 gap-1.5 p-1 rounded-card bg-card-subtle border border-border"
        >
          <button
            type="button"
            onClick={() => onSetTheme('light')}
            className={`h-10 md:h-8 rounded-[12px] text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              theme === 'light'
                ? 'bg-card text-text-primary border border-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Light
          </button>
          <button
            type="button"
            onClick={() => onSetTheme('dark')}
            className={`h-10 md:h-8 rounded-[12px] text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              theme === 'dark'
                ? 'bg-card text-text-primary border border-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            Dark
          </button>
        </div>

        <p className="px-1 text-xs text-text-secondary">
          Phase 1 · In-memory workspace
        </p>
      </div>
    </div>
  );

  return (
    <>
      {isDesktopOpen && (
        <aside className="hidden md:block w-[272px] shrink-0 border-r border-border h-full">
          {railContent}
        </aside>
      )}

      {isMobileOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="md:hidden fixed inset-0 z-50 flex"
        >
          <div
            className="fixed inset-0 bg-black/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 w-[288px] max-w-[85vw] h-full border-r border-border shadow-xl">
            {railContent}
          </aside>
        </div>
      )}
    </>
  );
}
