import { describe, expect, it } from 'vitest';
import { buildContextWindow } from '../../brain/contextManager';
import type { ChatMessage } from '../../types/workspace';

describe('buildContextWindow', () => {
  it('filters out Phase 1 notice messages and builds incognito-aware system prompts', () => {
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: 'Hello', timestamp: '10:00 AM' },
      { id: '2', role: 'notice', content: 'Local notice', timestamp: '10:00 AM' },
      { id: '3', role: 'assistant', content: 'Hi there!', timestamp: '10:01 AM' },
    ];

    const normalCtx = buildContextWindow(messages, {
      contextWindowTokens: 4096,
      isIncognito: false,
    });
    expect(normalCtx.map((m) => m.role)).toEqual(['system', 'user', 'assistant']);
    expect(normalCtx[0].content).not.toContain('Incognito');

    const incognitoCtx = buildContextWindow(messages, {
      contextWindowTokens: 4096,
      isIncognito: true,
    });
    expect(incognitoCtx[0].content).toContain('Incognito');
  });

  it('trims older messages when conversation exceeds token budget while retaining latest turn', () => {
    const longOldMessage = 'A'.repeat(2400);
    const recentMessage = 'What is the summary?';
    const messages: ChatMessage[] = [
      { id: '1', role: 'user', content: longOldMessage, timestamp: '10:00 AM' },
      { id: '2', role: 'user', content: recentMessage, timestamp: '10:01 AM' },
    ];

    const ctx = buildContextWindow(messages, {
      contextWindowTokens: 768,
      reservedOutputTokens: 512,
      isIncognito: false,
    });

    expect(ctx.some((m) => m.content === recentMessage)).toBe(true);
    expect(ctx.some((m) => m.content === longOldMessage)).toBe(false);
  });
});
