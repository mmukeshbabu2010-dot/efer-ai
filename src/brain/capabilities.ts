import type {
  CapabilityDefinition,
  Conversation,
  PlannedSectionDefinition,
  StarterPrompt,
} from '../types/workspace';

export const EFER_CAPABILITIES: CapabilityDefinition[] = [
  {
    id: 'general-chat',
    label: 'General Chat',
    shortDescription: 'Core conversational workspace for questions, drafting, and reasoning.',
    status: 'active',
    phaseLabel: 'Active · Phase 4 Brain',
    roadmapSummary:
      'Active with EFER Brain: EFER Demo, optional Local Ollama, and optional Server Proxy (/api/*) routing, streaming, context windowing, error normalization, and permission-based fallback.',
  },
  {
    id: 'code',
    label: 'Code & Engineering',
    shortDescription: 'Structured code analysis, debugging, and technical architecture.',
    status: 'planned',
    phaseLabel: 'Planned · Phase 7',
    roadmapSummary:
      'Dedicated coding tools, diff previews, and repository-aware workflows will connect through EFER Brain in Phase 7.',
  },
  {
    id: 'documents',
    label: 'Documents & Files',
    shortDescription: 'Read, inspect, and reason over local documents and notes.',
    status: 'planned',
    phaseLabel: 'Planned · Phase 7',
    roadmapSummary:
      'Local file inspection and document synthesis will be added in Phase 7 once provider adapters are active.',
  },
  {
    id: 'image',
    label: 'Image Studio',
    shortDescription: 'Visual generation and image inspection inside the same workspace.',
    status: 'planned',
    phaseLabel: 'Planned · Phase 7',
    roadmapSummary:
      'Multimodal image generation and visual analysis will arrive in Phase 7.',
  },
  {
    id: 'voice',
    label: 'Voice Interaction',
    shortDescription: 'Hands-free voice input and spoken responses.',
    status: 'planned',
    phaseLabel: 'Planned · Phase 7',
    roadmapSummary:
      'Browser microphone preview is visible in the composer, while live speech transcription and voice responses arrive in Phase 7.',
  },
  {
    id: 'video',
    label: 'Video Creation',
    shortDescription: 'Storyboarding and short-form video generation.',
    status: 'planned',
    phaseLabel: 'Planned · Phase 7',
    roadmapSummary:
      'Video generation workflows are planned for Phase 7 after core text, memory, and fallback layers are complete.',
  },
  {
    id: 'memory',
    label: 'EFER Memory',
    shortDescription: 'Transparent, user-controlled long-term preferences and context.',
    status: 'planned',
    phaseLabel: 'Planned · Phase 5',
    roadmapSummary:
      'Searchable, editable, and deletable memory controls will be introduced in Phase 5.',
  },
];

export const EFER_PLANNED_SECTIONS: PlannedSectionDefinition[] = [
  {
    id: 'settings',
    label: 'Settings & Providers',
    phaseLabel: 'Active · Phase 4',
    description:
      'Centralised provider management for EFER Demo, Local Ollama, and Server Proxy (/api/*) adapters plus permission-based fallback rules.',
    plannedItems: [
      'Modular provider toggles (EFER Demo, Local Ollama, and Server Proxy /api/*)',
      'Server-side environment keys inspected without exposing secrets in browser storage',
      'Permission-based fallback preference (Ask First vs. Always Allow)',
    ],
  },
  {
    id: 'activity',
    label: 'Activity Log',
    phaseLabel: 'Active · Phase 3',
    description:
      'Transparent routing history showing intent detection, provider selection, fallback decisions, and real response timings.',
    plannedItems: [
      'Filterable log categories: All, Success, Fallback, and Error',
      'Step-by-step EFER Brain routing trace with exact timestamps',
      'Zero simulated telemetry — populated only from real requests (Incognito turns excluded)',
    ],
  },
  {
    id: 'memory',
    label: 'Memory Controls',
    phaseLabel: 'Planned · Phase 5',
    description:
      'User-owned context controls allowing you to review, search, edit, or delete what EFER AI remembers across sessions.',
    plannedItems: [
      'Per-conversation "Remember this chat" privacy toggle',
      'Searchable list of saved facts and style preferences',
      'One-click edit and permanent deletion controls',
    ],
  },
];

export const STARTER_PROMPTS: StarterPrompt[] = [
  {
    id: 'starter-poem',
    title: 'Write a poem',
    prompt: 'Write a short, vivid poem about stargazing from a quiet rooftop.',
    iconKey: 'poem',
  },
  {
    id: 'starter-science',
    title: 'Explain photosynthesis',
    prompt: 'Explain photosynthesis clearly in three simple steps with a real-world analogy.',
    iconKey: 'science',
  },
  {
    id: 'starter-study',
    title: 'Plan my study',
    prompt: 'Help me structure a realistic 7-day study plan for learning TypeScript fundamentals.',
    iconKey: 'plan',
  },
  {
    id: 'starter-code',
    title: 'Code a website',
    prompt: 'Outline a clean, accessible HTML and CSS layout for a personal portfolio page.',
    iconKey: 'code',
  },
];

export function createInitialConversations(): Conversation[] {
  const now = '10:32 AM';
  return [
    {
      id: 'thread-new-1',
      title: 'New conversation',
      capabilityId: 'general-chat',
      messages: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'thread-sample-layout',
      title: 'Sample Layout Preview',
      capabilityId: 'general-chat',
      isSamplePreview: true,
      createdAt: '10:30 AM',
      updatedAt: '10:32 AM',
      messages: [
        {
          id: 'sample-msg-1',
          role: 'user',
          content: 'Give me a quick summary of black holes in simple terms',
          timestamp: '10:32 AM',
          isPreviewSample: true,
        },
        {
          id: 'sample-msg-2',
          role: 'assistant',
          content: [
            'Sample UI Preview (no external AI provider is connected in Phase 1):',
            '',
            '• A black hole is a region in space where gravity is extremely strong — so strong that nothing, not even light, can escape it.',
            '• They form when a massive star collapses at the end of its life.',
            '• Astronomers detect them indirectly by observing how they affect nearby stars, gas, and light.',
          ].join('\n'),
          timestamp: '10:32 AM',
          isPreviewSample: true,
        },
      ],
    },
  ];
}
