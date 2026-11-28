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
    phaseLabel: 'Active · EFER Brain',
    roadmapSummary:
      'Active with EFER Brain: EFER Demo, Local Ollama, and Server Proxy (/api/*) routing, streaming, context windowing, error normalization, and permission-based fallback.',
  },
  {
    id: 'code',
    label: 'Code & Engineering',
    shortDescription: 'Structured code analysis, debugging, and technical architecture.',
    status: 'active',
    phaseLabel: 'Active · Code Workspace',
    roadmapSummary:
      'Active in EFER Brain with code-capability routing, copyable fenced code blocks, and engineering starter prompts.',
  },
  {
    id: 'documents',
    label: 'Documents & Files',
    shortDescription: 'Read, inspect, and reason over local text and code files.',
    status: 'active',
    phaseLabel: 'Active · Local Files',
    roadmapSummary:
      'Attach local Markdown, JSON, CSV, text, or code files directly from the composer, scan them for accidental secrets, and analyze them in context.',
  },
  {
    id: 'voice',
    label: 'Voice Interaction',
    shortDescription: 'Browser speech dictation and spoken read-aloud playback.',
    status: 'active',
    phaseLabel: 'Active · Web Speech API',
    roadmapSummary:
      'Uses Web Speech API microphone dictation in the composer and browser speechSynthesis Read Aloud controls on responses (where supported by your browser).',
  },
  {
    id: 'memory',
    label: 'EFER Memory',
    shortDescription: 'Transparent, user-controlled long-term preferences and context.',
    status: 'active',
    phaseLabel: 'Active · Local Storage',
    roadmapSummary:
      'Search, add, edit, or delete saved memories, and toggle per-conversation memory injection. Strictly disabled in Incognito.',
  },
  {
    id: 'image',
    label: 'Image Studio',
    shortDescription: 'Visual generation and image inspection inside the same workspace.',
    status: 'planned',
    phaseLabel: 'Planned · Image Gen Backend',
    roadmapSummary:
      'Local image/camera attachments are supported in the composer for vision-capable models; generative text-to-image synthesis requires an external image generation backend.',
  },
  {
    id: 'video',
    label: 'Video Creation',
    shortDescription: 'Storyboarding and short-form video generation.',
    status: 'planned',
    phaseLabel: 'Planned · Video Backend',
    roadmapSummary:
      'Text-to-video synthesis requires an external video generation backend not connected in this local-first release.',
  },
];

export const EFER_PLANNED_SECTIONS: PlannedSectionDefinition[] = [
  {
    id: 'settings',
    label: 'Settings & Providers',
    phaseLabel: 'Active · Adapters & Fallback',
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
    phaseLabel: 'Active · Routing Traces',
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
    phaseLabel: 'Active · User-Owned Context',
    description:
      'User-owned context controls allowing you to review, search, edit, or delete what EFER AI remembers across sessions.',
    plannedItems: [
      'Per-conversation "Remember this chat" privacy toggle',
      'Searchable list of saved facts and style preferences',
      'One-click edit and permanent deletion controls (excluded in Incognito)',
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

export const CAPABILITY_STARTER_PROMPTS: Partial<Record<CapabilityDefinition['id'], StarterPrompt[]>> = {
  code: [
    {
      id: 'code-debug',
      title: 'Debug TypeScript error',
      prompt: 'Walk me through diagnosing a strict TypeScript union narrowing error cleanly.',
      iconKey: 'code',
    },
    {
      id: 'code-test',
      title: 'Write Vitest unit test',
      prompt: 'Draft a clean Vitest unit test suite covering edge cases and error handling for an async helper.',
      iconKey: 'plan',
    },
    {
      id: 'code-security',
      title: 'Review API security',
      prompt: 'Checklist the top security checks for validating user JSON input and streaming SSE responses.',
      iconKey: 'science',
    },
    {
      id: 'code-refactor',
      title: 'Refactor React hook',
      prompt: 'Explain how to avoid stale closures inside async React effects using AbortController.',
      iconKey: 'code',
    },
  ],
  documents: [
    {
      id: 'doc-summarize',
      title: 'Summarize attached file',
      prompt: 'Summarize the key points, open questions, and action items from the attached document.',
      iconKey: 'plan',
    },
    {
      id: 'doc-json',
      title: 'Inspect structured data',
      prompt: 'Review the attached JSON/CSV snippet and highlight anomalies or missing fields.',
      iconKey: 'science',
    },
    {
      id: 'doc-review',
      title: 'Proofread Markdown',
      prompt: 'Check the attached Markdown document for clarity, structure, and broken assumptions.',
      iconKey: 'poem',
    },
    {
      id: 'doc-code',
      title: 'Explain attached source',
      prompt: 'Read the attached source file and explain its responsibilities and edge cases.',
      iconKey: 'code',
    },
  ],
  voice: [
    {
      id: 'voice-briefing',
      title: 'Spoken morning brief',
      prompt: 'Give me a concise 3-point overview suitable for listening to via Read Aloud.',
      iconKey: 'poem',
    },
    {
      id: 'voice-explain',
      title: 'Explain conversationally',
      prompt: 'Explain how HTTPS TLS handshakes work in plain, spoken language without heavy jargon.',
      iconKey: 'science',
    },
    {
      id: 'voice-script',
      title: 'Draft meeting update',
      prompt: 'Write a 60-second spoken standup update covering completed milestones and next steps.',
      iconKey: 'plan',
    },
    {
      id: 'voice-quiz',
      title: 'Voice flashcard quiz',
      prompt: 'Ask me three quick TypeScript questions one at a time so I can answer using voice dictation.',
      iconKey: 'code',
    },
  ],
};

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
            'Sample Conversation Preview:',
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
