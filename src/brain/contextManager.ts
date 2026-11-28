import type { ChatMessage } from '../types/workspace';
import type { BrainMessage } from './types';

export interface BuildContextOptions {
  contextWindowTokens: number;
  isIncognito: boolean;
  systemPrompt?: string;
  reservedOutputTokens?: number;
}

const CHARS_PER_TOKEN_ESTIMATE = 4;

export function estimateTokenCount(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return Math.max(1, Math.ceil(cleaned.length / CHARS_PER_TOKEN_ESTIMATE));
}

export function buildDefaultSystemPrompt(isIncognito: boolean): string {
  return isIncognito
    ? 'You are EFER AI running in an isolated Incognito session (temporary RAM only, no cross-session memory).'
    : 'You are EFER AI, a clear, structured, and helpful workspace assistant.';
}

export function buildContextWindow(
  messages: ChatMessage[],
  options: BuildContextOptions,
): BrainMessage[] {
  const reservedOutput = options.reservedOutputTokens ?? 512;
  const maxInputTokens = Math.max(256, options.contextWindowTokens - reservedOutput);

  const systemContent = options.systemPrompt ?? buildDefaultSystemPrompt(options.isIncognito);
  const systemTokens = estimateTokenCount(systemContent);
  let remainingBudget = Math.max(0, maxInputTokens - systemTokens);

  const conversationalMessages = messages.filter(
    (msg) => (msg.role === 'user' || msg.role === 'assistant') && msg.content.trim().length > 0,
  );

  const selected: BrainMessage[] = [];
  for (let i = conversationalMessages.length - 1; i >= 0; i -= 1) {
    const msg = conversationalMessages[i];
    const msgTokens = estimateTokenCount(msg.content) + 4;

    if (selected.length === 0 && msgTokens > remainingBudget && remainingBudget > 0) {
      const maxChars = remainingBudget * CHARS_PER_TOKEN_ESTIMATE;
      selected.unshift({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content.slice(-maxChars),
      });
      remainingBudget = 0;
      break;
    }

    if (msgTokens > remainingBudget) {
      break;
    }

    selected.unshift({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content,
    });
    remainingBudget -= msgTokens;
  }

  return [{ role: 'system', content: systemContent }, ...selected];
}
