import { useState, useEffect, useRef } from 'react';
import { cn } from '@tomu/ui';
import type { ToolCallInfo } from '../types';
import { TerminalPreview } from './TerminalPreview';

// ---------------------------------------------------------------------------
// Elapsed time utilities
// ---------------------------------------------------------------------------

function formatElapsed(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  if (s < 10) return `${s.toFixed(1)} s`;
  return `${Math.round(s)} s`;
}

function useElapsedTime(status: ToolCallInfo['status']) {
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState<number>(0);

  useEffect(() => {
    if (status === 'running') {
      if (!startRef.current) startRef.current = Date.now();
      const interval = setInterval(() => {
        setElapsed(Date.now() - (startRef.current ?? Date.now()));
      }, 100);
      return () => clearInterval(interval);
    } else {
      // Freeze at final value
      if (startRef.current) {
        setElapsed(Date.now() - startRef.current);
        startRef.current = null;
      }
    }
  }, [status]);

  return elapsed;
}

// ---------------------------------------------------------------------------
// Status indicator
// ---------------------------------------------------------------------------

function StatusIndicator({ status, elapsed }: { status: ToolCallInfo['status']; elapsed: number }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-2">
      {status === 'running' ? (
        <>
          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-xs font-medium text-amber-400">Running</span>
        </>
      ) : status === 'completed' ? (
        <>
          <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          <span className="text-xs font-medium text-green-400">Done</span>
        </>
      ) : (
        <>
          <svg className="h-3.5 w-3.5 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
          <span className="text-xs font-medium text-red-400">Error</span>
        </>
      )}
      {elapsed > 0 && (
        <span className="text-xs text-fg-muted">{formatElapsed(elapsed)}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline arg summary for header row
// ---------------------------------------------------------------------------

function getInlineSummary(name: string, args: Record<string, unknown>): string | null {
  if (name === 'Bash' && typeof args.command === 'string') return args.command;
  if ((name === 'Read' || name === 'Write' || name === 'Edit') && typeof args.file_path === 'string') return args.file_path;
  if ((name === 'Glob' || name === 'Grep') && typeof args.pattern === 'string') return args.pattern;
  return null;
}

function formatArgs(args: Record<string, unknown>): string {
  return JSON.stringify(args, null, 2);
}

// ---------------------------------------------------------------------------
// Truncated output section
// ---------------------------------------------------------------------------

const OUTPUT_PREVIEW_LINES = 20;

function OutputSection({ result }: { result: string }) {
  const lines = result.split('\n');
  const [showAll, setShowAll] = useState(lines.length <= OUTPUT_PREVIEW_LINES);
  const [open, setOpen] = useState(lines.length <= OUTPUT_PREVIEW_LINES);

  const displayedLines = showAll ? lines : lines.slice(0, OUTPUT_PREVIEW_LINES);
  const hiddenCount = lines.length - OUTPUT_PREVIEW_LINES;

  return (
    <div className="border-t border-border">
      <button
        className="flex w-full items-center gap-1.5 px-3 py-1 text-xs text-fg-muted hover:text-fg-secondary"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className={cn('h-3 w-3 transition-transform', open && 'rotate-90')}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8 5l8 7-8 7z" />
        </svg>
        Result
      </button>
      {open && (
        <div className="rounded-b-lg bg-bg-primary">
          <pre className="overflow-auto px-3 py-2 font-mono text-xs text-fg-secondary leading-relaxed">
            {displayedLines.join('\n')}
          </pre>
          {!showAll && hiddenCount > 0 && (
            <button
              className="block w-full px-3 pb-2 text-left text-xs text-accent hover:underline"
              onClick={() => setShowAll(true)}
            >
              Show {hiddenCount} more lines...
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ToolCallDisplay({ name, args, result, status }: ToolCallInfo) {
  const elapsed = useElapsedTime(status);
  const [argsOpen, setArgsOpen] = useState(false);

  const inlineSummary = getInlineSummary(name, args);
  const isBash = name === 'Bash' && typeof args.command === 'string';
  // For Bash/Read/Write/Edit we show the summary inline — no need for collapsible args
  const showCollapsibleArgs = !inlineSummary;

  return (
    <div className="my-1.5 rounded-lg border border-border bg-bg-tertiary text-sm">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-3 py-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="flex-shrink-0 font-medium text-fg-secondary">{name}</span>
          {inlineSummary && (
            <span className="truncate font-mono text-xs text-fg-muted">
              {inlineSummary}
            </span>
          )}
        </div>
        <StatusIndicator status={status} elapsed={elapsed} />
      </div>

      {/* Collapsible args — only for tools without an inline summary */}
      {showCollapsibleArgs && (
        <div className="border-t border-border">
          <button
            className="flex w-full items-center gap-1.5 px-3 py-1 text-xs text-fg-muted hover:text-fg-secondary"
            onClick={() => setArgsOpen((v) => !v)}
          >
            <svg
              className={cn('h-3 w-3 transition-transform', argsOpen && 'rotate-90')}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5l8 7-8 7z" />
            </svg>
            Arguments
          </button>
          {argsOpen && (
            <pre className="overflow-x-auto px-3 pb-2 font-mono text-xs text-fg-secondary">
              {formatArgs(args)}
            </pre>
          )}
        </div>
      )}

      {/* Result */}
      {status !== 'running' && result != null && (
        isBash ? (
          <div className="border-t border-border px-2 pb-2">
            <TerminalPreview command={args.command as string} output={result} />
          </div>
        ) : (
          <OutputSection result={result} />
        )
      )}
    </div>
  );
}
