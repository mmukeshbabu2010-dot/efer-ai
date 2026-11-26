import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  Camera,
  FileText,
  Image as ImageIcon,
  Keyboard,
  Mic,
  Plus,
  Square,
  X,
} from 'lucide-react';

interface ComposerProps {
  value: string;
  error: string | null;
  isSubmitting: boolean;
  focusTick: number;
  shortcutStatusMessage: string | null;
  onChange: (value: string) => void;
  onSend: () => void;
}

type AttachmentKind = 'Image' | 'File' | 'Camera';

const MIN_COMPOSER_HEIGHT = 24;
const MAX_COMPOSER_HEIGHT = 200;

const KEYBOARD_SHORTCUTS = [
  { keys: 'Ctrl + K / Cmd + K', action: 'Clear and focus composer' },
  { keys: 'Enter', action: 'Send message' },
  { keys: 'Shift + Enter', action: 'Insert new line' },
  { keys: 'Ctrl + Enter / Cmd + Enter', action: 'Force send message' },
  { keys: 'Esc', action: 'Close open menus' },
] as const;

function formatTimer(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function Composer({
  value,
  error,
  isSubmitting,
  focusTick,
  shortcutStatusMessage,
  onChange,
  onSend,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [attachNotice, setAttachNotice] = useState<string | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const measured = textarea.scrollHeight;
    const clamped = Math.min(Math.max(measured, MIN_COMPOSER_HEIGHT), MAX_COMPOSER_HEIGHT);
    textarea.style.height = `${clamped}px`;
    textarea.style.overflowY = measured > MAX_COMPOSER_HEIGHT ? 'auto' : 'hidden';
  }, []);

  useEffect(() => {
    syncTextareaHeight();
  }, [value, syncTextareaHeight]);

  useEffect(() => {
    const handleResize = () => syncTextareaHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncTextareaHeight]);

  useEffect(() => {
    if (focusTick === 0) return;
    const frame = window.requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [focusTick]);

  useEffect(() => {
    if (!isAttachMenuOpen && !isShortcutsOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsAttachMenuOpen(false);
        setIsShortcutsOpen(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAttachMenuOpen(false);
        setIsShortcutsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isAttachMenuOpen, isShortcutsOpen]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      onSend();
    }
  };

  const handlePickAttachment = (kind: AttachmentKind) => {
    setIsAttachMenuOpen(false);
    setAttachNotice(
      `${kind} input is planned for Phase 7 multimodal tools. Only text prompts are recorded in Phase 1.`,
    );
  };

  const handleStartRecording = async () => {
    setVoiceNotice(null);
    setRecordingSeconds(0);

    if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
      } catch {
        setVoiceNotice(
          'Microphone permission unavailable — showing Phase 1 recording state preview (live voice transcription arrives in Phase 7).',
        );
      }
    } else {
      setVoiceNotice(
        'Voice transcription arrives in Phase 7 — showing Phase 1 recording UI state preview.',
      );
    }

    setIsRecording(true);
  };

  const handleStopRecording = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
    setVoiceNotice('Voice capture stopped. Live speech-to-text connects in Phase 7.');
  };

  const canSend = value.trim().length > 0 && !isSubmitting;

  return (
    <div className="px-3 sm:px-screen pt-2 pb-[max(12px,env(safe-area-inset-bottom))] bg-bg shrink-0">
      <div className="max-w-3xl mx-auto space-y-2 relative" ref={containerRef}>
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {shortcutStatusMessage ?? ''}
        </div>

        {error && (
          <div
            role="alert"
            className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-card bg-card border border-danger/40 text-xs text-danger"
          >
            <span className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{error}</span>
            </span>
          </div>
        )}

        {(attachNotice || voiceNotice) && (
          <div className="flex items-center justify-between gap-2 px-3.5 py-2 rounded-card bg-card-subtle border border-border text-xs text-text-secondary">
            <span>{attachNotice ?? voiceNotice}</span>
            <button
              type="button"
              onClick={() => {
                setAttachNotice(null);
                setVoiceNotice(null);
              }}
              aria-label="Dismiss notice"
              className="p-1.5 rounded-card text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        )}

        {isAttachMenuOpen && (
          <div
            role="dialog"
            aria-label="Attachment options"
            className="p-2 rounded-card bg-card border border-border shadow-sm grid grid-cols-3 gap-2"
          >
            <button
              type="button"
              onClick={() => handlePickAttachment('Image')}
              className="flex flex-col items-center justify-center gap-1.5 min-h-[68px] py-3 px-2 rounded-[12px] border border-border bg-bg hover:bg-accent-soft hover:border-accent active:scale-[0.98] text-xs font-medium text-text-primary transition-all focus-visible:outline-2 focus-visible:outline-accent"
            >
              <ImageIcon className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Image</span>
            </button>
            <button
              type="button"
              onClick={() => handlePickAttachment('File')}
              className="flex flex-col items-center justify-center gap-1.5 min-h-[68px] py-3 px-2 rounded-[12px] border border-border bg-bg hover:bg-accent-soft hover:border-accent active:scale-[0.98] text-xs font-medium text-text-primary transition-all focus-visible:outline-2 focus-visible:outline-accent"
            >
              <FileText className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>File</span>
            </button>
            <button
              type="button"
              onClick={() => handlePickAttachment('Camera')}
              className="flex flex-col items-center justify-center gap-1.5 min-h-[68px] py-3 px-2 rounded-[12px] border border-border bg-bg hover:bg-accent-soft hover:border-accent active:scale-[0.98] text-xs font-medium text-text-primary transition-all focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Camera className="w-4 h-4 text-accent" aria-hidden="true" />
              <span>Camera</span>
            </button>
          </div>
        )}

        {isShortcutsOpen && (
          <div
            role="dialog"
            aria-label="Keyboard shortcuts"
            className="p-3.5 rounded-card bg-card border border-border shadow-sm space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-text-primary">
                Composer Keyboard Shortcuts
              </h3>
              <button
                type="button"
                onClick={() => setIsShortcutsOpen(false)}
                aria-label="Close keyboard shortcuts"
                className="p-1 rounded-card text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
            <ul className="space-y-1.5">
              {KEYBOARD_SHORTCUTS.map((item) => (
                <li
                  key={item.keys}
                  className="flex items-center justify-between gap-4 text-xs"
                >
                  <span className="text-text-secondary">{item.action}</span>
                  <kbd className="font-mono text-[11px] px-2 py-0.5 rounded-[6px] bg-card-subtle border border-border text-text-primary whitespace-nowrap shrink-0">
                    {item.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="rounded-input bg-card border border-border focus-within:border-accent transition-colors px-2.5 sm:px-3 py-2 sm:py-2.5">
          {isRecording ? (
            <div className="flex items-center justify-between gap-3 min-h-[44px] px-1.5 sm:px-2">
              <div className="flex items-center gap-3 min-w-0">
                <span
                  aria-hidden="true"
                  className="w-2.5 h-2.5 rounded-pill bg-danger animate-pulse shrink-0"
                />
                <div className="flex items-center gap-1 h-5" aria-hidden="true">
                  <span
                    className="w-0.5 h-3 rounded-pill bg-danger efer-wave-bar"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-0.5 h-5 rounded-pill bg-danger efer-wave-bar"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-0.5 h-3.5 rounded-pill bg-danger efer-wave-bar"
                    style={{ animationDelay: '300ms' }}
                  />
                  <span
                    className="w-0.5 h-4.5 rounded-pill bg-danger efer-wave-bar"
                    style={{ animationDelay: '450ms' }}
                  />
                  <span
                    className="w-0.5 h-2.5 rounded-pill bg-danger efer-wave-bar"
                    style={{ animationDelay: '600ms' }}
                  />
                </div>
                <span className="text-xs font-mono tabular-nums font-medium text-text-primary">
                  {formatTimer(recordingSeconds)}
                </span>
                <span className="text-xs text-text-secondary truncate hidden sm:inline">
                  Listening (Phase 1 preview)
                </span>
              </div>

              <button
                type="button"
                onClick={handleStopRecording}
                className="inline-flex items-center gap-1.5 h-10 px-4 rounded-pill bg-danger text-white text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
              >
                <Square className="w-3 h-3 fill-current" aria-hidden="true" />
                <span>Stop</span>
              </button>
            </div>
          ) : (
            <div className="flex items-end gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsShortcutsOpen(false);
                  setIsAttachMenuOpen((prev) => !prev);
                }}
                aria-expanded={isAttachMenuOpen}
                aria-label="Open attachment menu"
                className={`inline-flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-pill border transition-all active:scale-[0.96] shrink-0 focus-visible:outline-2 focus-visible:outline-accent ${
                  isAttachMenuOpen
                    ? 'bg-accent-soft border-accent text-accent'
                    : 'bg-bg border-border text-text-primary hover:bg-card-subtle'
                }`}
              >
                <Plus className="w-4 h-4" aria-hidden="true" />
              </button>

              <label htmlFor="efer-composer-input" className="sr-only">
                Message EFER AI. Press Enter to send, Shift+Enter for new line, Ctrl+K or Cmd+K
                to clear and focus, or Ctrl+Enter to force send.
              </label>
              <textarea
                id="efer-composer-input"
                ref={textareaRef}
                rows={1}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                onKeyDown={handleKeyDown}
                aria-keyshortcuts="Control+K Meta+K Control+Enter Meta+Enter"
                placeholder="Ask anything..."
                className="flex-1 resize-none bg-transparent py-2.5 md:py-2 px-1 text-[16px] sm:text-[15px] leading-relaxed text-text-primary placeholder:text-placeholder focus:outline-none"
              />

              <button
                type="button"
                onClick={handleStartRecording}
                aria-label="Start voice recording"
                className="inline-flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-pill text-text-secondary hover:text-text-primary hover:bg-card-subtle active:scale-[0.96] transition-all shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Mic className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                aria-label="Send message"
                aria-keyshortcuts="Enter Control+Enter Meta+Enter"
                className={`inline-flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-pill transition-all active:scale-[0.96] shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  canSend
                    ? 'bg-accent hover:bg-accent-hover text-white'
                    : 'bg-card-subtle text-text-secondary cursor-not-allowed'
                }`}
              >
                <ArrowUp className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          )}
        </div>

        <div className="hidden sm:flex items-center justify-between gap-4 px-2 text-xs text-text-secondary">
          <span className="truncate">
            Enter send · Shift+Enter newline · Ctrl/⌘+K clear &amp; focus · Ctrl+Enter force send
          </span>
          <button
            type="button"
            onClick={() => {
              setIsAttachMenuOpen(false);
              setIsShortcutsOpen((prev) => !prev);
            }}
            aria-expanded={isShortcutsOpen}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-text-primary shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
          >
            <Keyboard className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Shortcuts</span>
          </button>
        </div>
      </div>
    </div>
  );
}
