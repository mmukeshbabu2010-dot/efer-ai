import { describe, expect, it } from 'vitest';
import { classifyPromptIntent } from '../../brain/intentClassifier';

describe('classifyPromptIntent', () => {
  it('detects code, reasoning, writing, and general intents deterministically', () => {
    const code = classifyPromptIntent('Refactor this TypeScript async function to fix a bug');
    expect(code.intent).toBe('code');
    expect(code.requiredCapability).toBe('code');

    const reasoning = classifyPromptIntent(
      'Compare the trade-offs and explain why event-driven architecture scales',
    );
    expect(reasoning.intent).toBe('reasoning');
    expect(reasoning.requiredCapability).toBe('reasoning');

    const writing = classifyPromptIntent('Draft a short poem about stargazing');
    expect(writing.intent).toBe('writing');
    expect(writing.requiredCapability).toBe('chat');

    const general = classifyPromptIntent('Hello there!');
    expect(general.intent).toBe('general');
    expect(general.requiredCapability).toBe('chat');
  });
});
