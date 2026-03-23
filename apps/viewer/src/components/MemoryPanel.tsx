import { useState, useEffect, useCallback } from 'react';
import { useSetAtom } from 'jotai';
import { cn } from '@tomu/ui';
import { memoryPanelOpenAtom } from '../store/atoms';
import { api } from '../lib/api';

interface MemoryStats {
  total: number;
  by_type: Record<string, number>;
  db_size_bytes: number;
}

interface MemoryItem {
  id: string;
  content: string;
  type: string;
  created_at: string;
}

const TYPE_COLORS: Record<string, string> = {
  message: 'bg-blue-500/20 text-blue-400',
  note: 'bg-green-500/20 text-green-400',
  temporary: 'bg-yellow-500/20 text-yellow-400',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function MemoryPanel() {
  const setOpen = useSetAtom(memoryPanelOpenAtom);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [rebuilding, setRebuilding] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [s, m] = await Promise.all([
        api.getMemoryStats(),
        api.getMemories(10),
      ]);
      setStats(s);
      setMemories(m);
    } catch {
      // ignore load errors
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleRebuild = async () => {
    setRebuilding(true);
    try {
      await api.rebuildEmbeddings();
    } catch {
      // ignore
    } finally {
      setRebuilding(false);
    }
  };

  const handleCleanup = async () => {
    setCleaning(true);
    try {
      await api.cleanupMemories();
      await load();
    } catch {
      // ignore
    } finally {
      setCleaning(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMemory(id);
      setMemories((prev) => prev.filter((m) => m.id !== id));
      setStats((prev) => prev ? { ...prev, total: prev.total - 1 } : prev);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="relative z-10 flex h-full w-[400px] flex-col border-l border-border bg-bg-secondary">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold text-fg-primary">Memory</h2>
          <button
            className="rounded p-1 text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary"
            onClick={() => setOpen(false)}
            aria-label="Close memory panel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="border-b border-border px-4 py-3">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-fg-muted">Total memories</div>
              <div className="text-fg-primary">{stats.total}</div>
              <div className="text-fg-muted">DB size</div>
              <div className="text-fg-primary">{formatBytes(stats.db_size_bytes)}</div>
              {Object.entries(stats.by_type).map(([type, count]) => (
                <div key={type} className="contents">
                  <div className="text-fg-muted capitalize">{type}</div>
                  <div className="text-fg-primary">{count}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 border-b border-border px-4 py-3">
          <button
            className={cn(
              'rounded-md border border-border px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary',
              rebuilding && 'pointer-events-none opacity-60',
            )}
            onClick={handleRebuild}
            disabled={rebuilding}
          >
            {rebuilding ? 'Rebuilding...' : 'Rebuild Embeddings'}
          </button>
          <button
            className={cn(
              'rounded-md border border-border px-3 py-1.5 text-xs text-fg-secondary hover:bg-bg-tertiary hover:text-fg-primary',
              cleaning && 'pointer-events-none opacity-60',
            )}
            onClick={handleCleanup}
            disabled={cleaning}
          >
            {cleaning ? 'Cleaning...' : 'Clean Up'}
          </button>
        </div>

        {/* Memory list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {memories.length === 0 ? (
            <p className="py-4 text-center text-xs text-fg-muted">No memories yet</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {memories.map((mem) => (
                <li
                  key={mem.id}
                  className="relative rounded-md border border-border p-3"
                  onMouseEnter={() => setHoveredId(mem.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <div className="mb-1 flex items-center gap-2">
                    <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', TYPE_COLORS[mem.type] ?? 'bg-fg-muted/20 text-fg-muted')}>
                      {mem.type}
                    </span>
                    <span className="text-[10px] text-fg-muted">{formatDate(mem.created_at)}</span>
                  </div>
                  <p className="line-clamp-2 text-xs text-fg-secondary">{mem.content}</p>
                  {hoveredId === mem.id && (
                    <button
                      className="absolute right-2 top-2 rounded p-0.5 text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary"
                      onClick={() => handleDelete(mem.id)}
                      aria-label="Delete memory"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                      </svg>
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
