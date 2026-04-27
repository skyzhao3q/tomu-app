import { useState } from 'react';
import { useAtom, useAtomValue } from 'jotai';
import { cn } from '@tomu/ui';
import { agentTasksAtom, agentWindowOpenAtom } from '../store/atoms';
import { LogStreamViewer } from './LogStreamViewer';
import type { AgentTask } from '../types';

const STATUS_CFG: Record<string, { dot: string; text: string; label: string }> = {
  pending: { dot: 'bg-yellow-400', text: 'text-yellow-400', label: 'Pending' },
  running: { dot: 'bg-emerald-400 animate-pulse', text: 'text-emerald-400', label: 'Running' },
  success: { dot: 'bg-green-400', text: 'text-green-400', label: 'Completed' },
  failed:  { dot: 'bg-red-400', text: 'text-red-400', label: 'Failed' },
};

function AgentTaskCard({ task }: { task: AgentTask }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = STATUS_CFG[task.status] ?? STATUS_CFG.running;

  const logs =
    task.logs.length > 0
      ? task.logs
      : task.output
        ? [task.output]
        : task.error
          ? [`Error: ${task.error}`]
          : [];

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left hover:bg-white/5"
        onClick={() => setExpanded((v) => !v)}
      >
        <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', cfg.dot)} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-fg-primary">
            {task.description || task.agentId}
          </p>
          <p className="text-[10px] text-fg-muted">{task.agentId}</p>
        </div>
        <span className={cn('flex-shrink-0 text-[10px] font-medium', cfg.text)}>{cfg.label}</span>
        <svg
          className={cn('h-3 w-3 flex-shrink-0 text-fg-muted transition-transform', expanded && 'rotate-90')}
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8 5l8 7-8 7z" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3">
          <LogStreamViewer logs={logs} />
        </div>
      )}
    </div>
  );
}

export function AgentStatusWindow() {
  const [windowOpen, setWindowOpen] = useAtom(agentWindowOpenAtom);
  const tasks = useAtomValue(agentTasksAtom);

  if (!windowOpen) return null;

  const taskList = Object.values(tasks);

  return (
    <div className="fixed bottom-20 right-4 z-50 w-96 overflow-hidden rounded-xl border border-border bg-bg-secondary shadow-2xl">
      <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
        <div className="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 8V4H8" />
            <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
            <path d="M8 14h.01M16 14h.01M9.5 18a6.5 6.5 0 006 0" />
          </svg>
          <span className="text-sm font-medium text-fg-primary">Agent Tasks</span>
          <span className="rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
            {taskList.length}
          </span>
        </div>
        <button
          className="rounded p-1 text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary"
          onClick={() => setWindowOpen(false)}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="max-h-[28rem] overflow-y-auto">
        {taskList.length === 0 ? (
          <p className="px-3 py-4 text-center text-xs text-fg-muted">No agent tasks</p>
        ) : (
          taskList.map((task) => <AgentTaskCard key={task.taskId} task={task} />)
        )}
      </div>
    </div>
  );
}
