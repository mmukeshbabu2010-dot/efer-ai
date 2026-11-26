import { Menu, Moon, PanelLeftClose, PanelLeftOpen, SquarePen, Sun } from 'lucide-react';
import { EferWordmark } from '../common/EferWordmark';
import type { ThemeMode } from '../../types/workspace';

interface TopBarProps {
  title: string;
  subtitle?: string;
  theme: ThemeMode;
  isDesktopSidebarOpen: boolean;
  onToggleDesktopSidebar: () => void;
  onOpenMobileDrawer: () => void;
  onToggleTheme: () => void;
  onNewThread: () => void;
}

export function TopBar({
  title,
  subtitle,
  theme,
  isDesktopSidebarOpen,
  onToggleDesktopSidebar,
  onOpenMobileDrawer,
  onToggleTheme,
  onNewThread,
}: TopBarProps) {
  return (
    <header className="flex items-center justify-between gap-3 px-3 sm:px-screen py-2.5 border-b border-border bg-bg shrink-0">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
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
          <h1 className="text-sm font-semibold text-text-primary truncate max-w-[260px] lg:max-w-[420px]">
            {title}
          </h1>
          {subtitle && (
            <span className="text-xs text-text-secondary whitespace-nowrap shrink-0">
              · {subtitle}
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
          className="inline-flex items-center justify-center gap-2 h-11 md:h-10 min-w-11 px-3 rounded-card border border-border bg-card text-xs font-medium text-text-primary hover:bg-card-subtle active:scale-[0.98] transition-all whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
          <span className="hidden xs:inline sm:inline">New chat</span>
        </button>
      </div>
    </header>
  );
}
