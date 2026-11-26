import { useEffect, useRef } from 'react';
import { Info } from 'lucide-react';
import type { Conversation } from '../../types/workspace';

interface ThreadViewProps {
  conversation: Conversation;
}

export function ThreadView({ conversation }: ThreadViewProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [conversation.messages.length]);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-screen py-4 sm:py-6 md:py-8">
      <div className="max-w-3xl mx-auto space-y-4 sm:space-y-5">
        {conversation.isSamplePreview && (
          <div className="flex items-start gap-3 p-3 sm:p-3.5 rounded-card bg-card-subtle border border-border text-[13px] sm:text-sm text-text-secondary">
            <Info className="w-4 h-4 text-accent mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              This is a static layout preview for Phase 1 UI verification. No external AI provider
              is connected yet.
            </span>
          </div>
        )}

        {conversation.messages.map((message) => {
          if (message.role === 'user') {
            return (
              <article key={message.id} className="flex flex-col items-end gap-1.5">
                <div className="max-w-[88%] sm:max-w-[75%] px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-card bg-user-surface text-user-text text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                  {message.content}
                </div>
                <time className="text-xs font-mono tabular-nums text-text-secondary px-1">
                  {message.timestamp}
                </time>
              </article>
            );
          }

          if (message.role === 'notice') {
            return (
              <article key={message.id} className="flex flex-col items-start gap-1.5">
                <div className="w-full max-w-[92%] sm:max-w-[85%] px-4 py-3.5 rounded-card bg-card-subtle border border-border text-sm text-text-primary leading-relaxed flex items-start gap-3">
                  <Info className="w-4 h-4 text-warning mt-0.5 shrink-0" aria-hidden="true" />
                  <div className="space-y-1">
                    <p className="font-medium text-text-primary">Phase 1 — Local State Only</p>
                    <p className="text-text-secondary">{message.content}</p>
                  </div>
                </div>
                <time className="text-xs font-mono tabular-nums text-text-secondary px-1">
                  {message.timestamp}
                </time>
              </article>
            );
          }

          return (
            <article key={message.id} className="flex flex-col items-start gap-1.5">
              <div className="w-full max-w-[92%] sm:max-w-[85%] px-4 py-3.5 rounded-card bg-card border border-border text-[15px] text-text-primary leading-relaxed whitespace-pre-wrap break-words">
                {message.content}
              </div>
              <div className="flex items-center gap-3 px-1">
                <time className="text-xs font-mono tabular-nums text-text-secondary">
                  {message.timestamp}
                </time>
              </div>
            </article>
          );
        })}

        <p className="pt-2 text-[13px] text-text-secondary">
          EFER AI Phase 1 preview — verify important info once providers are connected in Phase 2.
        </p>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
