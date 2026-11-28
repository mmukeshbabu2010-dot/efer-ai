import { useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  EyeOff,
  GitBranch,
  Trash2,
} from 'lucide-react';
import { useOptionalToast } from '../../state/ToastContext';
import type { ActivityLogEntry } from '../../types/workspace';

export type ActivityFilter = 'all' | 'success' | 'fallback' | 'error';

interface ActivityLogViewProps {
  entries: ActivityLogEntry[];
  onClear: () => void;
  onBackToChat: () => void;
}

function formatTraceTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function ActivityLogView({
  entries,
  onClear,
  onBackToChat,
}: ActivityLogViewProps) {
  const toast = useOptionalToast();
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const handleClear = () => {
    onClear();
    toast?.showToast({
      message: 'Activity log cleared.',
      variant: 'info',
      dedupeKey: 'activity-clear',
    });
  };

  const counts = useMemo(() => {
    let success = 0;
    let fallback = 0;
    let error = 0;
    for (const entry of entries) {
      if (entry.outcome === 'success') success += 1;
      else if (entry.outcome === 'fallback') fallback += 1;
      else error += 1;
    }
    return {
      all: entries.length,
      success,
      fallback,
      error,
    };
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (filter === 'all') return entries;
    if (filter === 'success') return entries.filter((e) => e.outcome === 'success');
    if (filter === 'fallback') return entries.filter((e) => e.outcome === 'fallback');
    return entries.filter((e) => e.outcome === 'error' || e.outcome === 'aborted');
  }, [entries, filter]);

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const tabs: Array<{ id: ActivityFilter; label: string; count: number }> = [
    { id: 'all', label: 'All', count: counts.all },
    { id: 'success', label: 'Success', count: counts.success },
    { id: 'fallback', label: 'Fallback', count: counts.fallback },
    { id: 'error', label: 'Error', count: counts.error },
  ];

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-screen py-5 sm:py-8">
      <div className="max-w-3xl mx-auto space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-text-secondary">
              <Activity className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>EFER Brain · Routing Telemetry</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
              Activity Log
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary">
              Step-by-step routing traces recorded from actual EFER Brain turns in this session.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClear}
              disabled={entries.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-card border border-border bg-card text-xs font-medium text-text-primary hover:bg-card-subtle hover:border-danger/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Trash2 className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
              <span>Clear Log</span>
            </button>
            <button
              type="button"
              onClick={onBackToChat}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-card bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Chat</span>
            </button>
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3 rounded-card bg-card-subtle border border-border text-xs text-text-secondary">
          <EyeOff className="w-4 h-4 text-accent mt-0.5 shrink-0" aria-hidden="true" />
          <span>
            Zero simulated telemetry: entries appear only when you run requests in normal mode.
            Incognito sessions are completely excluded and leave no Activity Log entries or prompt text.
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Filter activity log entries"
          className="inline-flex flex-wrap items-center gap-1 p-1 rounded-card bg-card-subtle border border-border"
        >
          {tabs.map((tab) => {
            const isSelected = filter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                onClick={() => setFilter(tab.id)}
                className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                  isSelected
                    ? 'bg-card text-text-primary border border-border'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <span>{tab.label}</span>
                <span className="font-mono text-[11px] text-text-secondary">
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {filteredEntries.length === 0 ? (
          <div className="p-6 sm:p-8 rounded-card bg-card border border-border text-center space-y-2">
            <p className="text-sm font-medium text-text-primary">
              {entries.length === 0
                ? 'No EFER Brain activity recorded yet'
                : `No ${filter} entries recorded`}
            </p>
            <p className="text-xs text-text-secondary max-w-md mx-auto">
              {entries.length === 0
                ? 'Send or regenerate a message in a normal conversation to inspect intent detection, model selection, fallback consent, and timing traces.'
                : 'Switch filter tabs or run another request to inspect entries in this category.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Routing activity entries">
            {filteredEntries.map((entry) => {
              const isExpanded = Boolean(expandedIds[entry.id]);
              return (
                <li
                  key={entry.id}
                  className="rounded-card bg-card border border-border p-3.5 sm:p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {entry.outcome === 'success' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Success</span>
                          </span>
                        )}
                        {entry.outcome === 'fallback' && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-accent">
                            <GitBranch className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>Fallback</span>
                          </span>
                        )}
                        {(entry.outcome === 'error' || entry.outcome === 'aborted') && (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-danger">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                            <span>
                              {entry.outcome === 'aborted' ? 'Stopped' : 'Error'}
                            </span>
                          </span>
                        )}

                        <span className="text-xs font-semibold text-text-primary">
                          {entry.modelName}
                        </span>
                        <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-[6px] bg-card-subtle border border-border text-text-secondary">
                          intent:{entry.intent}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-mono text-text-secondary">
                        <span>{entry.timestamp}</span>
                        <span>provider:{entry.providerId}</span>
                        <span>{entry.latencyMs}ms</span>
                        {entry.errorCode && <span>code:{entry.errorCode}</span>}
                      </div>

                      {entry.fallbackReason && (
                        <p className="text-xs text-text-secondary">
                          Fallback reason: {entry.fallbackReason}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => toggleExpanded(entry.id)}
                      aria-expanded={isExpanded}
                      className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[9px] border border-border bg-card-subtle text-xs font-medium text-text-primary hover:border-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent"
                    >
                      <span>{isExpanded ? 'Hide trace' : `Trace (${entry.steps.length})`}</span>
                      {isExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                      )}
                    </button>
                  </div>

                  {isExpanded && (
                    <ol className="pt-2 border-t border-border space-y-1.5">
                      {entry.steps.map((step, idx) => (
                        <li
                          key={`${entry.id}-step-${idx}`}
                          className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs"
                        >
                          <span className="font-mono text-[11px] text-text-secondary shrink-0">
                            {formatTraceTime(step.timestamp)}
                          </span>
                          <span className="font-mono text-[11px] uppercase tracking-wide text-accent shrink-0">
                            [{step.stage}]
                          </span>
                          <span className="text-text-primary">{step.detail}</span>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default ActivityLogView;
