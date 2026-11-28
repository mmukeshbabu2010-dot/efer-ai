import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToast } from '../../state/ToastContext';
import type { ToastVariant } from '../../types/toast';

function getVariantPresentation(variant: ToastVariant) {
  switch (variant) {
    case 'success':
      return {
        Icon: CheckCircle2,
        iconClass: 'text-success',
        borderClass: 'border-border',
        role: 'status' as const,
      };
    case 'warning':
      return {
        Icon: AlertTriangle,
        iconClass: 'text-warning',
        borderClass: 'border-warning/40',
        role: 'status' as const,
      };
    case 'error':
      return {
        Icon: AlertCircle,
        iconClass: 'text-danger',
        borderClass: 'border-danger/40',
        role: 'alert' as const,
      };
    case 'info':
    default:
      return {
        Icon: Info,
        iconClass: 'text-accent',
        borderClass: 'border-border',
        role: 'status' as const,
      };
  }
}

export function ToastViewport() {
  const { toasts, dismissToast } = useToast();

  if (toasts.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Notifications"
      aria-live="polite"
      aria-atomic="false"
      className="fixed z-50 top-16 left-3 right-3 sm:top-auto sm:left-auto sm:bottom-6 sm:right-6 sm:w-[360px] flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => {
        const { Icon, iconClass, borderClass, role } = getVariantPresentation(toast.variant);
        return (
          <div
            key={toast.id}
            role={role}
            className={`efer-toast-enter pointer-events-auto flex items-start gap-2.5 px-3.5 py-2.5 rounded-card bg-card border shadow-md text-xs text-text-primary ${borderClass}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${iconClass}`} aria-hidden="true" />
            <div className="flex-1 min-w-0 space-y-0.5 leading-relaxed">
              {toast.title && (
                <p className="font-semibold text-text-primary">{toast.title}</p>
              )}
              <p className="text-text-secondary break-words">{toast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
              className="inline-flex items-center justify-center w-7 h-7 -mr-1 -mt-0.5 rounded-[8px] text-text-secondary hover:text-text-primary hover:bg-card-subtle transition-colors shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </section>
  );
}
