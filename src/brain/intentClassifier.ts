import type { ModelCapabilities } from './types';

export type PromptIntent = 'general' | 'code' | 'reasoning' | 'writing';

export interface IntentClassification {
  intent: PromptIntent;
  requiredCapability: keyof ModelCapabilities;
  reason: string;
}

const CODE_REGEX =
  /```|\b(?:function|const|let|var|class|interface|type|import|export|async|await|typescript|javascript|python|react|css|html|sql|regex|debug|refactor|compile|bug|stack trace)\b/i;

const REASONING_REGEX =
  /\b(?:why|compare|trade-?off|analyze|analyse|architecture|prove|proof|derive|step[- ]by[- ]step|explain how|evaluate|pros and cons|calculate)\b/i;

const WRITING_REGEX =
  /\b(?:write|poem|story|essay|email|draft|rewrite|summarize|summarise|outline|headline|copy|blog)\b/i;

export function classifyPromptIntent(prompt: string): IntentClassification {
  const cleaned = prompt.trim();
  if (!cleaned) {
    return {
      intent: 'general',
      requiredCapability: 'chat',
      reason: 'Default general chat intent.',
    };
  }

  if (CODE_REGEX.test(cleaned)) {
    return {
      intent: 'code',
      requiredCapability: 'code',
      reason: 'Detected code syntax or software engineering keywords.',
    };
  }

  if (REASONING_REGEX.test(cleaned)) {
    return {
      intent: 'reasoning',
      requiredCapability: 'reasoning',
      reason: 'Detected analytical, comparison, or step-by-step reasoning cues.',
    };
  }

  if (WRITING_REGEX.test(cleaned)) {
    return {
      intent: 'writing',
      requiredCapability: 'chat',
      reason: 'Detected drafting, summarization, or creative writing cues.',
    };
  }

  return {
    intent: 'general',
    requiredCapability: 'chat',
    reason: 'General conversational prompt.',
  };
}
