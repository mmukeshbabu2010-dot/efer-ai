import type { ChatMessage } from '../types/workspace';
import { formatMemoriesForSystemPrompt } from './memoryStore';
import type { BrainMessage, MemoryItem } from './types';

export interface BuildContextOptions {
  contextWindowTokens: number;
  isIncognito: boolean;
  systemPrompt?: string;
  reservedOutputTokens?: number;
  memories?: MemoryItem[];
  rememberThisChat?: boolean;
  capabilityMode?: string;
}

const CHARS_PER_TOKEN_ESTIMATE = 4;

export function estimateTokenCount(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return Math.max(1, Math.ceil(cleaned.length / CHARS_PER_TOKEN_ESTIMATE));
}

export function buildDefaultSystemPrompt(
  isIncognito: boolean,
  capabilityMode?: string,
): string {
  if (isIncognito) {
    return 'You are EFER AI running in an isolated Incognito session (temporary RAM only, no cross-session memory).';
  }

  switch (capabilityMode) {
    case 'code':
      return 'You are EFER AI in Code & Engineering mode. Provide concise, accurate, security-conscious code, diagnostics, and clear technical trade-offs.';
    case 'documents':
      return 'You are EFER AI in Documents & Files mode. Analyze attached user documents faithfully and cite specific sections or data from the provided text.';
    case 'voice':
      return 'You are EFER AI in Voice Interaction mode. Give clear, natural responses that work well when read aloud.';
    default:
      return 'You are EFER AI, a clear, structured, and helpful workspace assistant.';
  }
}

export function buildContextWindow(
  messages: ChatMessage[],
  options: BuildContextOptions,
): BrainMessage[] {
  const reservedOutput = options.reservedOutputTokens ?? 512;
  const maxInputTokens = Math.max(256, options.contextWindowTokens - reservedOutput);

  const basePrompt =
    options.systemPrompt ??
    buildDefaultSystemPrompt(options.isIncognito, options.capabilityMode);

  // Privacy invariant: Incognito sessions or chats with rememberThisChat=false
  // MUST NEVER inject cross-session saved memories.
  const canInjectMemories =
    !options.isIncognito &&
    options.rememberThisChat !== false &&
    Array.isArray(options.memories) &&
    options.memories.length > 0;

  const memoryBlock = canInjectMemories
    ? formatMemoriesForSystemPrompt(options.memories!)
    : '';
  const systemContent = memoryBlock ? `${basePrompt}\n\n${memoryBlock}` : basePrompt;

  const systemTokens = estimateTokenCount(systemContent);
  let remainingBudget = Math.max(0, maxInputTokens - systemTokens);

  const conversationalMessages = messages.filter(
    (msg) => (msg.role === 'user' || msg.role === 'assistant') && msg.content.trim().length > 0,
  );

  const selected: BrainMessage[] = [];
  for (let i = conversationalMessages.length - 1; i >= 0; i -= 1) {
    const msg = conversationalMessages[i];
    const sourceContent =
      msg.brainContent && msg.brainContent.trim().length > 0
        ? msg.brainContent
        : msg.content;
    const msgTokens = estimateTokenCount(sourceContent) + 4;

    if (selected.length === 0 && msgTokens > remainingBudget && remainingBudget > 0) {
      const maxChars = remainingBudget * CHARS_PER_TOKEN_ESTIMATE;
      selected.unshift({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: sourceContent.slice(-maxChars),
      });
      remainingBudget = 0;
      break;
    }

    if (msgTokens > remainingBudget) {
      break;
    }

    selected.unshift({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: sourceContent,
    });
    remainingBudget -= msgTokens;
  }

  return [{ role: 'system', content: systemContent }, ...selected];
}
