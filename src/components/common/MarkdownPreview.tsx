import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

interface CodeBlockProps {
  lang: string;
  codeText: string;
  codeKey: string;
  highlightQuery?: string;
}

function CodeBlock({ lang, codeText, codeKey, highlightQuery }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(codeText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      // Ignore clipboard failures in restricted contexts
    }
  };

  return (
    <div className="rounded-[12px] bg-card-subtle border border-border overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-b border-border text-[11px] font-mono text-text-secondary">
        <span>{lang || 'code'}</span>
        <button
          type="button"
          onClick={() => {
            void handleCopy();
          }}
          aria-label="Copy code block"
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[6px] hover:bg-card hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-accent"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-success" aria-hidden="true" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" aria-hidden="true" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono leading-relaxed text-text-primary overflow-x-auto">
        <code>{highlightTextNodes(codeText, highlightQuery, codeKey)}</code>
      </pre>
    </div>
  );
}

interface MarkdownPreviewProps {
  content: string;
  emptyText?: string;
  highlightQuery?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function highlightTextNodes(
  text: string,
  query: string | undefined,
  keyPrefix: string,
  variant: 'default' | 'inverted' = 'default',
): ReactNode {
  const trimmed = query?.trim() ?? '';
  if (!trimmed) return text;

  const regex = new RegExp(`(${escapeRegExp(trimmed)})`, 'gi');
  const parts = text.split(regex);
  if (parts.length <= 1) return text;

  const markClass =
    variant === 'inverted'
      ? 'bg-accent text-accent-text rounded-[3px] px-0.5 font-medium'
      : 'bg-accent-soft text-text-primary border-b-2 border-accent rounded-[3px] px-0.5 font-medium';

  return parts.map((part, index) => {
    if (part.toLowerCase() === trimmed.toLowerCase()) {
      return (
        <mark key={`${keyPrefix}-m-${index}`} className={markClass}>
          {part}
        </mark>
      );
    }
    return part;
  });
}

function isSafeHttpUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.username || parsed.password) {
      return false;
    }
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function renderInlineMarkdown(
  text: string,
  keyPrefix: string,
  highlightQuery?: string,
): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let partIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(
        highlightTextNodes(
          text.slice(lastIndex, match.index),
          highlightQuery,
          `${keyPrefix}-txt-${partIdx++}`,
        ),
      );
    }

    const token = match[0];
    const key = `${keyPrefix}-${partIdx++}`;

    if (token.startsWith('`') && token.endsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="font-mono text-[13px] px-1.5 py-0.5 rounded-[6px] bg-card-subtle border border-border text-text-primary"
        >
          {highlightTextNodes(token.slice(1, -1), highlightQuery, `${key}-code`)}
        </code>,
      );
    } else if (token.startsWith('**') && token.endsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold text-text-primary">
          {highlightTextNodes(token.slice(2, -2), highlightQuery, `${key}-b`)}
        </strong>,
      );
    } else if (token.startsWith('*') && token.endsWith('*')) {
      nodes.push(
        <em key={key} className="italic">
          {highlightTextNodes(token.slice(1, -1), highlightQuery, `${key}-i`)}
        </em>,
      );
    } else if (token.startsWith('[')) {
      const linkMatch = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(token);
      if (linkMatch && isSafeHttpUrl(linkMatch[2])) {
        nodes.push(
          <a
            key={key}
            href={linkMatch[2].trim()}
            target="_blank"
            rel="noopener noreferrer nofollow"
            referrerPolicy="no-referrer"
            className="text-accent underline underline-offset-2 hover:opacity-80"
          >
            {highlightTextNodes(linkMatch[1], highlightQuery, `${key}-a`)}
          </a>,
        );
      } else {
        nodes.push(highlightTextNodes(token, highlightQuery, `${key}-raw`));
      }
    } else {
      nodes.push(highlightTextNodes(token, highlightQuery, `${key}-other`));
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(
      highlightTextNodes(
        text.slice(lastIndex),
        highlightQuery,
        `${keyPrefix}-tail`,
      ),
    );
  }

  return nodes;
}

export function stripMarkdownForSpeech(markdown: string): string {
  return markdown
    .replace(/```[\s\S]*?```/g, ' Code snippet. ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*•]\s+/gm, '')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/[*_~>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function MarkdownPreview({
  content,
  emptyText = 'Nothing to preview yet.',
  highlightQuery,
}: MarkdownPreviewProps) {
  const trimmed = content.trim();
  if (!trimmed) {
    return <p className="text-sm text-text-secondary italic">{emptyText}</p>;
  }

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let blockKey = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim().startsWith('```')) {
      const lang = line.trim().slice(3).trim();
      const codeLines: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i += 1;
      }
      i += 1;
      const codeKey = `code-${blockKey++}`;
      blocks.push(
        <CodeBlock
          key={codeKey}
          lang={lang}
          codeText={codeLines.join('\n')}
          codeKey={codeKey}
          highlightQuery={highlightQuery}
        />,
      );
      continue;
    }

    if (line.trim() === '') {
      i += 1;
      continue;
    }

    const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const key = `h-${blockKey++}`;
      if (level === 1) {
        blocks.push(
          <h1 key={key} className="text-lg font-bold text-text-primary">
            {renderInlineMarkdown(text, key, highlightQuery)}
          </h1>,
        );
      } else if (level === 2) {
        blocks.push(
          <h2 key={key} className="text-base font-semibold text-text-primary">
            {renderInlineMarkdown(text, key, highlightQuery)}
          </h2>,
        );
      } else {
        blocks.push(
          <h3 key={key} className="text-sm font-semibold text-text-primary">
            {renderInlineMarkdown(text, key, highlightQuery)}
          </h3>,
        );
      }
      i += 1;
      continue;
    }

    if (line.trimStart().startsWith('> ')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].trimStart().startsWith('> ')) {
        quoteLines.push(lines[i].trimStart().slice(2));
        i += 1;
      }
      const key = `quote-${blockKey++}`;
      blocks.push(
        <blockquote
          key={key}
          className="pl-3 py-1 bg-card-subtle/60 rounded-[8px] text-sm text-text-secondary italic space-y-1"
        >
          {quoteLines.map((ql, idx) => (
            <p key={`${key}-${idx}`}>
              {renderInlineMarkdown(ql, `${key}-${idx}`, highlightQuery)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (/^\s*[-*•]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*•]\s+/, ''));
        i += 1;
      }
      const key = `ul-${blockKey++}`;
      blocks.push(
        <ul key={key} className="list-disc pl-5 space-y-1 text-[15px] leading-relaxed">
          {items.map((item, idx) => (
            <li key={`${key}-${idx}`}>
              {renderInlineMarkdown(item, `${key}-${idx}`, highlightQuery)}
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      const key = `ol-${blockKey++}`;
      blocks.push(
        <ol key={key} className="list-decimal pl-5 space-y-1 text-[15px] leading-relaxed">
          {items.map((item, idx) => (
            <li key={`${key}-${idx}`}>
              {renderInlineMarkdown(item, `${key}-${idx}`, highlightQuery)}
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !lines[i].trimStart().startsWith('> ') &&
      !/^\s*[-*•]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      paraLines.push(lines[i]);
      i += 1;
    }
    const key = `p-${blockKey++}`;
    blocks.push(
      <p key={key} className="text-[15px] leading-relaxed text-text-primary break-words">
        {renderInlineMarkdown(paraLines.join(' '), key, highlightQuery)}
      </p>,
    );
  }

  return <div className="space-y-2.5">{blocks}</div>;
}
