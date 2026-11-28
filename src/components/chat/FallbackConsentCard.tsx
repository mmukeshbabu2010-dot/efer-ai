import { ShieldAlert } from 'lucide-react';
import type { FallbackDecision } from '../../brain/types';
import type { PendingFallbackConsent } from '../../types/workspace';

interface FallbackConsentCardProps {
  consent: PendingFallbackConsent;
  onDecision: (decision: FallbackDecision) => void;
}

export function FallbackConsentCard({
  consent,
  onDecision,
}: FallbackConsentCardProps) {
  return (
    <div
      role="alertdialog"
      aria-labelledby="efer-fallback-title"
      aria-describedby="efer-fallback-desc"
      className="max-w-3xl mx-auto w-full p-3.5 sm:p-4 rounded-card bg-accent-soft border border-accent shadow-sm space-y-3"
    >
      <div className="flex items-start gap-2.5">
        <ShieldAlert className="w-4 h-4 text-accent mt-0.5 shrink-0" aria-hidden="true" />
        <div className="space-y-1 min-w-0">
          <h3
            id="efer-fallback-title"
            className="text-xs sm:text-sm font-semibold text-text-primary"
          >
            Switch to {consent.toModelName}?
          </h3>
          <p
            id="efer-fallback-desc"
            className="text-xs text-text-secondary leading-relaxed"
          >
            {consent.reason} EFER Brain can switch from{' '}
            <span className="font-medium text-text-primary">{consent.fromModelName}</span> to{' '}
            <span className="font-medium text-text-primary">{consent.toModelName}</span> with your
            permission.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => onDecision('deny')}
          className="h-9 sm:h-8 px-3 rounded-[10px] border border-border bg-card text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-card-subtle transition-colors focus-visible:outline-2 focus-visible:outline-accent"
        >
          Deny
        </button>
        <button
          type="button"
          onClick={() => onDecision('allow-once')}
          className="h-9 sm:h-8 px-3 rounded-[10px] border border-border bg-card text-xs font-medium text-text-primary hover:border-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent"
        >
          Allow Once
        </button>
        <button
          type="button"
          onClick={() => onDecision('always-allow')}
          className="h-9 sm:h-8 px-3 rounded-[10px] bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Always Allow
        </button>
      </div>
    </div>
  );
}
