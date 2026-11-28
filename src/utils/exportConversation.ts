import type { Conversation } from '../types/workspace';

export type ExportFormat = 'markdown' | 'json';

function slugifyFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  return slug || 'conversation';
}

function formatRoleHeading(role: string): string {
  switch (role) {
    case 'user':
      return 'User';
    case 'assistant':
      return 'EFER AI';
    default:
      return 'System Notice';
  }
}

export function buildConversationMarkdown(conversation: Conversation): string {
  const exportedAt = new Date().toISOString();
  const lines: string[] = [
    `# ${conversation.title}`,
    '',
    `- Capability: ${conversation.capabilityId}`,
    `- Created: ${conversation.createdAt}`,
    `- Updated: ${conversation.updatedAt}`,
    `- Exported: ${exportedAt}`,
    '',
    '---',
    '',
  ];

  if (conversation.messages.length === 0) {
    lines.push('_No messages in this conversation yet._');
  } else {
    for (const msg of conversation.messages) {
      lines.push(`## ${formatRoleHeading(msg.role)} (${msg.timestamp})`);
      lines.push('');
      lines.push(msg.content);
      if (msg.reactions && msg.reactions.length > 0) {
        lines.push('');
        lines.push(`_Reactions: ${msg.reactions.join(' ')}_`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

export function buildConversationJson(conversation: Conversation): string {
  const payload = {
    schema: 'efer-ai-conversation-v1',
    exportedAt: new Date().toISOString(),
    conversation,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadConversation(
  conversation: Conversation,
  format: ExportFormat,
): void {
  const dateStamp = new Date().toISOString().slice(0, 10);
  const baseName = `efer-ai-${slugifyFilename(conversation.title)}-${dateStamp}`;

  const isMarkdown = format === 'markdown';
  const content = isMarkdown
    ? buildConversationMarkdown(conversation)
    : buildConversationJson(conversation);
  const mimeType = isMarkdown
    ? 'text/markdown;charset=utf-8'
    : 'application/json;charset=utf-8';
  const extension = isMarkdown ? 'md' : 'json';

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${baseName}.${extension}`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
