export type ThemeMode = 'light' | 'dark';

export type CapabilityId =
  | 'general-chat'
  | 'code'
  | 'documents'
  | 'image'
  | 'voice'
  | 'video'
  | 'memory';

export type CapabilityStatus = 'active' | 'planned';

export interface CapabilityDefinition {
  id: CapabilityId;
  label: string;
  shortDescription: string;
  status: CapabilityStatus;
  phaseLabel: string;
  roadmapSummary: string;
}

export type PlannedSectionId = 'settings' | 'activity' | 'memory';

export interface PlannedSectionDefinition {
  id: PlannedSectionId;
  label: string;
  phaseLabel: string;
  description: string;
  plannedItems: string[];
}

export type StarterIconKey = 'poem' | 'science' | 'plan' | 'code';

export interface StarterPrompt {
  id: string;
  title: string;
  prompt: string;
  iconKey: StarterIconKey;
}

export type MessageRole = 'user' | 'assistant' | 'notice';

export const AI_REACTION_OPTIONS = ['👍', '❤️', '💡', '🎯'] as const;
export type MessageReaction = (typeof AI_REACTION_OPTIONS)[number];

export type MessageStatus = 'streaming' | 'complete' | 'error' | 'aborted';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  reactions?: MessageReaction[];
  isPreviewSample?: boolean;
  regenerationCount?: number;
  status?: MessageStatus;
  modelId?: string;
  modelName?: string;
  providerId?: string;
  isFallback?: boolean;
  fallbackReason?: string;
  latencyMs?: number;
  errorCode?: string;
}

export interface Conversation {
  id: string;
  title: string;
  capabilityId: CapabilityId;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  isSamplePreview?: boolean;
  isIncognito?: boolean;
}

export interface SendMessageResult {
  ok: boolean;
  reason?: 'empty' | 'too-long' | 'in-flight' | 'aborted' | 'error';
}

export interface PendingFallbackConsent {
  requestId: string;
  fromModelName: string;
  toModelName: string;
  fromProviderId: string;
  toProviderId: string;
  fromPrivacyTier: string;
  toPrivacyTier: string;
  isIncognito: boolean;
  reason: string;
  errorCode: string;
}

export type ActivityOutcome = 'success' | 'fallback' | 'error' | 'aborted';

export interface ActivityLogEntry {
  id: string;
  requestId: string;
  timestamp: string;
  intent: 'general' | 'code' | 'reasoning' | 'writing';
  modelId: string;
  modelName: string;
  providerId: string;
  outcome: ActivityOutcome;
  latencyMs: number;
  fallbackUsed: boolean;
  fallbackReason?: string;
  errorCode?: string;
  steps: Array<{
    timestamp: string;
    stage: 'intent' | 'context' | 'route' | 'fallback' | 'stream' | 'complete' | 'error';
    detail: string;
  }>;
}

export type ActiveWorkspaceView =
  | { kind: 'chat' }
  | { kind: 'activity' }
  | { kind: 'settings' }
  | { kind: 'planned-capability'; capabilityId: CapabilityId }
  | { kind: 'planned-section'; sectionId: PlannedSectionId };
