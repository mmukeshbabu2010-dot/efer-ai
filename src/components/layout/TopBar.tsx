import { useEffect, useRef, useState } from 'react';
import {
  Download,
  EyeOff,
  FileCode2,
  FileText,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  SquarePen,
  Sun,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { EferWordmark } from '../common/EferWordmark';
import type { ThemeMode } from '../../types/workspace';
import type { ExportFormat } from '../../utils/exportConversation';

interface TopBarProps {
  title: string;
  subtitle?: string;
  theme: ThemeMode;
  isOnline: boolean;
  isIncognito: boolean;
  canExport: boolean;
  canSearch: boolean;
  isSearchOpen: boolean;
  isDesktopSidebarOpen: boolean;
  onToggleDesktopSidebar: () => void;
  onOpenMobileDrawer: () => void;
  onToggleTheme: () => void;
  onToggleIncognito: () => void;
  onNewThread: () => void;
  onToggleSearch: () => void;
  onExport: (format: ExportFormat) => void;
}

export function TopBar({
  title,
  subtitle,
  theme,
  isOnline,
  isIncognito,
  canExport,
  canSearch,
  isSearchOpen,
  isDesktopSidebarOpen,
  onToggleDesktopSidebar,
  onOpenMobileDrawer,
  onToggleTheme,
  onToggleIncognito,
  onNewThread,
  onToggleSearch,
  onExport,
}: TopBarProps) {
  const [isExportOpen, setIsExportOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExportOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsExportOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isExportOpen]);

  return (
    <header className="flex items-center justify-between gap-2 sm:gap-3 px-3 sm:px-screen py-2.5 border-b border-border bg-bg shrink-0">
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileDrawer}
          aria-label="Open navigation menu"
          className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-card border border-border bg-card text-text-primary hover:bg-card-subtle active:scale-[0.98] transition-all shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onToggleDesktopSidebar}
          aria-label={isDesktopSidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          className="hidden md:inline-flex items-center justify-center w-10 h-10 rounded-card border border-border bg-card text-text-primary hover:bg-card-subtle transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {isDesktopSidebarOpen ? (
            <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
          ) : (
            <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
          )}
        </button>

        <div className={isDesktopSidebarOpen ? 'md:hidden' : 'block'}>
          <EferWordmark />
        </div>

        <div className="hidden sm:flex items-baseline gap-2 min-w-0">
          <h1 className="text-sm font-semibold text-text-primary truncate max-w-[200px] lg:max-w-[380px]">
            {title}
          </h1>
          {subtitle && (
            <span className="text-xs text-text-secondary whitespace-nowrap shrink-0">
              · {subtitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <div
          role="status"
          aria-live="polite"
          aria-label={
            isOnline
              ? 'Network status: Online'
              : 'Network status: Offline. Local workspace drafting remains available.'
          }
          title={
            isOnline
              ? 'Connected to network'
              : 'You are offline — local workspace UI remains available'
          }
          className={`inline-flex items-center gap-1.5 text-xs whitespace-nowrap shrink-0 px-1.5 ${
            isOnline ? 'text-text-secondary' : 'text-warning font-medium'
          }`}
        >
          {isOnline ? (
            <>
              <Wifi className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span className="hidden lg:inline">Online</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Offline</span>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleIncognito}
          aria-pressed={isIncognito}
          aria-label={isIncognito ? 'Disable incognito mode' : 'Enable incognito mode'}
          title={
            isIncognito
              ? 'Incognito mode on — bypasses localStorage, IndexedDB, and memory writes'
              : 'Enable incognito mode (bypass persistent storage and memory)'
          }
          className={`inline-flex items-center justify-center gap-2 h-11 md:h-10 min-w-11 px-2.5 sm:px-3 rounded-card border text-xs font-medium transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] ${
            isIncognito
              ? 'bg-accent-soft border-accent text-accent'
              : 'border-border bg-card text-text-primary hover:bg-card-subtle'
          }`}
        >
          <EyeOff className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="hidden lg:inline">Incognito</span>
        </button>

        {canSearch && (
          <button
            type="button"
            onClick={onToggleSearch}
            aria-expanded={isSearchOpen}
            aria-label={isSearchOpen ? 'Close thread search' : 'Search in conversation'}
            title="Search within this conversation"
            className={`inline-flex items-center justify-center gap-2 h-11 md:h-10 min-w-11 px-2.5 sm:px-3 rounded-card border text-xs font-medium transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] ${
              isSearchOpen
                ? 'bg-accent-soft border-accent text-accent'
                : 'border-border bg-card text-text-primary hover:bg-card-subtle'
            }`}
          >
            <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="hidden md:inline">Find</span>
          </button>
        )}

        <div className="relative" ref={exportMenuRef}>
          <button
            type="button"
            disabled={!canExport}
            onClick={() => setIsExportOpen((prev) => !prev)}
            aria-expanded={isExportOpen}
            aria-haspopup="menu"
            aria-label="Export conversation"
            title={
              canExport
                ? 'Export current conversation as Markdown or JSON'
                : 'Open a conversation to export'
            }
            className={`inline-flex items-center justify-center gap-2 h-11 md:h-10 min-w-11 px-2.5 sm:px-3 rounded-card border text-xs font-medium transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
              canExport
                ? 'border-border bg-card text-text-primary hover:bg-card-subtle active:scale-[0.98]'
                : 'border-border bg-card-subtle text-text-secondary opacity-60 cursor-not-allowed'
            }`}
          >
            <Download className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">Export</span>
          </button>

          {isExportOpen && canExport && (
            <div
              role="menu"
              aria-label="Export format"
              className="absolute right-0 mt-2 w-52 p-1.5 rounded-card bg-card border border-border shadow-md z-40 space-y-1"
            >
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsExportOpen(false);
                  onExport('markdown');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-left text-xs font-medium text-text-primary hover:bg-accent-soft hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Markdown (.md)</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsExportOpen(false);
                  onExport('json');
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-[12px] text-left text-xs font-medium text-text-primary hover:bg-accent-soft hover:text-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                <FileCode2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>JSON (.json)</span>
              </button>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="inline-flex items-center justify-center gap-2 h-11 md:h-10 min-w-11 px-2.5 sm:px-3 rounded-card border border-border bg-card text-xs font-medium text-text-primary hover:bg-card-subtle active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {theme === 'light' ? (
            <>
              <Moon className="w-4 h-4 text-text-secondary" aria-hidden="true" />
              <span className="hidden sm:inline">Dark</span>
            </>
          ) : (
            <>
              <Sun className="w-4 h-4 text-text-secondary" aria-hidden="true" />
              <span className="hidden sm:inline">Light</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onNewThread}
          aria-label="Start new chat"
          className="inline-flex items-center justify-center gap-2 h-11 md:h-10 min-w-11 px-3 sm:px-3.5 rounded-card bg-accent hover:bg-accent-hover active:scale-[0.98] text-white text-xs font-medium transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <SquarePen className="w-4 h-4" aria-hidden="true" />
          <span className="hidden sm:inline">New chat</span>
        </button>
      </div>
    </header>
  );
}
