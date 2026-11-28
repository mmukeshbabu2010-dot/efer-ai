import { Calendar, Code2, Lightbulb, Sparkles } from 'lucide-react';
import { STARTER_PROMPTS } from '../../brain/capabilities';
import type { StarterIconKey } from '../../types/workspace';

interface EmptyStateProps {
  selectedStarterId: string | null;
  onSelectStarter: (id: string, prompt: string) => void;
  onOpenSamplePreview: () => void;
}

function renderStarterIcon(iconKey: StarterIconKey) {
  switch (iconKey) {
    case 'poem':
      return <Sparkles className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />;
    case 'science':
      return <Lightbulb className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />;
    case 'plan':
      return <Calendar className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />;
    case 'code':
      return <Code2 className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />;
  }
}

export function EmptyState({
  selectedStarterId,
  onSelectStarter,
  onOpenSamplePreview,
}: EmptyStateProps) {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-screen py-5 sm:py-10 flex items-start sm:items-center justify-center">
      <div className="w-full max-w-2xl mx-auto space-y-5 sm:space-y-8 my-auto">
        <div className="space-y-2 sm:space-y-3 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-text-primary text-balance">
            Welcome to EFER AI
          </h2>
          <p className="text-sm sm:text-base md:text-lg text-text-secondary">
            How can I help you today?
          </p>
          <p className="text-[13px] text-text-secondary max-w-lg mx-auto leading-relaxed">
            Phase 2 · EFER Brain Demo Provider active for streaming and permission-based fallback
            testing. External provider API keys are not connected yet.
          </p>
        </div>

        <div
          role="group"
          aria-label="Starter prompts"
          className="grid grid-cols-2 gap-2.5 sm:gap-card-gap"
        >
          {STARTER_PROMPTS.map((item) => {
            const isSelected = selectedStarterId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectStarter(item.id, item.prompt)}
                className={`group text-left p-3 sm:p-4 min-h-[68px] rounded-card transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:bg-accent-soft active:border-[1.5px] active:border-accent active:scale-[0.98] ${
                  isSelected
                    ? 'bg-accent-soft border-[1.5px] border-accent'
                    : 'bg-card border border-border hover:border-accent/60'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <span className="w-8 h-8 sm:w-9 sm:h-9 rounded-[10px] sm:rounded-[12px] bg-card-subtle flex items-center justify-center shrink-0">
                    {renderStarterIcon(item.iconKey)}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[13px] sm:text-sm font-medium text-text-primary leading-snug">
                      {item.title}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={onOpenSamplePreview}
            className="inline-flex items-center justify-center min-h-10 px-3 text-xs font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Inspect sample message layout preview
          </button>
        </div>
      </div>
    </div>
  );
}
