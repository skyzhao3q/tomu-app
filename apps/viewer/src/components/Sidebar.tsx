import { useState, useCallback, useMemo } from 'react';
import { useAtom, useSetAtom } from 'jotai';
import { cn } from '@tomu/ui';
import type { Thread, Message, ContentBlock } from '@tomu/core';
import { threadsAtom, activeThreadIdAtom, messagesAtom } from '../store/atoms';
import { api } from '../lib/api';
import type { ChatMessage } from '../types';

function toChatMessage(m: Message): ChatMessage {
  const content =
    typeof m.content === 'string'
      ? m.content
      : (m.content as ContentBlock[]).filter((b) => b.type === 'text' && b.text).map((b) => b.text!).join('\n');
  return {
    id: m.id,
    role: m.role === 'tool' ? 'system' : m.role,
    content,
    timestamp: m.timestamp,
  };
}

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

interface GroupedThreads {
  label: string;
  threads: Thread[];
}

function groupByDate(threads: Thread[]): GroupedThreads[] {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;
  const startOf7DaysAgo = startOfToday - 7 * 86_400_000;

  const today: Thread[] = [];
  const yesterday: Thread[] = [];
  const prev7: Thread[] = [];
  const older: Thread[] = [];

  for (const t of threads) {
    const ts = new Date(t.updated_at).getTime();
    if (ts >= startOfToday) today.push(t);
    else if (ts >= startOfYesterday) yesterday.push(t);
    else if (ts >= startOf7DaysAgo) prev7.push(t);
    else older.push(t);
  }

  const groups: GroupedThreads[] = [];
  if (today.length) groups.push({ label: 'Today', threads: today });
  if (yesterday.length) groups.push({ label: 'Yesterday', threads: yesterday });
  if (prev7.length) groups.push({ label: 'Previous 7 Days', threads: prev7 });
  if (older.length) groups.push({ label: 'Older', threads: older });
  return groups;
}

export function Sidebar() {
  const [threads, setThreads] = useAtom(threadsAtom);
  const [activeThreadId, setActiveThreadId] = useAtom(activeThreadIdAtom);
  const setMessages = useSetAtom(messagesAtom);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const grouped = useMemo(
    () => groupByDate([...threads].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())),
    [threads],
  );

  const handleNewChat = useCallback(async () => {
    try {
      const thread = await api.createThread();
      setThreads((prev) => [thread, ...prev]);
      setActiveThreadId(thread.thread_id);
      setMessages([]);
    } catch {
      // fallback: just clear current
      setActiveThreadId(null);
      setMessages([]);
    }
  }, [setThreads, setActiveThreadId, setMessages]);

  const handleDelete = useCallback(
    async (e: React.MouseEvent, threadId: string) => {
      e.stopPropagation();
      try {
        await api.deleteThread(threadId);
        setThreads((prev) => prev.filter((t) => t.thread_id !== threadId));
        if (activeThreadId === threadId) {
          setActiveThreadId(null);
          setMessages([]);
        }
      } catch {
        // ignore
      }
    },
    [activeThreadId, setThreads, setActiveThreadId, setMessages],
  );

  const handleSelectThread = useCallback(
    async (threadId: string) => {
      setActiveThreadId(threadId);
      try {
        const thread = await api.getThread(threadId);
        setMessages(thread.messages.map(toChatMessage));
      } catch {
        setMessages([]);
      }
    },
    [setActiveThreadId, setMessages],
  );

  return (
    <aside className="flex h-screen w-[250px] flex-col border-r border-border bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <span className="text-lg font-bold text-fg-primary">tomu</span>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-2">
        <button
          className="flex w-full items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-fg-primary hover:bg-bg-tertiary"
          onClick={handleNewChat}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Chat
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto px-2">
        {threads.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-fg-muted">
            No conversations yet
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {grouped.map((group) => (
              <div key={group.label}>
                <div className="px-3 py-1 text-xs font-medium text-fg-muted">
                  {group.label}
                </div>
                <ul className="flex flex-col gap-0.5">
                  {group.threads.map((thread) => (
                    <li
                      key={thread.thread_id}
                      onMouseEnter={() => setHoveredId(thread.thread_id)}
                      onMouseLeave={() => setHoveredId(null)}
                    >
                      <button
                        className={cn(
                          'group relative w-full rounded-md px-3 py-2 text-left text-sm transition-colors',
                          activeThreadId === thread.thread_id
                            ? 'bg-accent/15 text-fg-primary'
                            : 'text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary',
                        )}
                        onClick={() => handleSelectThread(thread.thread_id)}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate pr-5">{thread.title}</span>
                          <span className="flex-shrink-0 text-xs text-fg-muted">
                            {formatRelativeTime(thread.updated_at)}
                          </span>
                        </div>
                        {hoveredId === thread.thread_id && (
                          <span
                            className="absolute right-1.5 top-1.5 rounded p-0.5 text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary"
                            onClick={(e) => handleDelete(e, thread.thread_id)}
                            role="button"
                            aria-label="Delete thread"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Settings */}
      <div className="border-t border-border p-3">
        <button className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12.22 2h-.44a2 2 0 00-2 2v.18a2 2 0 01-1 1.73l-.43.25a2 2 0 01-2 0l-.15-.08a2 2 0 00-2.73.73l-.22.38a2 2 0 00.73 2.73l.15.1a2 2 0 011 1.72v.51a2 2 0 01-1 1.74l-.15.09a2 2 0 00-.73 2.73l.22.38a2 2 0 002.73.73l.15-.08a2 2 0 012 0l.43.25a2 2 0 011 1.73V20a2 2 0 002 2h.44a2 2 0 002-2v-.18a2 2 0 011-1.73l.43-.25a2 2 0 012 0l.15.08a2 2 0 002.73-.73l.22-.39a2 2 0 00-.73-2.73l-.15-.08a2 2 0 01-1-1.74v-.5a2 2 0 011-1.74l.15-.09a2 2 0 00.73-2.73l-.22-.38a2 2 0 00-2.73-.73l-.15.08a2 2 0 01-2 0l-.43-.25a2 2 0 01-1-1.73V4a2 2 0 00-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Settings
        </button>
      </div>
    </aside>
  );
}
