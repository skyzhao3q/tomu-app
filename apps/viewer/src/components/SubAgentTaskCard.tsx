import { useState, useEffect, useCallback } from 'react';
import { cn } from '@tomu/ui';
import type { ToolCallInfo } from '../types';
import { api } from '../lib/api';

const AGENT_LABELS: Record<string, string> = {
  'general-purpose': 'General',
  coder: 'Coder',
  Explore: 'Explorer',
  Plan: 'Planner',
  'tomu-guide': 'Guide',
  'tomu-operator': 'Operator',
  'statusline-setup': 'Setup',
};

const STATUS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  running: { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400', label: 'Running' },
  started: { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400', label: 'Starting' },
  completed: { dot: 'bg-green-400', text: 'text-green-400', label: 'Completed' },
  failed: { dot: 'bg-red-400', text: 'text-red-400', label: 'Failed' },
  error: { dot: 'bg-red-400', text: 'text-red-400', label: 'Error' },
};

interface SubAgentTaskCardProps extends ToolCallInfo {}

export function SubAgentTaskCard({ id, args, result, status }: SubAgentTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [polledOutput, setPolledOutput] = useState<string | null>(null);
  const taskId = (args.task_id as string) ?? id;
  const agentType = (args.subagent_type as string) ?? 'general-purpose';
  const prompt = (args.prompt as string) ?? '';

  const output = result ?? polledOutput;
  const effectiveStatus = status === 'completed' ? 'completed' : status === 'error' ? 'failed' : 'running';
  const statusInfo = STATUS_STYLES[effectiveStatus] ?? STATUS_STYLES.running;

  // Poll for task status while running
  const poll = useCallback(async () => {
    if (effectiveStatus !== 'running') return;
    try {
      const task = await api.getTask(taskId);
      if (task.output) setPolledOutput(task.output);
    } catch {
      // ignore poll errors
    }
  }, [taskId, effectiveStatus]);

  useEffect(() => {
    if (effectiveStatus !== 'running') return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll, effectiveStatus]);

  // Auto-expand on completion if output is short
  useEffect(() => {
    if (effectiveStatus === 'completed' && output && output.split('\n').length <= 8) {
      setExpanded(true);
    }
  }, [effectiveStatus, output]);

  return (
    <div className="my-1.5 overflow-hidden rounded-lg border border-border bg-bg-tertiary text-sm">
      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-2">
        {/* Agent icon */}
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-accent/15">
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
            className="text-accent"
          >
            <path d="M12 8V4H8" />
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M8 14h.01M16 14h.01M9.5 18a6.5 6.5 0 006 0" />
          </svg>
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-fg-primary">
              {AGENT_LABELS[agentType] ?? agentType}
            </span>
            <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
              {agentType}
            </span>
          </div>
          {prompt && (
            <p className="truncate text-xs text-fg-muted">{prompt}</p>
          )}
        </div>

        {/* Status */}
        <div className="flex flex-shrink-0 items-center gap-1.5">
          <span className={cn('h-2 w-2 rounded-full', statusInfo.dot)} />
          <span className={cn('text-xs font-medium', statusInfo.text)}>
            {statusInfo.label}
          </span>
        </div>
      </div>

      {/* Output */}
      {output && (
        <div className="border-t border-border">
          <button
            className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-fg-muted hover:text-fg-secondary"
            onClick={() => setExpanded((v) => !v)}
          >
            <svg
              className={cn('h-3 w-3 transition-transform', expanded && 'rotate-90')}
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M8 5l8 7-8 7z" />
            </svg>
            Output
          </button>
          {expanded && (
            <pre className="max-h-64 overflow-auto bg-bg-primary px-3 py-2 font-mono text-xs text-fg-secondary">
              {output}
            </pre>
          )}
        </div>
      )}

      {/* Running spinner when no output yet */}
      {effectiveStatus === 'running' && !output && (
        <div className="flex items-center gap-2 border-t border-border px-3 py-2">
          <svg
            className="h-3.5 w-3.5 animate-spin text-fg-muted"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
          </svg>
          <span className="text-xs text-fg-muted">Working...</span>
        </div>
      )}
    </div>
  );
}
