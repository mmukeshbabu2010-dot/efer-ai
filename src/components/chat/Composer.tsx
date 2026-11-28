import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUp,
  Camera,
  Eye,
  FileText,
  Image as ImageIcon,
  Keyboard,
  Mic,
  PenLine,
  Plus,
  ShieldAlert,
  Square,
  X,
} from 'lucide-react';
import { MarkdownPreview } from '../common/MarkdownPreview';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionResultListLike {
  length: number;
  [index: number]: SpeechRecognitionResultLike;
}

interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
}

interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionInstanceLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionInstanceLike;

interface WindowWithSpeechRecognition extends Window {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
}

interface ComposerProps {
  value: string;
  error: string | null;
  isSubmitting: boolean;
  focusTick: number;
  forceSendTick: number;
  isCompactViewport: boolean;
  shortcutStatusMessage: string | null;
  onChange: (value: string) => void;
  onSend: () => void;
}

type AttachmentKind = 'Image' | 'File' | 'Camera';

interface SecretPatternRule {
  id: string;
  label: string;
  testRegex: RegExp;
  redactRegex: RegExp;
  replaceValue: (...args: string[]) => string;
}

const SECRET_PATTERN_RULES: SecretPatternRule[] = [
  {
    id: 'sk-key',
    label: 'API Key (sk-...)',
    testRegex: /\bsk-(?:ant-|proj-|or-v1-|live-|test-)?[A-Za-z0-9_-]{8,}\b/,
    redactRegex: /\bsk-(?:ant-|proj-|or-v1-|live-|test-)?[A-Za-z0-9_-]{8,}\b/g,
    replaceValue: () => '[REDACTED]',
  },
  {
    id: 'gsk-key',
    label: 'Groq API Key (gsk-/gsk_)',
    testRegex: /\bgsk[-_][A-Za-z0-9_-]{8,}\b/i,
    redactRegex: /\bgsk[-_][A-Za-z0-9_-]{8,}\b/gi,
    replaceValue: () => '[REDACTED]',
  },
  {
    id: 'google-key',
    label: 'Google / Gemini API Key (AIza...)',
    testRegex: /\bAIza[0-9A-Za-z_-]{16,}\b/,
    redactRegex: /\bAIza[0-9A-Za-z_-]{16,}\b/g,
    replaceValue: () => '[REDACTED]',
  },
  {
    id: 'github-token',
    label: 'GitHub Token (ghp_/gho_...)',
    testRegex: /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/,
    redactRegex: /\bgh[pousr]_[A-Za-z0-9_]{12,}\b/g,
    replaceValue: () => '[REDACTED]',
  },
  {
    id: 'slack-token',
    label: 'Slack Token (xox...)',
    testRegex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/,
    redactRegex: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g,
    replaceValue: () => '[REDACTED]',
  },
  {
    id: 'bearer-token',
    label: 'Bearer Authorization Token',
    testRegex: /\bBearer\s+[A-Za-z0-9._~+/-]{16,}=*/i,
    redactRegex: /(\bBearer\s+)[A-Za-z0-9._~+/-]{16,}=*/gi,
    replaceValue: (_full, prefix) => `${prefix}[REDACTED]`,
  },
  {
    id: 'private-key',
    label: 'Private Key Block',
    testRegex: /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/,
    redactRegex:
      /-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z0-9 ]*PRIVATE KEY-----|$)/g,
    replaceValue: () => '[REDACTED PRIVATE KEY]',
  },
  {
    id: 'password-or-secret',
    label: 'Password or Credential Assignment',
    testRegex:
      /(?:^|[\s,{'"`])(?:password|passwd|pwd|passphrase|secret[_-]?key|api[_-]?key|access[_-]?token)\s*(?:=|:|\bis\b)\s*(['"]?)(?!\[REDACTED\])[^\s,'"`}{]{4,}\1/i,
    redactRegex:
      /((?:^|[\s,{'"`])(?:password|passwd|pwd|passphrase|secret[_-]?key|api[_-]?key|access[_-]?token)\s*(?:=|:|\bis\b)\s*['"]?)(?!\[REDACTED\])([^\s,'"`}{]{4,})(['"]?)/gi,
    replaceValue: (_full, prefix, _secret, closingQuote) =>
      `${prefix}[REDACTED]${closingQuote ?? ''}`,
  },
];

