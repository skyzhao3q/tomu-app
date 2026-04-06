import { useState } from 'react';
import { cn } from '@tomu/ui';
import type { ToolCallInfo } from '../types';

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn('h-3 w-3 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn('h-3 w-3 transition-transform', open && 'rotate-90')}
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M8 5l8 7-8 7z" />
    </svg>
  );
}

function ToolCallItem({ tc }: { tc: ToolCallInfo }) {
  const [open, setOpen] = useState(false);
  const isSkill = tc.type === 'skill';

  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={cn('flex-shrink-0 text-xs', isSkill ? 'text-purple-400' : 'text-blue-400')}>
          {isSkill ? '✨' : '⚙️'}
        </span>
        <span className="flex-1 truncate text-xs text-fg-secondary">{tc.name}</span>
        {tc.status === 'running' ? (
          <SpinnerIcon className="flex-shrink-0 text-blue-400" />
        ) : tc.status === 'error' ? (
          <svg className="h-3 w-3 flex-shrink-0 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        ) : (
          <ChevronIcon open={open} />
        )}
      </button>
      {open && (
        <div className="space-y-1.5 px-3 pb-2">
          <div>
            <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">Input</p>
            <pre className="max-h-24 overflow-x-auto rounded bg-bg-primary p-2 font-mono text-[10px] text-fg-secondary">
              {JSON.stringify(tc.args, null, 2)}
            </pre>
          </div>
          {tc.result && (
            <div>
              <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">Output</p>
              <pre className="max-h-32 overflow-auto rounded bg-bg-primary p-2 font-mono text-[10px] text-fg-secondary">
                {tc.result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ToolSkillSummaryBadgeProps {
  toolCalls: ToolCallInfo[];
}

export function ToolSkillSummaryBadge({ toolCalls }: ToolSkillSummaryBadgeProps) {
  const [hovered, setHovered] = useState(false);

  if (toolCalls.length === 0) return null;

  const tools = toolCalls.filter((tc) => tc.type !== 'skill');
  const skills = toolCalls.filter((tc) => tc.type === 'skill');
  const hasRunning = toolCalls.some((tc) => tc.status === 'running');

  const parts: string[] = [];
  if (tools.length > 0) parts.push(`⚙️ ${tools.length} Tool${tools.length > 1 ? 's' : ''}`);
  if (skills.length > 0) parts.push(`✨ ${skills.length} Skill${skills.length > 1 ? 's' : ''}`);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={cn(
          'flex cursor-default items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
          hasRunning
            ? 'border-blue-500/30 bg-blue-500/10 text-blue-400'
            : 'border-border/60 bg-bg-tertiary text-fg-secondary',
        )}
      >
        {hasRunning && <SpinnerIcon />}
        <span>{parts.join(' · ')}</span>
        {hasRunning && <span className="text-[10px] text-fg-muted">running…</span>}
      </div>

      {hovered && (
        <div className="absolute bottom-full left-0 z-50 mb-2 w-80 overflow-hidden rounded-lg border border-border bg-bg-secondary shadow-xl">
          <div className="border-b border-border px-3 py-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Tool Calls</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {toolCalls.map((tc) => (
              <ToolCallItem key={tc.id} tc={tc} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
