import { useState, useEffect, useCallback } from 'react';
import { cn } from '@tomu/ui';
import type { ToolCallInfo } from '../types';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Agent metadata
// ---------------------------------------------------------------------------

const AGENT_META: Record<string, { label: string; icon: string; color: string }> = {
  'product-manager': { label: 'Product Manager', icon: 'PM', color: 'text-purple-400' },
  designer:          { label: 'Designer',         icon: 'DS', color: 'text-pink-400' },
  developer:         { label: 'Developer',        icon: 'DEV', color: 'text-blue-400' },
  researcher:        { label: 'Researcher',       icon: 'RES', color: 'text-amber-400' },
  operator:          { label: 'Operator',         icon: 'OPS', color: 'text-emerald-400' },
  coder:             { label: 'Coder',            icon: 'COD', color: 'text-blue-400' },
  explore:           { label: 'Explorer',         icon: 'EXP', color: 'text-teal-400' },
  plan:              { label: 'Planner',          icon: 'PLN', color: 'text-indigo-400' },
  'general-purpose': { label: 'General',          icon: 'GEN', color: 'text-fg-muted' },
  'tomu-guide':      { label: 'Guide',            icon: 'GUI', color: 'text-fg-muted' },
  'tomu-operator':   { label: 'Operator',         icon: 'OPS', color: 'text-emerald-400' },
};

const STATUS_STYLES: Record<string, { dot: string; text: string; label: string }> = {
  running:   { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400',  label: 'Running' },
  started:   { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400',  label: 'Starting' },
  completed: { dot: 'bg-green-400',              text: 'text-green-400', label: 'Done' },
  failed:    { dot: 'bg-red-400',                text: 'text-red-400',   label: 'Failed' },
  error:     { dot: 'bg-red-400',                text: 'text-red-400',   label: 'Error' },
};

// ---------------------------------------------------------------------------
// Handoff packet display
// ---------------------------------------------------------------------------

interface HandoffPacket {
  goal: string;
  deliverable: string;
  constraints: string[];
  context?: string[];
  writeBack: string;
}

function HandoffBadge({ packet }: { packet: HandoffPacket }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-border">
      <button
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-fg-muted hover:text-fg-secondary"
        onClick={() => setOpen((v) => !v)}
      >
        <svg
          className={cn('h-3 w-3 transition-transform', open && 'rotate-90')}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8 5l8 7-8 7z" />
        </svg>
        <span>Handoff</span>
        <span className="ml-auto rounded bg-bg-primary px-1 py-0.5 text-[10px] text-fg-muted">
          {packet.writeBack}
        </span>
      </button>
      {open && (
        <div className="space-y-1 bg-bg-primary px-3 pb-2 text-xs text-fg-secondary">
          <div>
            <span className="font-medium text-fg-muted">Goal: </span>
            {packet.goal}
          </div>
          <div>
            <span className="font-medium text-fg-muted">Deliverable: </span>
            {packet.deliverable}
          </div>
          {packet.constraints.length > 0 && (
            <div>
              <span className="font-medium text-fg-muted">Constraints: </span>
              {packet.constraints.join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubAgentTaskCard
// ---------------------------------------------------------------------------

interface SubAgentTaskCardProps extends ToolCallInfo {}

export function SubAgentTaskCard({ id, args, result, status }: SubAgentTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [polledOutput, setPolledOutput] = useState<string | null>(null);

  // Support both legacy (args.type / args.subagent_type) and new (parsed from result JSON)
  let taskId = (args.task_id as string) ?? id;
  let agentType = (args.agent_id as string) ?? (args.type as string) ?? 'general-purpose';
  const prompt = (args.prompt as string) ?? '';

  // The new Task tool returns JSON — parse task_id and agent from result when available
  let parsedResult: Record<string, string> | null = null;
  if (result) {
    try {
      parsedResult = JSON.parse(result) as Record<string, string>;
      if (parsedResult.task_id) taskId = parsedResult.task_id;
      if (parsedResult.agent) {
        // Format: "specialist:product-manager" or "type:coder"
        const [, agentKey] = parsedResult.agent.split(':');
        if (agentKey) agentType = agentKey;
      }
    } catch {
      // result is plain text (legacy)
    }
  }

  // Parse handoff packet if provided in args
  let handoff: HandoffPacket | null = null;
  if (args.handoff && typeof args.handoff === 'object') {
    handoff = args.handoff as HandoffPacket;
  }

  const meta = AGENT_META[agentType] ?? { label: agentType, icon: '??', color: 'text-fg-muted' };
  const output = polledOutput;
  const effectiveStatus =
    status === 'completed' ? 'completed' : status === 'error' ? 'failed' : 'running';
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
        {/* Agent icon badge */}
        <div
          className={cn(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-bg-secondary font-mono text-[10px] font-bold',
            meta.color,
          )}
        >
          {meta.icon}
        </div>

        {/* Info */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-fg-primary">{meta.label}</span>
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

      {/* Handoff packet */}
      {handoff && <HandoffBadge packet={handoff} />}

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
