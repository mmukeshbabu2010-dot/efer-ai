import { beforeEach, describe, expect, it } from 'vitest';
import { buildContextWindow } from '../../brain/contextManager';
import {
  formatMemoriesForSystemPrompt,
  loadMemoriesFromStorage,
  MEMORY_STORAGE_KEY,
  saveMemoriesToStorage,
  searchMemories,
} from '../../brain/memoryStore';
import type { MemoryItem } from '../../brain/types';
import type { ChatMessage } from '../../types/workspace';

const SAMPLE_MEMORIES: MemoryItem[] = [
  {
    id: 'm1',
    category: 'preference',
    content: 'Prefer concise TypeScript examples with strict types.',
    createdAt: '10:00 AM',
    updatedAt: '10:00 AM',
  },
  {
    id: 'm2',
    category: 'project',
    content: 'Working on EFER AI local-first web workspace.',
    createdAt: '10:05 AM',
    updatedAt: '10:05 AM',
  },
];

describe('EFER Memory store and context isolation', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists, reloads, searches, and formats saved memories cleanly', () => {
    expect(loadMemoriesFromStorage()).toEqual([]);

    saveMemoriesToStorage(SAMPLE_MEMORIES);
    const reloaded = loadMemoriesFromStorage();
    expect(reloaded).toHaveLength(2);
    expect(reloaded[0].content).toContain('TypeScript');

    // Ignores corrupt JSON safely
    localStorage.setItem(MEMORY_STORAGE_KEY, '{not-valid-json');
    expect(loadMemoriesFromStorage()).toEqual([]);

    expect(searchMemories(SAMPLE_MEMORIES, 'typescript', 'all')).toHaveLength(1);
    expect(searchMemories(SAMPLE_MEMORIES, '', 'project')).toHaveLength(1);
    expect(formatMemoriesForSystemPrompt(SAMPLE_MEMORIES)).toContain(
      '[preference] Prefer concise TypeScript examples',
    );
  });

  it('includes memories in normal context and strictly excludes them in Incognito or paused threads', () => {
    const messages: ChatMessage[] = [
      { id: 'u1', role: 'user', content: 'Help me design an adapter', timestamp: '10:10 AM' },
    ];

    const normalCtx = buildContextWindow(messages, {
      contextWindowTokens: 4096,
      isIncognito: false,
      rememberThisChat: true,
      memories: SAMPLE_MEMORIES,
    });
    expect(normalCtx[0].role).toBe('system');
    expect(normalCtx[0].content).toContain('Prefer concise TypeScript examples');

    const pausedCtx = buildContextWindow(messages, {
      contextWindowTokens: 4096,
      isIncognito: false,
      rememberThisChat: false,
      memories: SAMPLE_MEMORIES,
    });
    expect(pausedCtx[0].content).not.toContain('Prefer concise TypeScript examples');

    const incognitoCtx = buildContextWindow(messages, {
      contextWindowTokens: 4096,
      isIncognito: true,
      rememberThisChat: true,
      memories: SAMPLE_MEMORIES,
    });
    expect(incognitoCtx[0].content).not.toContain('Prefer concise TypeScript examples');
    expect(incognitoCtx[0].content).toContain('isolated Incognito session');
  });

  it('reads ChatMessage.brainContent for file-enriched context messages', () => {
    const messages: ChatMessage[] = [
      {
        id: 'u-file',
        role: 'user',
        content: 'Summarize attached file',
        brainContent: 'Summarize attached file\n\n[Attached File: notes.md (120 bytes)]\nAlpha Beta',
        timestamp: '10:12 AM',
      },
    ];

    const ctx = buildContextWindow(messages, {
      contextWindowTokens: 4096,
      isIncognito: false,
    });
    expect(ctx[1].content).toContain('[Attached File: notes.md');
    expect(ctx[1].content).toContain('Alpha Beta');
  });
});
