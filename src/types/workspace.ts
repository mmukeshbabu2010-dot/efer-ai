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

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  reactions?: MessageReaction[];
  isPreviewSample?: boolean;
  regenerationCount?: number;
}

export interface Conversation {
  id: string;
  title: string;
  capabilityId: CapabilityId;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
  isSamplePreview?: boolean;
}

export type ActiveWorkspaceView =
  | { kind: 'chat' }
  | { kind: 'planned-capability'; capabilityId: CapabilityId }
  | { kind: 'planned-section'; sectionId: PlannedSectionId };
