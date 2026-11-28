import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createInitialConversations,
  EFER_CAPABILITIES,
  EFER_PLANNED_SECTIONS,
} from '../brain/capabilities';
import type {
  ActiveWorkspaceView,
  CapabilityId,
  ChatMessage,
  Conversation,
  MessageReaction,
  PlannedSectionId,
  ThemeMode,
} from '../types/workspace';

function formatCurrentTime(): string {
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date());
}

function buildConversationTitle(input: string): string {
  const cleaned = input.trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'New conversation';
  return cleaned.length > 42 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

export function useWorkspaceStore() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [conversations, setConversations] = useState<Conversation[]>(() =>
    createInitialConversations(),
  );
  const [activeConversationId, setActiveConversationId] = useState<string>('thread-new-1');
  const [activeView, setActiveView] = useState<ActiveWorkspaceView>({ kind: 'chat' });

  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState<boolean>(true);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState<boolean>(false);

  const [composerText, setComposerText] = useState<string>('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [selectedStarterId, setSelectedStarterId] = useState<string | null>(null);
  const [composerFocusTick, setComposerFocusTick] = useState<number>(0);
  const [isIncognito, setIsIncognito] = useState<boolean>(false);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeConversationId) ?? null,
    [conversations, activeConversationId],
  );

  const activeCapability = useMemo(
    () =>
      EFER_CAPABILITIES.find(
        (cap) =>
          cap.id ===
          (activeView.kind === 'planned-capability'
            ? activeView.capabilityId
            : 'general-chat'),
      ) ?? EFER_CAPABILITIES[0],
    [activeView],
  );

  const activePlannedSection = useMemo(
    () =>
      activeView.kind === 'planned-section'
        ? EFER_PLANNED_SECTIONS.find((sec) => sec.id === activeView.sectionId) ?? null
        : null,
    [activeView],
  );

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const toggleIncognito = useCallback(() => {
    setIsIncognito((prev) => !prev);
  }, []);

  const createNewThread = useCallback(() => {
    const timestamp = formatCurrentTime();
    const newId = `thread-${Date.now()}`;
    const nextConversation: Conversation = {
      id: newId,
      title: 'New conversation',
      capabilityId: 'general-chat',
      messages: [],
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setConversations((prev) => [nextConversation, ...prev]);
    setActiveConversationId(newId);
    setActiveView({ kind: 'chat' });
    setComposerError(null);
    setWorkspaceNotice(null);
    setSelectedStarterId(null);
    setIsMobileDrawerOpen(false);
  }, []);

  const selectThread = useCallback((threadId: string) => {
    setActiveConversationId(threadId);
    setActiveView({ kind: 'chat' });
    setComposerError(null);
    setWorkspaceNotice(null);
    setIsMobileDrawerOpen(false);
  }, []);

  const deleteThread = useCallback(
    (threadId: string) => {
      setConversations((prev) => {
        const remaining = prev.filter((item) => item.id !== threadId);
        if (activeConversationId === threadId) {
          if (remaining.length > 0) {
            setActiveConversationId(remaining[0].id);
          } else {
            const timestamp = formatCurrentTime();
            const fallbackId = `thread-${Date.now()}`;
            const fresh: Conversation = {
              id: fallbackId,
              title: 'New conversation',
              capabilityId: 'general-chat',
              messages: [],
              createdAt: timestamp,
              updatedAt: timestamp,
            };
            setActiveConversationId(fallbackId);
            return [fresh];
          }
        }
        return remaining;
      });
    },
    [activeConversationId],
  );

  const selectCapability = useCallback((capabilityId: CapabilityId) => {
    if (capabilityId === 'general-chat') {
      setActiveView({ kind: 'chat' });
    } else {
      setActiveView({ kind: 'planned-capability', capabilityId });
    }
    setIsMobileDrawerOpen(false);
  }, []);

  const selectPlannedSection = useCallback((sectionId: PlannedSectionId) => {
    setActiveView({ kind: 'planned-section', sectionId });
    setIsMobileDrawerOpen(false);
  }, []);

  const populateStarterPrompt = useCallback((starterId: string, prompt: string) => {
    setSelectedStarterId(starterId);
    setComposerText(prompt);
    setComposerError(null);
    setActiveView({ kind: 'chat' });
    setComposerFocusTick((tick) => tick + 1);
  }, []);

  const clearAndFocusComposer = useCallback(() => {
    setComposerText('');
    setComposerError(null);
    setSelectedStarterId(null);
    setActiveView({ kind: 'chat' });
    setIsMobileDrawerOpen(false);
    setComposerFocusTick((tick) => tick + 1);
  }, []);

  const updateComposerText = useCallback((value: string) => {
    setComposerText(value);
    if (composerError && value.trim().length > 0) {
      setComposerError(null);
    }
  }, [composerError]);

  const sendMessage = useCallback(
    (rawContent?: string) => {
      const content = (rawContent ?? composerText).trim();
      if (!content) {
        setComposerError('Please enter a message before sending.');
        return;
      }

      if (content.length > 8000) {
        setComposerError('Message is too long for Phase 1 in-memory preview (max 8,000 characters).');
        return;
      }

      setIsSubmitting(true);
      setComposerError(null);
      setWorkspaceNotice(null);

      const timestamp = formatCurrentTime();
      const userMessage: ChatMessage = {
        id: `msg-user-${Date.now()}`,
        role: 'user',
        content,
        timestamp,
      };

      const phase1Notice: ChatMessage = {
        id: `msg-notice-${Date.now() + 1}`,
        role: 'notice',
        content:
          'Message saved to in-memory conversation state. No AI provider is connected in Phase 1 — EFER Brain and the Demonstration Provider will be added in Phase 2.',
        timestamp,
      };

      setConversations((prev) => {
        const exists = prev.some((item) => item.id === activeConversationId);
        if (!exists) {
          const fresh: Conversation = {
            id: activeConversationId,
            title: buildConversationTitle(content),
            capabilityId: 'general-chat',
            messages: [userMessage, phase1Notice],
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          return [fresh, ...prev];
        }

        return prev.map((thread) => {
          if (thread.id !== activeConversationId) return thread;
          const isFirstUserMessage = !thread.messages.some((m) => m.role === 'user' && !m.isPreviewSample);
          return {
            ...thread,
            title:
              thread.title === 'New conversation' && isFirstUserMessage
                ? buildConversationTitle(content)
                : thread.title,
            messages: [...thread.messages, userMessage, phase1Notice],
            updatedAt: timestamp,
          };
        });
      });

      setComposerText('');
      setSelectedStarterId(null);
      setActiveView({ kind: 'chat' });
      setIsSubmitting(false);
    },
    [activeConversationId, composerText],
  );

  const toggleMessageReaction = useCallback(
    (messageId: string, emoji: MessageReaction) => {
      setConversations((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeConversationId) return thread;
          return {
            ...thread,
            messages: thread.messages.map((msg) => {
              if (msg.id !== messageId) return msg;
              const existing = msg.reactions ?? [];
              const hasReaction = existing.includes(emoji);
              const nextReactions = hasReaction
                ? existing.filter((item) => item !== emoji)
                : [...existing, emoji];
              return {
                ...msg,
                reactions: nextReactions,
              };
            }),
          };
        }),
      );
    },
    [activeConversationId],
  );

  const deleteMessage = useCallback(
    (messageId: string) => {
      const timestamp = formatCurrentTime();
      setConversations((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeConversationId) return thread;
          return {
            ...thread,
            messages: thread.messages.filter((msg) => msg.id !== messageId),
            updatedAt: timestamp,
          };
        }),
      );
    },
    [activeConversationId],
  );

  const regenerateMessage = useCallback(
    (messageId: string) => {
      const timestamp = formatCurrentTime();
      setConversations((prev) =>
        prev.map((thread) => {
          if (thread.id !== activeConversationId) return thread;
          const targetIndex = thread.messages.findIndex((msg) => msg.id === messageId);
          if (targetIndex === -1) return thread;

          const targetMessage = thread.messages[targetIndex];
          if (targetMessage.role === 'user') return thread;

          const precedingUserMessage = [...thread.messages.slice(0, targetIndex)]
            .reverse()
            .find((msg) => msg.role === 'user');
          const nextCount = (targetMessage.regenerationCount ?? 0) + 1;
          const promptSnippet = precedingUserMessage
            ? precedingUserMessage.content.trim().slice(0, 120)
            : null;

          let nextContent = targetMessage.content;

          if (targetMessage.role === 'notice') {
            nextContent = promptSnippet
              ? `Regenerated Phase 1 local notice (pass #${nextCount}) for prompt "${promptSnippet}${
                  precedingUserMessage && precedingUserMessage.content.trim().length > 120 ? '…' : ''
                }". No AI provider is connected in Phase 1 — EFER Brain and the Demonstration Provider will be added in Phase 2.`
              : `Regenerated Phase 1 local notice (pass #${nextCount}). No AI provider is connected in Phase 1 — EFER Brain and the Demonstration Provider will be added in Phase 2.`;
          } else if (targetMessage.isPreviewSample) {
            const sampleVariants = [
              [
                `Sample UI Preview (refreshed pass #${nextCount} · no external AI provider connected in Phase 1):`,
                '',
                '• **Event Horizon**: A black hole marks the boundary beyond which gravity prevents even light from escaping.',
                '• **Formation**: Most stellar black holes form when massive stars collapse after exhausting nuclear fuel.',
                '• **Observation**: Telescopes infer them from gravitational orbits, X-ray emissions from hot accretion disks, and gravitational waves.',
              ].join('\n'),
              [
                `Sample UI Preview (refreshed pass #${nextCount} · no external AI provider connected in Phase 1):`,
                '',
                '• A black hole is a region in space where gravity is extremely strong — so strong that nothing, not even light, can escape it.',
                '• They form when a massive star collapses at the end of its life.',
                '• Astronomers detect them indirectly by observing how they affect nearby stars, gas, and light.',
              ].join('\n'),
            ];
            nextContent = sampleVariants[(nextCount - 1) % sampleVariants.length];
          } else {
            nextContent = promptSnippet
              ? `Phase 1 response placeholder refreshed (pass #${nextCount}) for "${promptSnippet}". Live AI regeneration connects via EFER Brain in Phase 2.`
              : `Phase 1 response placeholder refreshed (pass #${nextCount}). Live AI regeneration connects via EFER Brain in Phase 2.`;
          }

          return {
            ...thread,
            updatedAt: timestamp,
            messages: thread.messages.map((msg) =>
              msg.id === messageId
                ? {
                    ...msg,
                    content: nextContent,
                    timestamp,
                    reactions: [],
                    regenerationCount: nextCount,
                  }
                : msg,
            ),
          };
        }),
      );
    },
    [activeConversationId],
  );

  return {
    theme,
    setTheme,
    toggleTheme,
    conversations,
    activeConversation,
    activeConversationId,
    activeView,
    activeCapability,
    activePlannedSection,
    isDesktopSidebarOpen,
    setIsDesktopSidebarOpen,
    isMobileDrawerOpen,
    setIsMobileDrawerOpen,
    composerText,
    updateComposerText,
    composerError,
    setComposerError,
    workspaceNotice,
    setWorkspaceNotice,
    isSubmitting,
    selectedStarterId,
    composerFocusTick,
    isIncognito,
    toggleIncognito,
    createNewThread,
    selectThread,
    deleteThread,
    selectCapability,
    selectPlannedSection,
    populateStarterPrompt,
    clearAndFocusComposer,
    sendMessage,
    toggleMessageReaction,
    deleteMessage,
    regenerateMessage,
  };
}
