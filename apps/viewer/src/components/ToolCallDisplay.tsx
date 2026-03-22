import { useState } from 'react';
import { cn } from '@tomu/ui';
import type { ToolCallInfo } from '../types';

function formatArgs(name: string, args: Record<string, unknown>): string {
  if (name === 'Bash' && typeof args.command === 'string') {
    return args.command;
  }
  if ((name === 'Read' || name === 'Write' || name === 'Edit') && typeof args.file_path === 'string') {
    return args.file_path;
  }
  if ((name === 'Glob' || name === 'Grep') && typeof args.pattern === 'string') {
    return args.pattern;
  }
  return JSON.stringify(args, null, 2);
}

function StatusIcon({ status }: { status: ToolCallInfo['status'] }) {
  if (status === 'running') {
    return (
      <svg
        className="h-4 w-4 animate-spin text-fg-muted"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    );
  }
  if (status === 'completed') {
    return (
      <svg className="h-4 w-4 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

export function ToolCallDisplay({ name, args, result, status }: ToolCallInfo) {
  const [argsOpen, setArgsOpen] = useState(true);
  const resultLines = result ? result.split('\n').length : 0;
  const [resultOpen, setResultOpen] = useState(resultLines <= 10);

  const formattedArgs = formatArgs(name, args);

  return (
    <div className="my-1.5 rounded-lg border border-border bg-bg-tertiary text-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5">
        <span className="font-medium text-fg-secondary">{name}</span>
        <StatusIcon status={status} />
      </div>

      {/* Args */}
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
            {formattedArgs}
          </pre>
        )}
      </div>

      {/* Result */}
      {status !== 'running' && result != null && (
        <div className="border-t border-border">
          <button
            className="flex w-full items-center gap-1.5 px-3 py-1 text-xs text-fg-muted hover:text-fg-secondary"
            onClick={() => setResultOpen((v) => !v)}
          >
            <svg
              className={cn('h-3 w-3 transition-transform', resultOpen && 'rotate-90')}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5l8 7-8 7z" />
            </svg>
            Result
          </button>
          {resultOpen && (
            <pre className="max-h-64 overflow-auto rounded-b-lg bg-bg-primary px-3 py-2 font-mono text-xs text-fg-secondary">
              {result}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
