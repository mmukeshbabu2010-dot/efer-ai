import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useWorkspaceStore } from '../state/useWorkspaceStore';

describe('useWorkspaceStore', () => {
  it('creates and deletes normal conversations safely, restoring a fresh thread if empty', () => {
    const { result } = renderHook(() => useWorkspaceStore());
    const initialCount = result.current.conversations.length;

    act(() => {
      result.current.createNewThread();
    });

    expect(result.current.conversations.length).toBe(initialCount + 1);
    const createdId = result.current.activeConversationId;

    act(() => {
      result.current.deleteThread(createdId);
    });
    expect(result.current.conversations.length).toBe(initialCount);

    const remainingIds = result.current.conversations.map((item) => item.id);
    for (const id of remainingIds) {
      act(() => {
        result.current.deleteThread(id);
      });
    }

    expect(result.current.conversations.length).toBe(1);
    expect(result.current.conversations[0].title).toBe('New conversation');
  });

  it('isolates Incognito conversations from normal history and wipes them on exit', async () => {
    const { result } = renderHook(() => useWorkspaceStore());

    await act(async () => {
      await result.current.sendMessage('Normal workspace message');
    });

    const normalId = result.current.activeConversationId;
    const normalSnapshot = result.current.conversations.map((c) => ({
      id: c.id,
      messages: [...c.messages],
    }));

    act(() => {
      result.current.enterIncognito();
    });

    expect(result.current.isIncognito).toBe(true);
    expect(result.current.activeConversation?.isIncognito).toBe(true);
    expect(result.current.activeConversation?.messages).toHaveLength(0);

    await act(async () => {
      await result.current.sendMessage('Top secret incognito message');
    });

    expect(result.current.activeConversation?.messages).toHaveLength(2);
    expect(result.current.activeConversation?.messages[0].content).toBe(
      'Top secret incognito message',
    );
    expect(
      result.current.conversations.some((conv) =>
        conv.messages.some((msg) => msg.content.includes('Top secret incognito message')),
      ),
    ).toBe(false);

    act(() => {
      result.current.exitIncognito();
    });

    expect(result.current.isIncognito).toBe(false);
    expect(result.current.incognitoConversation).toBeNull();
    expect(result.current.activeConversationId).toBe(normalId);
    expect(result.current.conversations.map((c) => ({ id: c.id, messages: c.messages }))).toEqual(
      normalSnapshot,
    );

    // Re-entering Incognito must start completely blank with no leaked content
    act(() => {
      result.current.enterIncognito();
    });
    expect(result.current.activeConversation?.messages).toHaveLength(0);
  });

  it('prevents duplicate concurrent submissions and rejects empty messages', async () => {
    const { result } = renderHook(() => useWorkspaceStore());

    await act(async () => {
      const emptyRes = await result.current.sendMessage('   ');
      expect(emptyRes).toEqual({ ok: false, reason: 'empty' });
    });
    expect(result.current.composerError).toBe('Please enter a message before sending.');
    expect(result.current.activeConversation?.messages).toHaveLength(0);

    await act(async () => {
      const firstPromise = result.current.sendMessage('Single message');
      const secondPromise = result.current.sendMessage('Single message');
      const [first, second] = await Promise.all([firstPromise, secondPromise]);
      expect(first).toEqual({ ok: true });
      expect(second).toEqual({ ok: false, reason: 'in-flight' });
    });

    const userMessages =
      result.current.activeConversation?.messages.filter((m) => m.role === 'user') ?? [];
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0].content).toBe('Single message');
  });

  it('switches light and dark themes and updates document root class', () => {
    const { result } = renderHook(() => useWorkspaceStore());
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);

    act(() => {
      result.current.toggleTheme();
    });
    expect(result.current.theme).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    act(() => {
      result.current.setTheme('light');
    });
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
