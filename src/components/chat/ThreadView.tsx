import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Info,
  MoreVertical,
  RotateCcw,
  Search,
  Square,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import {
  highlightTextNodes,
  MarkdownPreview,
  stripMarkdownForSpeech,
} from '../common/MarkdownPreview';
import {
  AI_REACTION_OPTIONS,
  type ChatMessage,
  type Conversation,
  type MessageReaction,
} from '../../types/workspace';

interface ThreadViewProps {
  conversation: Conversation;
  isSearchOpen: boolean;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  onCloseSearch: () => void;
  onToggleReaction: (messageId: string, emoji: MessageReaction) => void;
  onDeleteMessage: (messageId: string) => void;
  onRegenerateMessage: (messageId: string) => void;
}

const LONG_PRESS_DURATION_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD_PX = 8;

async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback below
    }
  }

  if (typeof document === 'undefined') return false;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  let success = false;
  try {
    success = document.execCommand('copy');
  } catch {
    success = false;
  }
  document.body.removeChild(textarea);
  return success;
}

export function ThreadView({
  conversation,
  isSearchOpen,
  searchQuery,
  onSearchQueryChange,
  onCloseSearch,
  onToggleReaction,
  onDeleteMessage,
  onRegenerateMessage,
}: ThreadViewProps) {
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLElement | null>>({});
  const openMenuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef<boolean>(false);

  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const [activeMatchIndex, setActiveMatchIndex] = useState<number>(0);

  const [openMenuMessageId, setOpenMenuMessageId] = useState<string | null>(null);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const isSpeechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined';

  const stopSpeech = useCallback(() => {
    if (isSpeechSupported) {
      window.speechSynthesis.cancel();
    }
    setSpeakingMessageId(null);
  }, [isSpeechSupported]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    pointerStartRef.current = null;
  }, []);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const matchedMessageIds = useMemo(() => {
    if (!isSearchOpen || !normalizedQuery) return [];
    return conversation.messages
      .filter((msg) => msg.content.toLowerCase().includes(normalizedQuery))
      .map((msg) => msg.id);
  }, [conversation.messages, isSearchOpen, normalizedQuery]);

  const clampedMatchIndex =
    matchedMessageIds.length > 0
      ? Math.min(activeMatchIndex, matchedMessageIds.length - 1)
      : 0;
  const activeMatchedMessageId = matchedMessageIds[clampedMatchIndex] ?? null;

  useEffect(() => {
    if (!isSearchOpen) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [conversation.messages.length, isSearchOpen]);

  useEffect(() => {
    if (isSearchOpen) {
      const frame = window.requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [isSearchOpen]);

  useEffect(() => {
    setActiveMatchIndex(0);
  }, [normalizedQuery, conversation.id]);

  useEffect(() => {
    if (!activeMatchedMessageId) return;
    const target = messageRefs.current[activeMatchedMessageId];
    target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [activeMatchedMessageId, clampedMatchIndex]);

  useEffect(() => {
    stopSpeech();
    setSpeechError(null);
    setOpenMenuMessageId(null);
    setActionNotice(null);
  }, [conversation.id, stopSpeech]);

  useEffect(() => {
    if (!openMenuMessageId) return;

    const handleOutside = (event: MouseEvent) => {
      if (openMenuRef.current && !openMenuRef.current.contains(event.target as Node)) {
        setOpenMenuMessageId(null);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenMenuMessageId(null);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuMessageId]);

  useEffect(() => {
    if (!copiedMessageId && !actionNotice) return;
    const timer = window.setTimeout(() => {
      setCopiedMessageId(null);
      setActionNotice(null);
    }, 2200);
    return () => window.clearTimeout(timer);
  }, [copiedMessageId, actionNotice]);

  useEffect(() => {
    return () => {
      clearLongPressTimer();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [clearLongPressTimer]);

  const stepMatch = (direction: 1 | -1) => {
    if (matchedMessageIds.length === 0) return;
    setActiveMatchIndex((prev) => {
      const total = matchedMessageIds.length;
      return (prev + direction + total) % total;
    });
  };

  const handleSearchKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCloseSearch();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      stepMatch(event.shiftKey ? -1 : 1);
    }
  };

  const handleToggleSpeak = (messageId: string, content: string) => {
    if (!isSpeechSupported) {
      setSpeechError('Read Aloud is not supported in this browser.');
      return;
    }

    setSpeechError(null);

    if (speakingMessageId === messageId) {
      stopSpeech();
      return;
    }

    window.speechSynthesis.cancel();

    const cleanText = stripMarkdownForSpeech(content);
    if (!cleanText) {
      setSpeechError('There is no readable text in this message.');
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.onend = () => {
      setSpeakingMessageId((current) => (current === messageId ? null : current));
    };
    utterance.onerror = (event) => {
      if (event.error === 'interrupted' || event.error === 'canceled') {
        setSpeakingMessageId((current) => (current === messageId ? null : current));
        return;
      }
      setSpeakingMessageId(null);
      setSpeechError('Unable to play speech audio in this browser.');
    };

    setSpeakingMessageId(messageId);
    window.speechSynthesis.speak(utterance);
  };

  const handleCopyMessage = async (message: ChatMessage) => {
    const copied = await copyTextToClipboard(message.content);
    setOpenMenuMessageId(null);
    if (copied) {
      setCopiedMessageId(message.id);
      setActionNotice('Message copied to clipboard.');
    } else {
      setActionNotice('Clipboard access unavailable in this browser context.');
    }
  };

  const handleDeleteMessage = (messageId: string) => {
    if (speakingMessageId === messageId) {
      stopSpeech();
    }
    setOpenMenuMessageId(null);
    onDeleteMessage(messageId);
    setActionNotice('Message removed from thread.');
  };

  const handleRegenerateMessage = (messageId: string) => {
    if (speakingMessageId === messageId) {
      stopSpeech();
    }
    setOpenMenuMessageId(null);
    onRegenerateMessage(messageId);
    setActionNotice('Response refreshed.');
  };

  const createLongPressHandlers = (messageId: string) => ({
    onPointerDown: (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 && event.pointerType === 'mouse') return;
      clearLongPressTimer();
      pointerStartRef.current = { x: event.clientX, y: event.clientY };
      longPressTimerRef.current = window.setTimeout(() => {
        const selected = window.getSelection()?.toString() ?? '';
        if (selected.trim().length > 0) return;
        suppressClickRef.current = true;
        setOpenMenuMessageId(messageId);
      }, LONG_PRESS_DURATION_MS);
    },
    onPointerMove: (event: React.PointerEvent<HTMLElement>) => {
      if (!pointerStartRef.current) return;
      const dx = Math.abs(event.clientX - pointerStartRef.current.x);
      const dy = Math.abs(event.clientY - pointerStartRef.current.y);
      if (dx > LONG_PRESS_MOVE_THRESHOLD_PX || dy > LONG_PRESS_MOVE_THRESHOLD_PX) {
        clearLongPressTimer();
      }
    },
    onPointerUp: () => {
      clearLongPressTimer();
    },
    onPointerCancel: () => {
      clearLongPressTimer();
    },
    onClickCapture: (event: React.MouseEvent<HTMLElement>) => {
      if (suppressClickRef.current) {
        event.preventDefault();
        event.stopPropagation();
        suppressClickRef.current = false;
      }
    },
  });

  const handleMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    if (items.length === 0) return;

    const currentIndex = items.findIndex((item) => item === document.activeElement);
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      const next = items[(currentIndex + 1) % items.length];
      next?.focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      const prev = items[(currentIndex - 1 + items.length) % items.length];
      prev?.focus();
    }
  };

  const renderMessageMenu = (
    message: ChatMessage,
    align: 'left' | 'right',
    preferOpenDown: boolean,
  ) => {
    const isMenuOpen = openMenuMessageId === message.id;
    const isCopied = copiedMessageId === message.id;
    const canRegenerate = message.role !== 'user';

    return (
      <div
        ref={isMenuOpen ? openMenuRef : undefined}
        className="relative inline-flex items-center"
      >
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            setOpenMenuMessageId((prev) => (prev === message.id ? null : message.id));
          }}
          aria-haspopup="menu"
          aria-expanded={isMenuOpen}
          aria-label="Message actions"
          title="Message actions (or long-press message)"
          className={`inline-flex items-center justify-center w-9 h-9 sm:w-8 sm:h-8 rounded-[10px] border text-xs transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
            isMenuOpen
              ? 'bg-accent-soft border-accent text-accent'
              : 'bg-card border-border text-text-secondary hover:text-text-primary hover:bg-card-subtle'
          }`}
        >
          <MoreVertical className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        {isMenuOpen && (
          <div
            role="menu"
            aria-label="Message options"
            onKeyDown={handleMenuKeyDown}
            className={`absolute z-30 w-52 p-1.5 rounded-card bg-card border border-border shadow-lg space-y-0.5 ${
              preferOpenDown ? 'top-full mt-1.5' : 'bottom-full mb-1.5'
            } ${align === 'right' ? 'right-0' : 'left-0'}`}
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                void handleCopyMessage(message);
              }}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-text-primary hover:bg-card-subtle text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent"
            >
              {isCopied ? (
                <Check className="w-3.5 h-3.5 text-success shrink-0" aria-hidden="true" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-text-secondary shrink-0" aria-hidden="true" />
              )}
              <span>{isCopied ? 'Copied' : 'Copy message'}</span>
            </button>

            {canRegenerate && (
              <button
                type="button"
                role="menuitem"
                onClick={() => handleRegenerateMessage(message.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-text-primary hover:bg-card-subtle text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                <RotateCcw className="w-3.5 h-3.5 text-accent shrink-0" aria-hidden="true" />
                <span>Regenerate response</span>
              </button>
            )}

            <button
              type="button"
              role="menuitem"
              onClick={() => handleDeleteMessage(message.id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[10px] text-xs font-medium text-danger hover:bg-danger/10 text-left transition-colors focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Trash2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>Delete message</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const activeHighlightQuery = isSearchOpen ? searchQuery.trim() : undefined;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {isSearchOpen && (
        <div
          role="search"
          aria-label="Search current conversation"
          className="px-3 sm:px-screen py-2 border-b border-border bg-rail shrink-0"
        >
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 h-10 rounded-card bg-card border border-border focus-within:border-accent">
              <Search className="w-4 h-4 text-text-secondary shrink-0" aria-hidden="true" />
              <label htmlFor="efer-thread-search" className="sr-only">
                Search messages in current conversation
              </label>
              <input
                id="efer-thread-search"
                ref={searchInputRef}
                type="search"
                value={searchQuery}
                onChange={(event) => onSearchQueryChange(event.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder="Find in conversation..."
                className="flex-1 min-w-0 bg-transparent text-[16px] sm:text-sm text-text-primary placeholder:text-placeholder focus:outline-none"
              />
              {normalizedQuery && (
                <span
                  aria-live="polite"
                  className="text-xs font-mono tabular-nums text-text-secondary whitespace-nowrap shrink-0"
                >
                  {matchedMessageIds.length > 0
                    ? `${clampedMatchIndex + 1} / ${matchedMessageIds.length}`
                    : '0 matches'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => stepMatch(-1)}
                disabled={matchedMessageIds.length === 0}
                aria-label="Previous match"
                className="inline-flex items-center justify-center w-10 h-10 rounded-card border border-border bg-card text-text-primary hover:bg-card-subtle disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                <ChevronUp className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => stepMatch(1)}
                disabled={matchedMessageIds.length === 0}
                aria-label="Next match"
                className="inline-flex items-center justify-center w-10 h-10 rounded-card border border-border bg-card text-text-primary hover:bg-card-subtle disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                <ChevronDown className="w-4 h-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={onCloseSearch}
                aria-label="Close thread search"
                className="inline-flex items-center justify-center w-10 h-10 rounded-card border border-border bg-card text-text-secondary hover:text-text-primary hover:bg-card-subtle transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      {(speechError || actionNotice) && (
        <div className="px-3.5 sm:px-screen pt-2 shrink-0">
          <div className="max-w-3xl mx-auto space-y-2">
            {speechError && (
              <div
                role="alert"
                className="flex items-center gap-2 p-2.5 px-3 rounded-card bg-card border border-danger/40 text-xs text-danger"
              >
                <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>{speechError}</span>
              </div>
            )}

            {actionNotice && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center gap-2 p-2.5 px-3 rounded-card bg-card-subtle border border-border text-xs text-text-primary"
              >
                <Check className="w-3.5 h-3.5 text-success shrink-0" aria-hidden="true" />
                <span>{actionNotice}</span>
              </div>
            )}
          </div>
        </div>
      )}

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

          {conversation.messages.map((message, index) => {
            const isActiveMatch = activeMatchedMessageId === message.id;
            const longPressHandlers = createLongPressHandlers(message.id);
            const preferOpenDown = index === 0;

            if (message.role === 'user') {
              return (
                <article
                  key={message.id}
                  ref={(el) => {
                    messageRefs.current[message.id] = el;
                  }}
                  className="flex flex-col items-end gap-1.5"
                >
                  <div
                    {...longPressHandlers}
                    className={`max-w-[88%] sm:max-w-[75%] px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-card bg-user-surface text-user-text text-[15px] leading-relaxed whitespace-pre-wrap break-words select-text ${
                      isActiveMatch ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : ''
                    }`}
                  >
                    {highlightTextNodes(
                      message.content,
                      activeHighlightQuery,
                      message.id,
                      'inverted',
                    )}
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <time className="text-xs font-mono tabular-nums text-text-secondary">
                      {message.timestamp}
                    </time>
                    {renderMessageMenu(message, 'right', preferOpenDown)}
                  </div>
                </article>
              );
            }

            if (message.role === 'notice') {
              return (
                <article
                  key={message.id}
                  ref={(el) => {
                    messageRefs.current[message.id] = el;
                  }}
                  className="flex flex-col items-start gap-1.5"
                >
                  <div
                    {...longPressHandlers}
                    className={`w-full max-w-[92%] sm:max-w-[85%] px-4 py-3.5 rounded-card bg-card-subtle border text-sm text-text-primary leading-relaxed flex items-start gap-3 select-text ${
                      isActiveMatch ? 'border-accent ring-2 ring-accent/30' : 'border-border'
                    }`}
                  >
                    <Info className="w-4 h-4 text-warning mt-0.5 shrink-0" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-medium text-text-primary">Phase 1 — Local State Only</p>
                      <p className="text-text-secondary">
                        {highlightTextNodes(message.content, activeHighlightQuery, message.id)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-1">
                    <time className="text-xs font-mono tabular-nums text-text-secondary">
                      {message.timestamp}
                    </time>
                    {renderMessageMenu(message, 'left', preferOpenDown)}
                  </div>
                </article>
              );
            }

            const isSpeaking = speakingMessageId === message.id;
            const activeReactions = message.reactions ?? [];

            return (
              <article
                key={message.id}
                ref={(el) => {
                  messageRefs.current[message.id] = el;
                }}
                className="flex flex-col items-start gap-1.5"
              >
                <div
                  {...longPressHandlers}
                  className={`w-full max-w-[92%] sm:max-w-[85%] px-4 py-3.5 rounded-card bg-card border text-[15px] text-text-primary leading-relaxed select-text ${
                    isActiveMatch ? 'border-accent ring-2 ring-accent/30' : 'border-border'
                  }`}
                >
                  <MarkdownPreview
                    content={message.content}
                    highlightQuery={activeHighlightQuery}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <time className="text-xs font-mono tabular-nums text-text-secondary mr-1">
                    {message.timestamp}
                  </time>

                  <button
                    type="button"
                    onClick={() => handleToggleSpeak(message.id, message.content)}
                    aria-pressed={isSpeaking}
                    disabled={!isSpeechSupported}
                    title={
                      !isSpeechSupported
                        ? 'Speech synthesis is not supported in this browser'
                        : isSpeaking
                          ? 'Stop reading aloud'
                          : 'Read message aloud'
                    }
                    className={`inline-flex items-center gap-1.5 min-h-9 sm:min-h-8 px-2.5 rounded-[10px] border text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                      !isSpeechSupported
                        ? 'border-border text-text-secondary opacity-60 cursor-not-allowed'
                        : isSpeaking
                          ? 'bg-accent-soft border-accent text-accent'
                          : 'bg-card border-border text-text-secondary hover:text-text-primary hover:bg-card-subtle'
                    }`}
                  >
                    {isSpeaking ? (
                      <>
                        <Square className="w-3 h-3 fill-current shrink-0" aria-hidden="true" />
                        <span>Stop</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                        <span>Read Aloud</span>
                      </>
                    )}
                  </button>

                  <div
                    role="group"
                    aria-label="Message reactions"
                    className="inline-flex items-center gap-1"
                  >
                    {AI_REACTION_OPTIONS.map((emoji) => {
                      const isSelected = activeReactions.includes(emoji);
                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onToggleReaction(message.id, emoji)}
                          aria-pressed={isSelected}
                          aria-label={`React with ${emoji}`}
                          className={`inline-flex items-center justify-center min-w-9 min-h-9 sm:min-w-8 sm:min-h-8 px-2 rounded-[10px] border text-xs transition-all active:scale-[0.95] focus-visible:outline-2 focus-visible:outline-accent ${
                            isSelected
                              ? 'bg-accent-soft border-accent text-text-primary'
                              : 'bg-card border-border text-text-secondary hover:bg-card-subtle'
                          }`}
                        >
                          <span aria-hidden="true">{emoji}</span>
                        </button>
                      );
                    })}
                  </div>

                  {renderMessageMenu(message, 'left', preferOpenDown)}
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
    </div>
  );
}
