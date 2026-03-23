import { useState, useEffect, useRef, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { cn } from '@tomu/ui';
import { searchModalOpenAtom, activeThreadIdAtom, messagesAtom } from '../store/atoms';
import { api } from '../lib/api';

interface SearchResult {
  thread_id: string;
  title: string;
  snippet: string;
  rank: number;
}

export function ThreadSearchModal() {
  const setOpen = useSetAtom(searchModalOpenAtom);
  const setActiveThreadId = useSetAtom(activeThreadIdAtom);
  const setMessages = useSetAtom(messagesAtom);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-focus input
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!query.trim()) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const data = await api.searchThreads(query.trim());
        setResults(data);
        setSelectedIndex(0);
        setHasSearched(true);
      } catch {
        setResults([]);
        setHasSearched(true);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const navigateToThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId);
      setMessages([]);
      setOpen(false);
    },
    [setActiveThreadId, setMessages, setOpen],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        navigateToThread(results[selectedIndex].thread_id);
      }
    },
    [results, selectedIndex, navigateToThread, setOpen],
  );

  // Highlight matching text in snippet
  const highlightSnippet = (snippet: string) => {
    if (!query.trim()) return snippet;
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = snippet.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-accent/30 text-fg-primary">
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />

      {/* Modal */}
      <div
        className="relative z-10 flex w-[600px] max-w-[90vw] flex-col overflow-hidden rounded-xl border border-border bg-bg-primary shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg
            className="h-4 w-4 flex-shrink-0 text-fg-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search threads..."
            className="flex-1 bg-transparent text-sm text-fg-primary outline-none placeholder:text-fg-muted"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-fg-muted">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[50vh] overflow-y-auto">
          {!query.trim() && (
            <div className="px-4 py-8 text-center text-sm text-fg-muted">
              Type to search...
            </div>
          )}

          {query.trim() && hasSearched && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-fg-muted">
              No results
            </div>
          )}

          {results.map((result, i) => (
            <button
              key={result.thread_id}
              className={cn(
                'flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors',
                i === selectedIndex
                  ? 'bg-accent/10'
                  : 'hover:bg-bg-secondary',
              )}
              onClick={() => navigateToThread(result.thread_id)}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className="text-sm font-medium text-fg-primary">
                {result.title}
              </span>
              <span className="line-clamp-2 text-xs text-fg-secondary">
                {highlightSnippet(result.snippet)}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
