import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  BookmarkCheck,
  Check,
  EyeOff,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { searchMemories } from '../../brain/memoryStore';
import type { MemoryCategory, MemoryItem } from '../../brain/types';
import type { Conversation } from '../../types/workspace';

interface MemoryViewProps {
  memories: MemoryItem[];
  activeConversation: Conversation | null;
  isIncognito: boolean;
  onAddMemory: (
    content: string,
    category: MemoryCategory,
    sourceConversationId?: string,
  ) => { ok: boolean; error?: string };
  onUpdateMemory: (
    id: string,
    content: string,
    category: MemoryCategory,
  ) => { ok: boolean; error?: string };
  onDeleteMemory: (id: string) => void;
  onClearMemories: () => void;
  onToggleConversationRemember: (threadId: string) => void;
  onBackToChat: () => void;
}

const CATEGORY_OPTIONS: Array<{ id: MemoryCategory; label: string }> = [
  { id: 'preference', label: 'Preference' },
  { id: 'fact', label: 'Fact' },
  { id: 'project', label: 'Project' },
  { id: 'style', label: 'Style' },
];

export function MemoryView({
  memories,
  activeConversation,
  isIncognito,
  onAddMemory,
  onUpdateMemory,
  onDeleteMemory,
  onClearMemories,
  onToggleConversationRemember,
  onBackToChat,
}: MemoryViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<MemoryCategory | 'all'>('all');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState<MemoryCategory>('preference');
  const [formError, setFormError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState<MemoryCategory>('fact');

  const filteredMemories = useMemo(
    () => searchMemories(memories, searchQuery, categoryFilter),
    [memories, searchQuery, categoryFilter],
  );

  const handleAddSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const res = onAddMemory(
      newContent,
      newCategory,
      !isIncognito ? activeConversation?.id : undefined,
    );
    if (!res.ok) {
      setFormError(res.error ?? 'Unable to save memory.');
      return;
    }
    setNewContent('');
    setFormError(null);
  };

  const startEditing = (item: MemoryItem) => {
    setEditingId(item.id);
    setEditContent(item.content);
    setEditCategory(item.category);
  };

  const handleSaveEdit = (id: string) => {
    const res = onUpdateMemory(id, editContent, editCategory);
    if (res.ok) {
      setEditingId(null);
    }
  };

  const rememberEnabled =
    !isIncognito && activeConversation !== null && activeConversation.rememberThisChat !== false;

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain px-3.5 sm:px-screen py-5 sm:py-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-text-secondary">
              <BookmarkCheck className="w-3.5 h-3.5 text-accent" aria-hidden="true" />
              <span>Phase 5 · User-Owned Context</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-semibold text-text-primary tracking-tight">
              Memory Controls
            </h2>
            <p className="text-xs sm:text-sm text-text-secondary">
              Inspect, add, edit, or permanently remove what EFER AI applies across normal chats.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClearMemories}
              disabled={memories.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-card border border-border bg-card text-xs font-medium text-text-primary hover:bg-card-subtle hover:border-danger/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent"
            >
              <Trash2 className="w-3.5 h-3.5 text-text-secondary" aria-hidden="true" />
              <span>Clear All</span>
            </button>
            <button
              type="button"
              onClick={onBackToChat}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-card bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Back to Chat</span>
            </button>
          </div>
        </div>

        {/* Per-conversation privacy boundary */}
        <div className="p-4 rounded-card bg-card border border-border flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
              <EyeOff className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
              <span>
                {isIncognito
                  ? 'Incognito Session Active — Memory Strictly Disabled'
                  : `Remember this chat (${activeConversation?.title ?? 'Current thread'})`}
              </span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              {isIncognito
                ? 'Incognito turns never read saved memories and cannot save new memories.'
                : 'When disabled for a thread, EFER Brain excludes your saved memories from context for that conversation.'}
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={rememberEnabled}
            aria-label="Remember this chat"
            disabled={isIncognito || activeConversation === null}
            onClick={() => {
              if (activeConversation && !isIncognito) {
                onToggleConversationRemember(activeConversation.id);
              }
            }}
            className={`h-8 px-3 rounded-[10px] border text-xs font-medium whitespace-nowrap shrink-0 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              isIncognito || !activeConversation
                ? 'bg-card-subtle border-border text-text-secondary opacity-55 cursor-not-allowed'
                : rememberEnabled
                  ? 'bg-accent-soft border-accent text-text-primary'
                  : 'bg-card-subtle border-border text-text-secondary hover:text-text-primary'
            }`}
          >
            {isIncognito ? 'Blocked in Incognito' : rememberEnabled ? 'Enabled' : 'Paused'}
          </button>
        </div>

        {/* Storage honesty notice */}
        <div className="p-3.5 rounded-card bg-card-subtle border border-border text-xs text-text-secondary leading-relaxed">
          Saved memories are stored locally in your browser&apos;s{' '}
          <code className="font-mono text-text-primary">localStorage</code> on this device until
          you edit or delete them. Conversation transcripts themselves remain ephemeral in session RAM.
        </div>

        {/* Add Memory form */}
        <form
          onSubmit={handleAddSubmit}
          className="p-4 rounded-card bg-card border border-border space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="efer-new-memory"
              className="text-sm font-semibold text-text-primary"
            >
              Add a saved preference or fact
            </label>
            <div className="flex items-center gap-2">
              <label htmlFor="efer-memory-category" className="text-xs text-text-secondary">
                Category
              </label>
              <select
                id="efer-memory-category"
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value as MemoryCategory)}
                className="h-8 px-2.5 rounded-[9px] bg-bg border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.id} value={opt.id}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            id="efer-new-memory"
            rows={2}
            value={newContent}
            onChange={(event) => {
              setNewContent(event.target.value);
              if (formError) setFormError(null);
            }}
            placeholder="Example: Prefer concise TypeScript examples with strict types and no third-party dependencies."
            className="w-full p-3 rounded-[12px] bg-bg border border-border text-xs sm:text-sm text-text-primary placeholder:text-placeholder focus:outline-none focus:border-accent resize-y"
          />

          {formError && (
            <div role="alert" className="flex items-center gap-2 text-xs text-danger">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              <span>{formError}</span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-[10px] bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Save Memory</span>
            </button>
          </div>
        </form>

        {/* Search and category filter */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1 min-w-[200px] flex items-center gap-2 px-3 h-9 rounded-card bg-card border border-border focus-within:border-accent">
            <Search className="w-3.5 h-3.5 text-text-secondary shrink-0" aria-hidden="true" />
            <label htmlFor="efer-memory-search" className="sr-only">
              Search saved memories
            </label>
            <input
              id="efer-memory-search"
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search saved memories..."
              className="flex-1 min-w-0 bg-transparent text-xs sm:text-sm text-text-primary placeholder:text-placeholder focus:outline-none"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filter memories by category"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-card bg-card-subtle border border-border"
          >
            <button
              type="button"
              role="tab"
              aria-selected={categoryFilter === 'all'}
              onClick={() => setCategoryFilter('all')}
              className={`h-7 px-2.5 rounded-[9px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent ${
                categoryFilter === 'all'
                  ? 'bg-card text-text-primary border border-border'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({memories.length})
            </button>
            {CATEGORY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={categoryFilter === opt.id}
                onClick={() => setCategoryFilter(opt.id)}
                className={`h-7 px-2.5 rounded-[9px] text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-accent ${
                  categoryFilter === opt.id
                    ? 'bg-card text-text-primary border border-border'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Memory list */}
        {filteredMemories.length === 0 ? (
          <div className="p-6 sm:p-8 rounded-card bg-card border border-border text-center space-y-2">
            <p className="text-sm font-medium text-text-primary">
              {memories.length === 0
                ? 'No saved memories yet'
                : 'No memories match your search filter'}
            </p>
            <p className="text-xs text-text-secondary max-w-md mx-auto">
              {memories.length === 0
                ? 'Add a preference above or choose "Save to Memory" from any normal conversation message menu.'
                : 'Try clearing the search query or switching to All categories.'}
            </p>
          </div>
        ) : (
          <ul className="space-y-3" aria-label="Saved memories">
            {filteredMemories.map((item) => {
              const isEditing = editingId === item.id;
              return (
                <li
                  key={item.id}
                  className="p-4 rounded-card bg-card border border-border space-y-2.5"
                >
                  {isEditing ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-text-primary">
                          Edit Memory
                        </span>
                        <select
                          aria-label="Edit memory category"
                          value={editCategory}
                          onChange={(e) => setEditCategory(e.target.value as MemoryCategory)}
                          className="h-8 px-2 rounded-[8px] bg-bg border border-border text-xs text-text-primary focus:outline-none focus:border-accent"
                        >
                          {CATEGORY_OPTIONS.map((opt) => (
                            <option key={opt.id} value={opt.id}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <textarea
                        rows={2}
                        aria-label="Edit memory text"
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-2.5 rounded-[10px] bg-bg border border-border text-xs sm:text-sm text-text-primary focus:outline-none focus:border-accent"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="inline-flex items-center gap-1 h-8 px-2.5 rounded-[9px] border border-border bg-bg text-xs text-text-secondary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <X className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Cancel</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(item.id)}
                          className="inline-flex items-center gap-1 h-8 px-3 rounded-[9px] bg-accent hover:bg-accent-hover text-accent-text text-xs font-medium focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary font-mono">
                          <span className="text-accent font-medium capitalize">
                            {item.category}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>Updated {item.updatedAt}</span>
                        </div>
                        <p className="text-sm text-text-primary leading-relaxed break-words">
                          {item.content}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEditing(item)}
                          aria-label="Edit memory"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-[9px] border border-border bg-card-subtle text-text-secondary hover:text-text-primary hover:border-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteMemory(item.id)}
                          aria-label="Delete memory"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-[9px] border border-border bg-card-subtle text-text-secondary hover:text-danger hover:border-danger/40 transition-colors focus-visible:outline-2 focus-visible:outline-accent"
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default MemoryView;
