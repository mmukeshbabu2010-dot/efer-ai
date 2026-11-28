import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToastViewport } from '../components/common/ToastViewport';
import { ToastProvider, useToast } from '../state/ToastContext';

function ToastTriggerHarness() {
  const { showToast, clearToasts } = useToast();

  return (
    <div>
      <button
        type="button"
        onClick={() =>
          showToast({
            title: 'Conversation exported',
            message: 'Downloaded Markdown (.md) file.',
            variant: 'success',
          })
        }
      >
        Show Success
      </button>
      <button
        type="button"
        onClick={() =>
          showToast({
            title: 'Memory updated',
            message: 'First memory notification.',
            variant: 'info',
            dedupeKey: 'memory-action',
          })
        }
      >
        Show Deduped First
      </button>
      <button
        type="button"
        onClick={() =>
          showToast({
            title: 'Memory updated',
            message: 'Second memory notification.',
            variant: 'success',
            dedupeKey: 'memory-action',
          })
        }
      >
        Show Deduped Second
      </button>
      <button
        type="button"
        onClick={() => {
          showToast({ message: 'Toast One' });
          showToast({ message: 'Toast Two' });
          showToast({ message: 'Toast Three' });
          showToast({ message: 'Toast Four' });
        }}
      >
        Show Four
      </button>
      <button
        type="button"
        onClick={() =>
          showToast({
            title: 'Request failed',
            message: 'Network timeout.',
            variant: 'error',
            durationMs: 0,
          })
        }
      >
        Show Persistent Error
      </button>
      <button type="button" onClick={clearToasts}>
        Clear All Toasts
      </button>
    </div>
  );
}

describe('ToastContext & ToastViewport', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-dismisses timed toasts and supports manual dismissal', () => {
    vi.useFakeTimers();

    render(
      <ToastProvider defaultDurationMs={3000}>
        <ToastTriggerHarness />
        <ToastViewport />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show Success' }));

    const region = screen.getByRole('region', { name: 'Notifications' });
    expect(within(region).getByText('Conversation exported')).toBeInTheDocument();
    expect(within(region).getByText('Downloaded Markdown (.md) file.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByText('Conversation exported')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Conversation exported')).not.toBeInTheDocument();

    // Manual dismiss test
    fireEvent.click(screen.getByRole('button', { name: 'Show Success' }));
    expect(screen.getByText('Conversation exported')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByText('Conversation exported')).not.toBeInTheDocument();
  });

  it('deduplicates active toasts with the same dedupeKey and bounds max visible stack', () => {
    render(
      <ToastProvider maxVisible={3}>
        <ToastTriggerHarness />
        <ToastViewport />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show Deduped First' }));
    expect(screen.getByText('First memory notification.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Show Deduped Second' }));
    expect(screen.queryByText('First memory notification.')).not.toBeInTheDocument();
    expect(screen.getByText('Second memory notification.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear All Toasts' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show Four' }));

    expect(screen.queryByText('Toast One')).not.toBeInTheDocument();
    expect(screen.getByText('Toast Two')).toBeInTheDocument();
    expect(screen.getByText('Toast Three')).toBeInTheDocument();
    expect(screen.getByText('Toast Four')).toBeInTheDocument();
  });

  it('renders error toasts with role="alert" and keeps durationMs=0 persistent until cleared', () => {
    vi.useFakeTimers();

    render(
      <ToastProvider defaultDurationMs={2000}>
        <ToastTriggerHarness />
        <ToastViewport />
      </ToastProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show Persistent Error' }));
    const alertToast = screen.getByRole('alert');
    expect(within(alertToast).getByText('Request failed')).toBeInTheDocument();
    expect(within(alertToast).getByText('Network timeout.')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Clear All Toasts' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
