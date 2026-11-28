import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { ToastItem, ToastOptions } from '../types/toast';

export const DEFAULT_TOAST_DURATION_MS = 3600;
export const MAX_VISIBLE_TOASTS = 3;

export interface ToastContextValue {
  toasts: ToastItem[];
  showToast: (options: ToastOptions) => string;
  dismissToast: (id: string) => void;
  clearToasts: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export interface ToastProviderProps {
  children: ReactNode;
  defaultDurationMs?: number;
  maxVisible?: number;
}

export function ToastProvider({
  children,
  defaultDurationMs = DEFAULT_TOAST_DURATION_MS,
  maxVisible = MAX_VISIBLE_TOASTS,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timersRef = useRef<Map<string, number>>(new Map());
  const seqRef = useRef<number>(0);

  const clearTimerFor = useCallback((id: string) => {
    const existing = timersRef.current.get(id);
    if (existing !== undefined) {
      window.clearTimeout(existing);
      timersRef.current.delete(id);
    }
  }, []);

  const dismissToast = useCallback(
    (id: string) => {
      clearTimerFor(id);
      setToasts((prev) => prev.filter((item) => item.id !== id));
    },
    [clearTimerFor],
  );

  const clearToasts = useCallback(() => {
    for (const timerId of timersRef.current.values()) {
      window.clearTimeout(timerId);
    }
    timersRef.current.clear();
    setToasts([]);
  }, []);

  const scheduleAutoDismiss = useCallback(
    (id: string, durationMs: number) => {
      clearTimerFor(id);
      if (durationMs <= 0) return;
      const timerId = window.setTimeout(() => {
        timersRef.current.delete(id);
        setToasts((prev) => prev.filter((item) => item.id !== id));
      }, durationMs);
      timersRef.current.set(id, timerId);
    },
    [clearTimerFor],
  );

  const showToast = useCallback(
    (options: ToastOptions): string => {
      const variant = options.variant ?? 'info';
      const durationMs =
        typeof options.durationMs === 'number' && Number.isFinite(options.durationMs)
          ? Math.max(0, options.durationMs)
          : defaultDurationMs;

      seqRef.current += 1;
      const nextId = `toast-${Date.now()}-${seqRef.current}`;
      const createdAt = Date.now();
      let resolvedId = nextId;

      setToasts((prev) => {
        if (options.dedupeKey) {
          const matchIndex = prev.findIndex((item) => item.dedupeKey === options.dedupeKey);
          if (matchIndex !== -1) {
            const existing = prev[matchIndex];
            resolvedId = existing.id;
            const updated: ToastItem = {
              id: existing.id,
              title: options.title,
              message: options.message,
              variant,
              durationMs,
              dedupeKey: options.dedupeKey,
              createdAt,
            };
            const withoutMatch = prev.filter((_, idx) => idx !== matchIndex);
            scheduleAutoDismiss(existing.id, durationMs);
            return [...withoutMatch, updated];
          }
        }

        const nextItem: ToastItem = {
          id: nextId,
          title: options.title,
          message: options.message,
          variant,
          durationMs,
          dedupeKey: options.dedupeKey,
          createdAt,
        };

        const combined = [...prev, nextItem];
        if (combined.length > maxVisible) {
          const evicted = combined.slice(0, combined.length - maxVisible);
          for (const item of evicted) {
            clearTimerFor(item.id);
          }
          scheduleAutoDismiss(nextId, durationMs);
          return combined.slice(-maxVisible);
        }

        scheduleAutoDismiss(nextId, durationMs);
        return combined;
      });

      return resolvedId;
    },
    [clearTimerFor, defaultDurationMs, maxVisible, scheduleAutoDismiss],
  );

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      for (const timerId of timers.values()) {
        window.clearTimeout(timerId);
      }
      timers.clear();
    };
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toasts,
      showToast,
      dismissToast,
      clearToasts,
    }),
    [toasts, showToast, dismissToast, clearToasts],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within a ToastProvider.');
  }
  return ctx;
}

export function useOptionalToast(): ToastContextValue | null {
  return useContext(ToastContext);
}
