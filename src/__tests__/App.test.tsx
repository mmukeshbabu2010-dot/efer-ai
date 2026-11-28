import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BYOK_STORAGE_KEY } from '../brain/adapters/ClientByokAdapter';
import { App } from '../App';
import { scanForSecrets } from '../components/chat/Composer';

describe('EFER AI App integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });
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
          within(screen.getByRole('main')).getByText(/Processed your prompt in local Demo mode/i),
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
          within(screen.getByRole('main')).getByText(/Processed your prompt in local Demo mode/i),
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
    expect(
      within(screen.getByRole('region', { name: 'Notifications' })).getByText('Activity log cleared.'),
    ).toBeInTheDocument();
  });

  it('opens Settings & Providers, toggles Local Ollama into Composer, and updates fallback policy', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Settings & Providers/i }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Settings & Providers' }),
    ).toBeInTheDocument();
    expect(await screen.findByText(/Browser BYOK & Server Proxy Boundary/i)).toBeInTheDocument();

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
    expect(
      within(screen.getByRole('region', { name: 'Notifications' })).getByText(
        /Fallback policy set to Always allow/i,
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Use in Chat' }));
    const modelBtn = screen.getByRole('button', { name: 'Select model and fallback mode' });
    expect(modelBtn).toHaveTextContent('Ollama · mistral');
  });

  it('adds, tests, masks, toggles, and uses a Custom API (BYOK) in Settings & Composer', async () => {
    const user = userEvent.setup();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    try {
      render(<App />);

      await user.click(screen.getByRole('button', { name: /Settings & Providers/i }));
      expect(await screen.findByText(/Your Custom APIs \(BYOK\)/i)).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Add Custom API/i }));

      const byokForm = screen.getByRole('form', { name: 'Custom API configuration' });
      await user.selectOptions(within(byokForm).getByLabelText('Quick Preset'), 'groq');
      expect(within(byokForm).getByLabelText('Base URL')).toHaveValue(
        'https://api.groq.com/openai/v1',
      );

      await user.type(within(byokForm).getByLabelText('Display Name'), 'My Groq Key');
      await user.type(within(byokForm).getByLabelText('Model ID'), 'llama-3.3-70b-versatile');

      const keyInput = within(byokForm).getByLabelText('API Key');
      expect(keyInput).toHaveAttribute('type', 'password');
      await user.type(keyInput, 'gsk_demo_secret_89a2');
      await user.click(within(byokForm).getByRole('button', { name: 'Show API key' }));
      expect(keyInput).toHaveAttribute('type', 'text');

      await user.click(within(byokForm).getByRole('button', { name: 'Think' }));

      await user.click(within(byokForm).getByRole('button', { name: 'Test Connection' }));
      expect(await within(byokForm).findByText('Connected')).toBeInTheDocument();

      await user.click(within(byokForm).getByRole('button', { name: 'Save Custom API' }));

      const savedList = screen.getByRole('list', { name: 'Saved custom APIs' });
      expect(within(savedList).getByText('My Groq Key')).toBeInTheDocument();
      expect(within(savedList).getByText(/••••89a2/)).toBeInTheDocument();
      expect(within(savedList).getByText('Think')).toBeInTheDocument();
      expect(localStorage.getItem(BYOK_STORAGE_KEY)).toContain('My Groq Key');

      const byokSwitch = within(savedList).getByRole('switch', {
        name: 'Toggle My Groq Key',
      });
      expect(byokSwitch).toHaveAttribute('aria-checked', 'true');

      await user.click(within(savedList).getByRole('button', { name: 'Use in Chat' }));
      const modelBtn = screen.getByRole('button', { name: 'Select model and fallback mode' });
      expect(modelBtn).toHaveTextContent('My Groq Key');
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it('filters saved BYOK providers and local models in Settings & Providers by name or capability tag', async () => {
    localStorage.setItem(
      BYOK_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'byok-groq-think',
          presetId: 'groq',
          displayName: 'Groq Reasoning',
          baseUrl: 'https://api.groq.com/openai/v1',
          modelId: 'deepseek-r1-distill-llama-70b',
          apiKey: 'gsk_test_1111',
          capabilities: ['chat', 'think'],
          enabled: true,
          createdAt: '2026-11-28T00:00:00.000Z',
          updatedAt: '2026-11-28T00:00:00.000Z',
        },
        {
          id: 'byok-fal-media',
          presetId: 'fal',
          displayName: 'Fal Studio',
          baseUrl: 'https://fal.run',
          modelId: 'fal-ai/flux/schnell',
          apiKey: 'fal_test_2222',
          capabilities: ['image', 'video'],
          enabled: true,
          createdAt: '2026-11-28T00:00:00.000Z',
          updatedAt: '2026-11-28T00:00:00.000Z',
        },
      ]),
    );

    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Settings & Providers/i }));

    const searchInput = await screen.findByLabelText(
      'Search saved BYOK providers and local models',
    );
    const savedList = screen.getByRole('list', { name: 'Saved custom APIs' });
    expect(within(savedList).getByText('Groq Reasoning')).toBeInTheDocument();
    expect(within(savedList).getByText('Fal Studio')).toBeInTheDocument();
    expect(screen.getByText('Local Ollama')).toBeInTheDocument();

    // Filter by capability tag: video -> only Fal Studio matches
    await user.type(searchInput, 'video');
    expect(within(savedList).queryByText('Groq Reasoning')).not.toBeInTheDocument();
    expect(within(savedList).getByText('Fal Studio')).toBeInTheDocument();
    expect(screen.queryByText('Local Ollama')).not.toBeInTheDocument();
    expect(screen.getByText(/No local or built-in providers match/i)).toBeInTheDocument();

    // Clear and filter by local model / provider name: ollama
    await user.click(screen.getByRole('button', { name: 'Clear model search' }));
    await user.type(searchInput, 'ollama');
    expect(screen.getByText('Local Ollama')).toBeInTheDocument();
    expect(screen.queryByText('EFER Demo Provider')).not.toBeInTheDocument();
    expect(screen.getByText(/No saved custom APIs match/i)).toBeInTheDocument();

    // Clear and filter by capability tag shared across BYOK + local: think
    await user.clear(searchInput);
    await user.type(searchInput, 'think');
    const updatedSavedList = screen.getByRole('list', { name: 'Saved custom APIs' });
    expect(within(updatedSavedList).getByText('Groq Reasoning')).toBeInTheDocument();
    expect(within(updatedSavedList).queryByText('Fal Studio')).not.toBeInTheDocument();
    expect(screen.getByText('Local Ollama')).toBeInTheDocument();

    // Clear restores all providers cleanly
    await user.click(screen.getByRole('button', { name: 'Clear model search' }));
    expect(within(screen.getByRole('list', { name: 'Saved custom APIs' })).getByText('Fal Studio')).toBeInTheDocument();
    expect(screen.getByText('EFER Demo Provider')).toBeInTheDocument();
  });


  it('opens Memory Controls, adds/searches/deletes saved memories, and enforces per-chat privacy switch', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Memory Controls/i }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Memory Controls' }),
    ).toBeInTheDocument();

    const memoryInput = screen.getByLabelText('Add a saved preference or fact');
    await user.type(memoryInput, 'Always format outputs with clear checklists.');
    await user.click(screen.getByRole('button', { name: 'Save Memory' }));

    expect(
      await screen.findByText('Always format outputs with clear checklists.'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Notifications' })).getByText('Memory updated'),
    ).toBeInTheDocument();

    const rememberSwitch = screen.getByRole('switch', { name: 'Remember this chat' });
    expect(rememberSwitch).toHaveAttribute('aria-checked', 'true');
    await user.click(rememberSwitch);
    expect(rememberSwitch).toHaveAttribute('aria-checked', 'false');

    const searchInput = screen.getByLabelText('Search saved memories');
    await user.type(searchInput, 'unmatched-term');
    expect(screen.getByText(/No memories match your search filter/i)).toBeInTheDocument();

    await user.clear(searchInput);
    await user.click(screen.getByRole('button', { name: 'Delete memory' }));
    expect(screen.getByText(/No saved memories yet/i)).toBeInTheDocument();
  });

  it('shows Conversation exported toast notification and allows dismissing it', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Export conversation' }));
    await user.click(screen.getByRole('menuitem', { name: /Markdown/i }));

    const notifications = screen.getByRole('region', { name: 'Notifications' });
    expect(within(notifications).getByText('Conversation exported')).toBeInTheDocument();
    expect(within(notifications).getByText(/Downloaded Markdown \(\.md\) file/i)).toBeInTheDocument();

    await user.click(within(notifications).getByRole('button', { name: 'Dismiss notification' }));
    expect(screen.queryByRole('region', { name: 'Notifications' })).not.toBeInTheDocument();
  });

  it('attaches a local text file in Composer and sends it into the thread', async () => {
    const user = userEvent.setup();
    render(<App />);

    const fileInput = screen.getByLabelText('Attach text document') as HTMLInputElement;
    const sampleFile = new File(['Hello from local README snippet'], 'notes.txt', {
      type: 'text/plain',
    });
    await user.upload(fileInput, sampleFile);

    expect(await screen.findByText('notes.txt')).toBeInTheDocument();

    const sendBtn = screen.getByRole('button', { name: 'Send message' });
    expect(sendBtn).toBeEnabled();
    await user.click(sendBtn);

    await waitFor(() => {
      const main = screen.getByRole('main');
      expect(within(main).getByText(/Please review the attached file\(s\): notes\.txt/i)).toBeInTheDocument();
      expect(within(main).getByText('notes.txt')).toBeInTheDocument();
    });
  });

  it('blocks unsafe javascript: links and credentialed URLs inside Markdown preview', async () => {
    const user = userEvent.setup();
    render(<App />);

    const input = screen.getByPlaceholderText('Ask anything...');
    fireEvent.change(input, {
      target: {
        value:
          '[Click XSS](javascript:alert(1)) and [Creds](https://user:pass@example.com) and [Safe](https://example.com)',
      },
    });
    await user.click(screen.getByRole('tab', { name: 'Preview' }));

    expect(screen.queryByRole('link', { name: 'Click XSS' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Creds' })).not.toBeInTheDocument();
    const safeLink = screen.getByRole('link', { name: 'Safe' });
    expect(safeLink).toHaveAttribute('href', 'https://example.com');
    expect(safeLink).toHaveAttribute('rel', 'noopener noreferrer nofollow');
  });
});
