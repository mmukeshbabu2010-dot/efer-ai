import { ArrowLeft, Layers } from 'lucide-react';

interface PlannedViewProps {
  title: string;
  phaseLabel: string;
  description: string;
  highlights?: string[];
  onBackToChat: () => void;
}

export function PlannedView({
  title,
  phaseLabel,
  description,
  highlights,
  onBackToChat,
}: PlannedViewProps) {
  return (
    <div className="flex-1 overflow-y-auto px-screen py-8 md:py-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-card p-6 md:p-8 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-mono text-text-secondary">{phaseLabel}</p>
              <h2 className="text-2xl font-semibold text-text-primary tracking-tight">
                {title}
              </h2>
            </div>
            <div className="w-10 h-10 rounded-card bg-accent-soft flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5 text-accent" aria-hidden="true" />
            </div>
          </div>

          <p className="text-sm md:text-base text-text-secondary leading-relaxed">
            {description}
          </p>

          {highlights && highlights.length > 0 && (
            <div className="pt-2 border-t border-border space-y-2.5">
              <h3 className="text-xs font-semibold text-text-secondary">
                Planned scope
              </h3>
              <ul className="space-y-2 text-sm text-text-primary">
                {highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="mt-2 w-1.5 h-1.5 rounded-pill bg-accent shrink-0"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="pt-2">
            <button
              type="button"
              onClick={onBackToChat}
              className="inline-flex items-center gap-2 h-10 px-4 rounded-card bg-accent hover:bg-accent-hover text-accent-text text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
              <span>Return to General Chat</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
