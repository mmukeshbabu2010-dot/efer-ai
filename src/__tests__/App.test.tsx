import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from '../App';
import { scanForSecrets } from '../components/chat/Composer';

describe('EFER AI App integration', () => {
  it('disables Send for empty drafts and submits valid text once', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('Ask anything...');
    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    expect(sendBtn).toBeDisabled();

    await user.type(input, '   ');
    expect(sendBtn).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'Hello EFER workspace');
    expect(sendBtn).toBeEnabled();

    await user.click(sendBtn);

    await waitFor(() => {
      expect(
        within(screen.getByRole('main')).getByText('Hello EFER workspace'),
      ).toBeInTheDocument();
    });
    expect(input).toHaveValue('');
  });

  it('detects API keys and passwords in scanForSecrets and shows pre-send warning dialog', async () => {
    expect(scanForSecrets('my key is sk-test1234567890')).toContain('API Key (sk-...)');
    expect(scanForSecrets('groq: gsk_abcdefghij1234')).toContain('Groq API Key (gsk-/gsk_)');
    expect(scanForSecrets('password=supersecret')).toContain('Password or Credential Assignment');
    expect(scanForSecrets('Explain photosynthesis in three steps.')).toEqual([]);

    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('Ask anything...');
    await user.type(input, 'Here is my key sk-proj-1234567890abcd');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText(/Possible API key or password detected/i)).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Redact Secrets' }));
    expect(input).toHaveValue('Here is my key [REDACTED]');
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('enforces Incognito UI isolation, disables export, and wipes messages on exit', async () => {
    const user = userEvent.setup();
    render(<App />);

    const incognitoBtn = screen.getByRole('button', { name: 'Enable incognito mode' });
    await user.click(incognitoBtn);

    expect(incognitoBtn).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Export conversation' })).toBeDisabled();
    expect(
      screen.getByText(/Does not prevent browser, network, OS, or external speech\/AI provider logging/i),
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Ask anything...');
    await user.type(input, 'Ephemeral private question');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(() => {
      expect(screen.getByText('Ephemeral private question')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Exit incognito mode' }));

    expect(screen.queryByText('Ephemeral private question')).not.toBeInTheDocument();
    expect(
      screen.getByText(/Exited Incognito mode\. Temporary session messages were cleared/i),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export conversation' })).toBeEnabled();
  });

  it('toggles Write/Preview tabs with accessible ARIA attributes and switches themes', async () => {
    const user = userEvent.setup();
    render(<App />);

    const writeTab = screen.getByRole('tab', { name: 'Write' });
    const previewTab = screen.getByRole('tab', { name: 'Preview' });
    expect(writeTab).toHaveAttribute('aria-selected', 'true');
    expect(previewTab).toHaveAttribute('aria-selected', 'false');

    const input = screen.getByPlaceholderText('Ask anything...');
    await user.type(input, '**Bold heading**');
    await user.click(previewTab);

    expect(previewTab).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByText('Bold heading').tagName).toBe('STRONG');

    const themeToggle = screen.getByRole('button', { name: 'Switch to dark mode' });
    await user.click(themeToggle);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('handles unsupported voice input gracefully without blocking text input', async () => {
    const user = userEvent.setup();
    render(<App />);

    const voiceButton = screen.getByRole('button', { name: 'Voice input' });
    await user.click(voiceButton);

    expect(
      screen.getByText(/Web Speech API SpeechRecognition\) is not supported in this browser/i),
    ).toBeInTheDocument();

    const input = screen.getByPlaceholderText('Ask anything...');
    await user.type(input, 'Typing still works cleanly');
    expect(input).toHaveValue('Typing still works cleanly');
  });

  it('opens and dismisses mobile navigation drawer with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Open navigation menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    expect(drawer).toHaveAttribute('aria-modal', 'true');

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument();
  });

  it('streams Demo responses and prompts FallbackConsentCard before switching models', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('Ask anything...');
    await user.type(input, 'Check [[demo:rate-limit] fallback handling');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    const consentDialog = await screen.findByRole('alertdialog');
    expect(
      within(consentDialog).getByText(/Switch to EFER Demo · Fast Fallback\?/i),
    ).toBeInTheDocument();

    await user.click(within(consentDialog).getByRole('button', { name: 'Allow Once' }));

    await waitFor(
      () => {
        expect(
          within(screen.getByRole('main')).getByText(/Processed your prompt in local Phase 2 demo mode/i),
        ).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(
      within(screen.getByRole('main')).getByText(/Fallback used/i),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).getAllByText(/EFER Demo · Fast Fallback/i).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it('opens Activity Log view, inspects recorded routing trace, filters categories, and clears log', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('Ask anything...');
    await user.type(input, 'Write a TypeScript interface');
    await user.click(screen.getByRole('button', { name: 'Send message' }));

    await waitFor(
      () => {
        expect(
          within(screen.getByRole('main')).getByText(/Processed your prompt in local Phase 2 demo mode/i),
        ).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Stop generation' })).not.toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    await user.click(screen.getByRole('button', { name: /Activity Log/i }));

    const heading = await screen.findByRole('heading', { name: 'Activity Log' });
    expect(heading).toBeInTheDocument();

    expect(await screen.findByText('intent:code')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Trace \(/i }));
    expect(screen.getByText(/Classified intent as "code"/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /Fallback/i }));
    expect(screen.getByText(/No fallback entries recorded/i)).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /^All/i }));
    await user.click(screen.getByRole('button', { name: 'Clear Log' }));
    expect(screen.getByText(/No EFER Brain activity recorded yet/i)).toBeInTheDocument();
  });

  it('opens Settings & Providers, toggles Local Ollama into Composer, and updates fallback policy', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Settings & Providers/i }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Settings & Providers' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Zero Browser API Key Storage/i)).toBeInTheDocument();

    const ollamaSwitch = screen.getByRole('switch', { name: 'Enable Local Ollama' });
    expect(ollamaSwitch).toHaveAttribute('aria-checked', 'false');
    await user.click(ollamaSwitch);
    expect(ollamaSwitch).toHaveAttribute('aria-checked', 'true');

    const modelInput = screen.getByLabelText('Local Model Name');
    await user.clear(modelInput);
    await user.type(modelInput, 'mistral');
    await user.click(screen.getByRole('button', { name: 'Save Ollama Config' }));
    expect(screen.getByText(/Saved Ollama endpoint and local model name/i)).toBeInTheDocument();

    const alwaysAllowRadio = screen.getByRole('radio', { name: /Always allow/i });
    await user.click(alwaysAllowRadio);
    expect(alwaysAllowRadio).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('button', { name: 'Use in Chat' }));
    const modelBtn = screen.getByRole('button', { name: 'Select model and fallback mode' });
    expect(modelBtn).toHaveTextContent('Ollama · mistral');
  });
});