export function scanForSecrets(text: string): string[] {
  if (!text.trim()) return [];
  return SECRET_PATTERN_RULES.filter((rule) => rule.testRegex.test(text)).map(
    (rule) => rule.label,
  );
}

function redactSensitiveText(text: string): string {
  return SECRET_PATTERN_RULES.reduce(
    (acc, rule) => acc.replace(rule.redactRegex, rule.replaceValue),
    text,
  );
}

const MIN_COMPOSER_HEIGHT = 24;
const DEFAULT_MAX_COMPOSER_HEIGHT = 200;
const COMPACT_MAX_COMPOSER_HEIGHT = 128;

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

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const win = window as WindowWithSpeechRecognition;
  return win.SpeechRecognition ?? win.webkitSpeechRecognition ?? null;
}

function joinDictationText(baseText: string, dictatedText: string): string {
  const trimmedDictation = dictatedText.trim();
  if (!trimmedDictation) return baseText;
  if (!baseText) return trimmedDictation;
  const needsSpace = !/\s$/.test(baseText);
  return `${baseText}${needsSpace ? ' ' : ''}${trimmedDictation}`;
}

export function Composer({
  value,
  error,
  isSubmitting,
  focusTick,
  forceSendTick,
  isCompactViewport,
  shortcutStatusMessage,
  onChange,
  onSend,
}: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const dictationBaseRef = useRef<string>('');
  const finalTranscriptRef = useRef<string>('');
  const onChangeRef = useRef(onChange);

  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [composerMode, setComposerMode] = useState<'write' | 'preview'>('write');
  const [attachNotice, setAttachNotice] = useState<string | null>(null);
  const [secretMatches, setSecretMatches] = useState<string[] | null>(null);
  const prevValueRef = useRef<string>(value);
  const prevForceSendTickRef = useRef<number>(forceSendTick);

  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);

  const isSpeechRecognitionSupported = getSpeechRecognitionConstructor() !== null;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const maxComposerHeight = isCompactViewport
    ? COMPACT_MAX_COMPOSER_HEIGHT
    : DEFAULT_MAX_COMPOSER_HEIGHT;

  const syncTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    const measured = textarea.scrollHeight;
    const clamped = Math.min(Math.max(measured, MIN_COMPOSER_HEIGHT), maxComposerHeight);
    textarea.style.height = `${clamped}px`;
    textarea.style.overflowY = measured > maxComposerHeight ? 'auto' : 'hidden';
  }, [maxComposerHeight]);

  const stopVoiceInput = useCallback((abort = false) => {
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        if (abort) {
          recognition.abort();
        } else {
          recognition.stop();
        }
      } catch {
        // Ignore stop errors if recognition already ended
      }
      recognitionRef.current = null;
    }
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  useEffect(() => {
    if (prevValueRef.current !== value) {
      setSecretMatches(null);
    }
    if (prevValueRef.current.trim().length > 0 && value === '') {
      setComposerMode('write');
      if (recognitionRef.current) {
        stopVoiceInput(true);
      }
    }
    prevValueRef.current = value;
  }, [value, stopVoiceInput]);

  useEffect(() => {
    if (composerMode === 'write') {
      syncTextareaHeight();
    }
  }, [value, composerMode, syncTextareaHeight]);

  useEffect(() => {
    const handleResize = () => syncTextareaHeight();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [syncTextareaHeight]);

  useEffect(() => {
    if (focusTick === 0) return;
    setComposerMode('write');
    setSecretMatches(null);
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
    if (!isAttachMenuOpen && !isShortcutsOpen && !secretMatches) return;
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
        setSecretMatches(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    window.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isAttachMenuOpen, isShortcutsOpen, secretMatches]);

  useEffect(() => {
    if (!isRecording) return;
    const interval = window.setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [isRecording]);

  useEffect(() => {
    return () => {
      stopVoiceInput(true);
    };
  }, [stopVoiceInput]);

  const handleSendAction = useCallback(
    (bypassSecretCheck = false) => {
      if (isRecording) {
        stopVoiceInput();
      }

      if (!bypassSecretCheck) {
        const matches = scanForSecrets(value);
        if (matches.length > 0) {
          setSecretMatches(matches);
          setIsAttachMenuOpen(false);
          setIsShortcutsOpen(false);
          return;
        }
      }

      setSecretMatches(null);
      onSend();
      setComposerMode('write');
    },
    [isRecording, onSend, stopVoiceInput, value],
  );

  useEffect(() => {
    if (forceSendTick === prevForceSendTickRef.current) return;
    prevForceSendTickRef.current = forceSendTick;
    handleSendAction(false);
  }, [forceSendTick, handleSendAction]);

  const handleRedactDraft = () => {
    const redacted = redactSensitiveText(value);
    onChange(redacted);
    setSecretMatches(null);
    setComposerMode('write');
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      handleSendAction();
    }
  };

  const handlePickAttachment = (kind: AttachmentKind) => {
    setIsAttachMenuOpen(false);
    setAttachNotice(
      `${kind} input is planned for Phase 7 multimodal tools. Only text prompts are recorded in Phase 1.`,
    );
  };

  const handleStartVoiceInput = () => {
    if (isRecording) {
      stopVoiceInput();
      window.requestAnimationFrame(() => textareaRef.current?.focus());
      return;
    }

    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      setVoiceNotice(
        'Voice input (Web Speech API SpeechRecognition) is not supported in this browser.',
      );
      return;
    }

    setVoiceNotice(null);
    setComposerMode('write');
    setRecordingSeconds(0);

    dictationBaseRef.current = value;
    finalTranscriptRef.current = '';

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang =
      typeof navigator !== 'undefined' && navigator.language ? navigator.language : 'en-US';

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let nextFinal = finalTranscriptRef.current;

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? '';
        if (result.isFinal) {
          nextFinal = `${nextFinal}${nextFinal && !/\s$/.test(nextFinal) ? ' ' : ''}${transcript.trim()}`;
        } else {
          interimTranscript += transcript;
        }
      }

      finalTranscriptRef.current = nextFinal;
      const combinedDictation = [nextFinal, interimTranscript.trim()]
        .filter(Boolean)
        .join(' ');
      const nextComposerValue = joinDictationText(dictationBaseRef.current, combinedDictation);
      onChangeRef.current(nextComposerValue);
    };

    recognition.onerror = (event) => {
      if (event.error === 'aborted') {
        return;
      }

      const errorMessages: Record<string, string> = {
        'not-allowed': 'Microphone permission was denied. Allow microphone access to dictate messages.',
        'service-not-allowed':
          'Speech recognition service is blocked by browser or site settings.',
        'audio-capture': 'No microphone was detected for voice input.',
        'no-speech': 'No speech was detected. Try speaking closer to your microphone.',
        network: 'Speech recognition requires an active connection to your browser speech service.',
      };

      setVoiceNotice(
        errorMessages[event.error] ?? `Voice input stopped (${event.error}).`,
      );
      stopVoiceInput(true);
    };

    recognition.onend = () => {
      recognitionRef.current = null;
      setIsRecording(false);
      setRecordingSeconds(0);
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    };

    try {
      recognitionRef.current = recognition;
      recognition.start();
      setIsRecording(true);
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    } catch {
      recognitionRef.current = null;
      setIsRecording(false);
      setVoiceNotice('Unable to start browser speech recognition.');
    }
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

        {secretMatches && (
          <div
            role="alertdialog"
            aria-labelledby="efer-secret-warning-title"
            aria-describedby="efer-secret-warning-desc"
            className="p-3.5 rounded-card bg-card border border-warning/60 shadow-sm space-y-2.5"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                <ShieldAlert className="w-4 h-4 text-warning mt-0.5 shrink-0" aria-hidden="true" />
                <div className="space-y-1 min-w-0">
                  <h3
                    id="efer-secret-warning-title"
                    className="text-xs font-semibold text-text-primary"
                  >
                    Possible API key or password detected
                  </h3>
                  <p id="efer-secret-warning-desc" className="text-xs text-text-secondary leading-relaxed">
                    Your draft contains text matching{' '}
                    <span className="font-medium text-text-primary">
                      {secretMatches.join(', ')}
                    </span>
                    . Avoid sending private credentials to external AI providers.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSecretMatches(null);
                  window.requestAnimationFrame(() => textareaRef.current?.focus());
                }}
                aria-label="Dismiss secret warning"
                className="p-1 rounded-card text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent shrink-0"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setSecretMatches(null);
                  window.requestAnimationFrame(() => textareaRef.current?.focus());
                }}
                className="h-9 sm:h-8 px-3 rounded-[10px] border border-border bg-bg text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-card-subtle transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSendAction(true)}
                className="h-9 sm:h-8 px-3 rounded-[10px] border border-border bg-card-subtle text-xs font-medium text-text-primary hover:bg-bg transition-colors focus-visible:outline-2 focus-visible:outline-accent"
              >
                Send Anyway
              </button>
              <button
                type="button"
                onClick={handleRedactDraft}
                className="h-9 sm:h-8 px-3 rounded-[10px] bg-accent hover:bg-accent-hover text-white text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Redact Secrets
              </button>
            </div>
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
            className="p-3.5 rounded-card bg-card border border-border shadow-sm space-y-2.5 max-h-[38vh] overflow-y-auto overscroll-contain"
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
          <div className="space-y-2">
            {isRecording && (
              <div
                role="status"
                aria-live="polite"
                className="flex items-center justify-between gap-3 px-2.5 py-2 rounded-[14px] bg-card-subtle border border-danger/30"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-pill bg-danger animate-pulse shrink-0"
                  />
                  <div className="flex items-center gap-1 h-4" aria-hidden="true">
                    <span
                      className="w-0.5 h-2.5 rounded-pill bg-danger efer-wave-bar"
                      style={{ animationDelay: '0ms' }}
                    />
                    <span
                      className="w-0.5 h-4 rounded-pill bg-danger efer-wave-bar"
                      style={{ animationDelay: '150ms' }}
                    />
                    <span
                      className="w-0.5 h-3 rounded-pill bg-danger efer-wave-bar"
                      style={{ animationDelay: '300ms' }}
                    />
                    <span
                      className="w-0.5 h-3.5 rounded-pill bg-danger efer-wave-bar"
                      style={{ animationDelay: '450ms' }}
                    />
                    <span
                      className="w-0.5 h-2 rounded-pill bg-danger efer-wave-bar"
                      style={{ animationDelay: '600ms' }}
                    />
                  </div>
                  <span className="text-xs font-mono tabular-nums font-medium text-text-primary">
                    {formatTimer(recordingSeconds)}
                  </span>
                  <span className="text-xs text-text-secondary truncate">
                    Listening — dictating into text field
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    stopVoiceInput();
                    window.requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className="inline-flex items-center gap-1.5 h-8 px-3 rounded-pill bg-danger text-white text-xs font-medium hover:opacity-90 active:scale-[0.98] transition-all shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-danger"
                >
                  <Square className="w-2.5 h-2.5 fill-current" aria-hidden="true" />
                  <span>Stop</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-between gap-2 px-1">
              <div
                role="tablist"
                aria-label="Composer input view"
                onKeyDown={(event) => {
                  if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                    event.preventDefault();
                    const nextMode = composerMode === 'write' ? 'preview' : 'write';
                    setComposerMode(nextMode);
                    if (nextMode === 'write') {
                      window.requestAnimationFrame(() => textareaRef.current?.focus());
                    }
                  }
                }}
                className="inline-flex items-center gap-1 p-0.5 rounded-[12px] bg-card-subtle border border-border"
              >
                <button
                  id="efer-composer-tab-write"
                  type="button"
                  role="tab"
                  aria-selected={composerMode === 'write'}
                  aria-controls="efer-composer-panel"
                  onClick={() => {
                    setComposerMode('write');
                    window.requestAnimationFrame(() => textareaRef.current?.focus());
                  }}
                  className={`inline-flex items-center gap-1.5 h-8 sm:h-7 px-2.5 rounded-[9px] text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    composerMode === 'write'
                      ? 'bg-card text-text-primary border border-border'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <PenLine className="w-3 h-3" aria-hidden="true" />
                  <span>Write</span>
                </button>
                <button
                  id="efer-composer-tab-preview"
                  type="button"
                  role="tab"
                  aria-selected={composerMode === 'preview'}
                  aria-controls="efer-composer-panel"
                  onClick={() => setComposerMode('preview')}
                  className={`inline-flex items-center gap-1.5 h-8 sm:h-7 px-2.5 rounded-[9px] text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
                    composerMode === 'preview'
                      ? 'bg-card text-text-primary border border-border'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <Eye className="w-3 h-3" aria-hidden="true" />
                  <span>Preview</span>
                </button>
              </div>

              <span className="text-[11px] font-mono text-text-secondary">
                {composerMode === 'preview' ? 'Markdown preview' : 'Markdown supported'}
              </span>
            </div>

            {composerMode === 'preview' && (
              <div
                id="efer-composer-panel"
                role="tabpanel"
                aria-labelledby="efer-composer-tab-preview"
                style={{ maxHeight: `${maxComposerHeight}px` }}
                className="overflow-y-auto overscroll-contain px-2.5 py-2 rounded-[14px] bg-bg border border-border min-h-[44px]"
              >
                <MarkdownPreview
                  content={value}
                  emptyText="Nothing to preview yet. Switch to Write to compose Markdown."
                />
              </div>
            )}

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

              {composerMode === 'write' ? (
                <div
                  id="efer-composer-panel"
                  role="tabpanel"
                  aria-labelledby="efer-composer-tab-write"
                  className="flex-1 flex"
                >
                  <label htmlFor="efer-composer-input" className="sr-only">
                    Message EFER AI. Press Enter to send, Shift+Enter for new line, Ctrl+K or
                    Cmd+K to clear and focus, or Ctrl+Enter to force send.
                  </label>
                  <textarea
                    id="efer-composer-input"
                    ref={textareaRef}
                    rows={1}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    onFocus={() => {
                      window.requestAnimationFrame(() => {
                        textareaRef.current?.scrollIntoView({ block: 'nearest' });
                      });
                    }}
                    onKeyDown={handleKeyDown}
                    aria-keyshortcuts="Control+K Meta+K Control+Enter Meta+Enter"
                    placeholder={isRecording ? 'Listening… speak now' : 'Ask anything...'}
                    className="w-full resize-none bg-transparent py-2.5 md:py-2 px-1 text-[16px] sm:text-[15px] leading-relaxed text-text-primary placeholder:text-placeholder focus:outline-none"
                  />
                </div>
              ) : (
                <div className="flex-1 py-2.5 md:py-2 px-1 text-xs text-text-secondary truncate">
                  Previewing Markdown · Click Write to edit
                </div>
              )}

              <button
                type="button"
                onClick={handleStartVoiceInput}
                aria-pressed={isRecording}
                aria-label={isRecording ? 'Stop voice input' : 'Voice input'}
                title={
                  !isSpeechRecognitionSupported
                    ? 'Voice input is not supported in this browser'
                    : isRecording
                      ? 'Stop voice input'
                      : 'Voice input'
                }
                className={`inline-flex items-center justify-center w-11 h-11 md:w-10 md:h-10 rounded-pill transition-all active:scale-[0.96] shrink-0 focus-visible:outline-2 focus-visible:outline-accent ${
                  isRecording
                    ? 'bg-danger/15 text-danger border border-danger/40'
                    : 'text-text-secondary hover:text-text-primary hover:bg-card-subtle'
                }`}
              >
                <Mic className="w-4 h-4" aria-hidden="true" />
              </button>

              <button
                type="button"
                onClick={() => handleSendAction(false)}
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
          </div>
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
