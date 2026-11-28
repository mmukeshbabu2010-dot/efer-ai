import type { MemoryCategory, MemoryItem } from './types';

export const MEMORY_STORAGE_KEY = 'efer-memory-v1';
const MAX_STORED_MEMORIES = 200;

const VALID_CATEGORIES = new Set<MemoryCategory>([
  'preference',
  'fact',
  'project',
  'style',
]);

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function resolveDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch {
    return null;
  }
  return null;
}

function isValidMemoryItem(raw: unknown): raw is MemoryItem {
  if (typeof raw !== 'object' || raw === null) return false;
  const candidate = raw as Partial<MemoryItem>;
  return (
    typeof candidate.id === 'string' &&
    candidate.id.length > 0 &&
    typeof candidate.content === 'string' &&
    candidate.content.trim().length > 0 &&
    typeof candidate.category === 'string' &&
    VALID_CATEGORIES.has(candidate.category as MemoryCategory) &&
    typeof candidate.createdAt === 'string' &&
    typeof candidate.updatedAt === 'string'
  );
}

export function loadMemoriesFromStorage(
  storage: StorageLike | null = resolveDefaultStorage(),
): MemoryItem[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(MEMORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidMemoryItem).slice(0, MAX_STORED_MEMORIES);
  } catch {
    return [];
  }
}

export function saveMemoriesToStorage(
  items: MemoryItem[],
  storage: StorageLike | null = resolveDefaultStorage(),
): boolean {
  if (!storage) return false;
  try {
    if (items.length === 0) {
      storage.removeItem(MEMORY_STORAGE_KEY);
    } else {
      storage.setItem(
        MEMORY_STORAGE_KEY,
        JSON.stringify(items.slice(0, MAX_STORED_MEMORIES)),
      );
    }
    return true;
  } catch {
    return false;
  }
}

export function searchMemories(
  items: MemoryItem[],
  query: string,
  category: MemoryCategory | 'all' = 'all',
): MemoryItem[] {
  const normalizedQuery = query.trim().toLowerCase();
  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) {
      return false;
    }
    if (!normalizedQuery) return true;
    return (
      item.content.toLowerCase().includes(normalizedQuery) ||
      item.category.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function formatMemoriesForSystemPrompt(items: MemoryItem[]): string {
  if (items.length === 0) return '';
  const lines = items
    .slice(0, 25)
    .map((item) => `- [${item.category}] ${item.content.trim()}`);
  return [
    'User-approved workspace memories (apply when helpful; ignore if irrelevant):',
    ...lines,
  ].join('\n');
}
