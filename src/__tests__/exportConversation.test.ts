import { describe, expect, it } from 'vitest';
import type { Conversation } from '../types/workspace';
import {
  buildConversationJson,
  buildConversationMarkdown,
  downloadConversation,
  filterExportableConversations,
} from '../utils/exportConversation';

const sampleNormalConversation: Conversation = {
  id: 'thread-1',
  title: 'Physics Notes',
  capabilityId: 'general-chat',
  createdAt: '10:00 AM',
  updatedAt: '10:05 AM',
  messages: [
    {
      id: 'm1',
      role: 'user',
      content: 'Explain gravity briefly.',
      timestamp: '10:01 AM',
    },
    {
      id: 'm2',
      role: 'assistant',
      content: 'Gravity curves spacetime around mass and energy.',
      timestamp: '10:01 AM',
      reactions: ['👍', '💡'],
    },
  ],
};

const sampleIncognitoConversation: Conversation = {
  ...sampleNormalConversation,
  id: 'incognito-1',
  title: 'Incognito Session',
  isIncognito: true,
};

describe('exportConversation', () => {
  it('builds Markdown and JSON exports for normal conversations', () => {
    const md = buildConversationMarkdown(sampleNormalConversation);
    expect(md).toContain('# Physics Notes');
    expect(md).toContain('## User (10:01 AM)');
    expect(md).toContain('Explain gravity briefly.');
    expect(md).toContain('_Reactions: 👍 💡_');

    const parsed = JSON.parse(buildConversationJson(sampleNormalConversation)) as {
      schema: string;
      conversation: Conversation;
    };
    expect(parsed.schema).toBe('efer-ai-conversation-v1');
    expect(parsed.conversation.id).toBe('thread-1');
  });

  it('excludes Incognito conversations from exports', () => {
    const exportable = filterExportableConversations([
      sampleNormalConversation,
      sampleIncognitoConversation,
    ]);
    expect(exportable).toHaveLength(1);
    expect(exportable[0].id).toBe('thread-1');

    expect(() => buildConversationMarkdown(sampleIncognitoConversation)).toThrow();
    expect(() => buildConversationJson(sampleIncognitoConversation)).toThrow();
    expect(() => downloadConversation(sampleIncognitoConversation, 'markdown')).toThrow();
  });
});
