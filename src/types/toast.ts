export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface ToastOptions {
  title?: string;
  message: string;
  variant?: ToastVariant;
  /** Duration in milliseconds before auto-dismiss. Set to 0 to disable auto-dismiss. */
  durationMs?: number;
  /** Optional key to deduplicate/replace an existing active toast in place. */
  dedupeKey?: string;
}

export interface ToastItem {
  id: string;
  title?: string;
  message: string;
  variant: ToastVariant;
  durationMs: number;
  dedupeKey?: string;
  createdAt: number;
}
