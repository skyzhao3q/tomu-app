import { useEffect, useRef, useState } from 'react';

const MAX_LINES = 1000;

interface LogStreamViewerProps {
  logs: string[];
}

export function LogStreamViewer({ logs }: LogStreamViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isPinned, setIsPinned] = useState(true);

  const displayedLogs = logs.length > MAX_LINES ? logs.slice(-MAX_LINES) : logs;

  useEffect(() => {
    if (!isPinned || !containerRef.current) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [displayedLogs, isPinned]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 10;
    setIsPinned(atBottom);
  };

  return (
    <div className="relative">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-48 overflow-y-auto rounded bg-black p-2 font-mono text-[11px] leading-relaxed text-green-400"
      >
        {displayedLogs.length === 0 ? (
          <span className="text-fg-muted">No logs yet…</span>
        ) : (
          displayedLogs.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        )}
      </div>
      {!isPinned && (
        <button
          className="absolute bottom-1 left-1/2 -translate-x-1/2 rounded bg-bg-secondary px-2 py-0.5 text-[10px] text-fg-muted shadow hover:text-fg-secondary"
          onClick={() => {
            setIsPinned(true);
            if (containerRef.current) {
              containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
          }}
        >
          ↓ Resume auto-scroll
        </button>
      )}
    </div>
  );
}
