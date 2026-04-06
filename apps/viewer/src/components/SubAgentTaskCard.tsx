import { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@tomu/ui';
import type { ToolCallInfo } from '../types';
import type { TaskResult, MissionDetail } from '../lib/api';
import { api } from '../lib/api';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENT_LABELS: Record<string, string> = {
  'general-purpose': 'General',
  coder: 'Coder',
  explore: 'Explorer',
  Explore: 'Explorer',
  plan: 'Planner',
  Plan: 'Planner',
  'tomu-guide': 'Guide',
  'tomu-operator': 'Operator',
  'statusline-setup': 'Setup',
  'product-manager': 'Product Manager',
  designer: 'Designer',
  developer: 'Developer',
  researcher: 'Researcher',
  operator: 'Operator',
};

const STATUS_CFG: Record<string, { dot: string; text: string; label: string }> = {
  running: { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400', label: 'Running' },
  queued:  { dot: 'bg-yellow-400',             text: 'text-yellow-400', label: 'Queued' },
  completed: { dot: 'bg-green-400',            text: 'text-green-400', label: 'Completed' },
  failed:  { dot: 'bg-red-400',                text: 'text-red-400',   label: 'Failed' },
  stopped: { dot: 'bg-fg-muted opacity-50',    text: 'text-fg-muted',  label: 'Stopped' },
  active:  { dot: 'bg-blue-400 animate-pulse', text: 'text-blue-400', label: 'Active' },
  paused:  { dot: 'bg-yellow-400',             text: 'text-yellow-400', label: 'Paused' },
};

function formatElapsed(s: number): string {
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function parseResultJson(result: string | undefined): Record<string, unknown> | null {
  if (!result) return null;
  try { return JSON.parse(result) as Record<string, unknown>; } catch { return null; }
}

// ---------------------------------------------------------------------------
// §6.3 Crew Graph — delegation tree
// ---------------------------------------------------------------------------

function CrewTree({ detail }: { detail: MissionDetail }) {
  const { runs, handoffs } = detail;
  if (runs.length <= 1) return null;

  // Build parent → [child run ids] map from accepted/completed handoffs
  const childrenMap: Record<string, string[]> = {};
  const childRunIds = new Set<string>();
  for (const h of handoffs) {
    if (h.from_run_id && h.to_run_id) {
      (childrenMap[h.from_run_id] ??= []).push(h.to_run_id);
      childRunIds.add(h.to_run_id);
    }
  }
  const roots = runs.filter((r) => !childRunIds.has(r.id));

  function RunNode({ runId, depth }: { runId: string; depth: number }) {
    const run = runs.find((r) => r.id === runId);
    if (!run) return null;
    const cfg = STATUS_CFG[run.status] ?? STATUS_CFG.running;
    const kids = childrenMap[run.id] ?? [];
    return (
      <>
        <div
          className="flex items-center gap-1.5 py-0.5"
          style={{ paddingLeft: `${depth * 14}px` }}
        >
          {depth > 0 && <span className="text-[10px] text-fg-muted">└─</span>}
          <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', cfg.dot)} />
          <span className="text-xs text-fg-secondary">{run.agent_name}</span>
          <span className={cn('text-[10px]', cfg.text)}>{cfg.label}</span>
        </div>
        {kids.map((kid) => (
          <RunNode key={kid} runId={kid} depth={depth + 1} />
        ))}
      </>
    );
  }

  return (
    <div className="border-t border-border px-3 py-2">
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
        Crew · {detail.mission.title}
      </p>
      {roots.map((r) => (
        <RunNode key={r.id} runId={r.id} depth={0} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface SubAgentTaskCardProps extends ToolCallInfo {}

export function SubAgentTaskCard({ id, args, result, status: toolStatus }: SubAgentTaskCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [task, setTask] = useState<TaskResult | null>(null);
  const [missionDetail, setMissionDetail] = useState<MissionDetail | null>(null);
  const [stopped, setStopped] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(Date.now());

  // §6.2 — task_id lives in the tool result JSON, not args
  const parsedResult = parseResultJson(result);
  const taskId = (parsedResult?.task_id as string) ?? id;

  const agentType =
    (args.agent_id as string) ?? (args.type as string) ?? 'general-purpose';
  const prompt = (args.prompt as string) ?? '';

  // Derive display status from polled task (authoritative) or tool call status
  const taskStatus: string = stopped
    ? 'stopped'
    : task?.status ?? (toolStatus === 'error' ? 'failed' : 'running');
  const isRunning = taskStatus === 'running';

  const output = task?.result ?? task?.error;
  const statusCfg = STATUS_CFG[taskStatus] ?? STATUS_CFG.running;

  // §6.2 — elapsed timer while running
  useEffect(() => {
    if (!isRunning) return;
    startRef.current = Date.now();
    const t = setInterval(
      () => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [isRunning]);

  // §6.1 / §6.3 — poll task + mission
  const poll = useCallback(async () => {
    if (stopped) return;
    try {
      const t = await api.getTask(taskId);
      setTask(t);
      if (t.mission_id) {
        const md = await api.getMission(t.mission_id);
        setMissionDetail(md);
      }
    } catch {
      // ignore transient errors
    }
  }, [taskId, stopped]);

  useEffect(() => {
    poll(); // fetch immediately
    if (!isRunning) return;
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll, isRunning]);

  // Fetch once when tool call first completes (result arrives)
  useEffect(() => {
    if (toolStatus === 'completed' && !task) poll();
  }, [toolStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-expand short output
  useEffect(() => {
    if (task?.status === 'completed' && output && output.split('\n').length <= 8) {
      setExpanded(true);
    }
  }, [task?.status, output]);

  // §6.4 — stop / intervention
  const handleStop = useCallback(async () => {
    try {
      await api.deleteTask(taskId);
    } catch {
      // best-effort
    }
    setStopped(true);
  }, [taskId]);

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

        {/* Name + prompt */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium text-fg-primary">
              {task?.agent_name ?? AGENT_LABELS[agentType] ?? agentType}
            </span>
            <span className="rounded bg-bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-fg-muted">
              {agentType}
            </span>
          </div>
          {prompt && <p className="truncate text-xs text-fg-muted">{prompt}</p>}
        </div>

        {/* Status + elapsed + stop */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {isRunning && elapsed > 0 && (
            <span className="text-xs tabular-nums text-fg-muted">{formatElapsed(elapsed)}</span>
          )}
          <div className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', statusCfg.dot)} />
            <span className={cn('text-xs font-medium', statusCfg.text)}>{statusCfg.label}</span>
          </div>
          {/* §6.4 — Stop button */}
          {isRunning && (
            <button
              onClick={handleStop}
              className="rounded px-1.5 py-0.5 text-[10px] text-fg-muted hover:bg-bg-secondary hover:text-red-400"
            >
              Stop
            </button>
          )}
        </div>
      </div>

      {/* §6.1 / §6.3 — Mission timeline + Crew tree */}
      {missionDetail && <CrewTree detail={missionDetail} />}

      {/* Output section */}
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
            {task?.status === 'failed' ? 'Error' : 'Output'}
          </button>
          {expanded && (
            <pre className="max-h-64 overflow-auto bg-bg-primary px-3 py-2 font-mono text-xs text-fg-secondary">
              {output}
            </pre>
          )}
        </div>
      )}

      {/* §6.2 — Running spinner (while no output yet) */}
      {isRunning && !output && (
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
          <span className="text-xs text-fg-muted">Working…</span>
        </div>
      )}
    </div>
  );
}
