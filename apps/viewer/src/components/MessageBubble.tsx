import { useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import ReactMarkdown from 'react-markdown';
import { cn } from '@tomu/ui';
import type { ChatMessage, ToolCallInfo } from '../types';
import { ToolCallDisplay } from './ToolCallDisplay';
import { ToolSkillSummaryBadge } from './ToolSkillSummaryBadge';
import { SubAgentTaskCard } from './SubAgentTaskCard';
import { WidgetFrame } from './WidgetFrame';
import { ReasoningBlock } from './ReasoningBlock';
import { PreprocessIndicator } from './PreprocessIndicator';
import { isLoadingAtom } from '../store/atoms';

const WIDGET_TOOLS = ['widgetRenderer', 'pieChart', 'barChart'];
const IMAGE_TOOLS = ['GenerateImage'];

function isValidWidgetCall(tc: ToolCallInfo): boolean {
  if (!WIDGET_TOOLS.includes(tc.name) || !tc.result) return false;
  try {
    const parsed = JSON.parse(tc.result);
    return typeof parsed?.widget_id === 'string' && typeof parsed?.html === 'string';
  } catch {
    return false;
  }
}

/** Compact agent status badge shown inline next to the reasoning block */
function AgentCallBadge({ args, status }: ToolCallInfo) {
  const agentId = (args.agent_id as string) ?? (args.type as string) ?? 'agent';
  const isRunning = status === 'running';
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs',
        isRunning
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
          : 'border-border/60 bg-bg-tertiary text-fg-secondary',
      )}
    >
      {isRunning && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
      <span>🤖</span>
      <span>{agentId}</span>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  isLast?: boolean;
  onRetry?: () => void;
}

function RelativeTime({ timestamp }: { timestamp: string }) {
  const date = new Date(timestamp);
  return (
    <time className="text-xs text-fg-muted" dateTime={timestamp}>
      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </time>
  );
}

function HoverActions({
  message,
  isLast,
  onRetry,
}: {
  message: ChatMessage;
  isLast?: boolean;
  onRetry?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [message.content]);

  return (
    <div className="absolute -top-3 right-2 flex items-center gap-0.5 rounded-md border border-border bg-bg-secondary px-1 py-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="rounded p-1 text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary"
        aria-label="Copy message"
      >
        {copied ? (
          <svg className="h-3.5 w-3.5 text-green-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
          </svg>
        )}
      </button>

      {/* Retry button — only for last assistant message */}
      {message.role === 'assistant' && isLast && onRetry && (
        <button
          onClick={onRetry}
          className="rounded p-1 text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary"
          aria-label="Retry message"
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function MessageBubble({ message, isLast, onRetry }: MessageBubbleProps) {
  const [showTime, setShowTime] = useState(false);
  const isLoading = useAtomValue(isLoadingAtom);

  if (message.role === 'system') {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-fg-muted">{message.content}</span>
      </div>
    );
  }

  const isUser = message.role === 'user';

  // Categorise tool calls once for assistant messages
  const allCalls = (!isUser && message.toolCalls) ? message.toolCalls : [];
  const agentCalls = allCalls.filter((tc) => tc.name === 'Task');
  const widgetCalls = allCalls.filter((tc) => WIDGET_TOOLS.includes(tc.name));
  const imageCalls = allCalls.filter((tc) => IMAGE_TOOLS.includes(tc.name));
  const inlineCalls = allCalls.filter((tc) => tc.name !== 'Task' && !WIDGET_TOOLS.includes(tc.name) && !IMAGE_TOOLS.includes(tc.name));
  const toolOnlyCalls = inlineCalls.filter((tc) => tc.type !== 'skill');
  const skillOnlyCalls = inlineCalls.filter((tc) => tc.type === 'skill');

  // Show PreprocessIndicator when assistant message is empty (waiting for first token)
  const showPreprocess =
    !isUser &&
    isLast &&
    isLoading &&
    !message.content &&
    allCalls.length === 0 &&
    !message.reasoning;

  // Slot shown to the right of the 思考プロセス button (and standalone when no reasoning)
  const processingBadges =
    inlineCalls.length > 0 || agentCalls.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {toolOnlyCalls.length > 0 && <ToolSkillSummaryBadge toolCalls={toolOnlyCalls} />}
        {skillOnlyCalls.length > 0 && <ToolSkillSummaryBadge toolCalls={skillOnlyCalls} />}
        {agentCalls.map((tc) => (
          <AgentCallBadge key={tc.id} {...tc} />
        ))}
      </div>
    ) : null;

  return (
    <div
      className={cn('group relative flex flex-col gap-1 py-1', isUser ? 'items-end' : 'items-start')}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      {/* Hover actions */}
      {message.content && (
        <HoverActions message={message} isLast={isLast} onRetry={onRetry} />
      )}

      {/* PreprocessIndicator: shown before any content arrives */}
      {showPreprocess && <PreprocessIndicator />}

      {/* ── Processing section (reasoning + tool/agent badges) ── */}
      {!isUser && (message.reasoning || processingBadges) && (
        <div className="w-full max-w-[80%]">
          {message.reasoning ? (
            /* Reasoning present: show badges to the right of the button */
            <ReasoningBlock
              text={message.reasoning}
              state={message.reasoningState ?? 'done'}
              rightSlot={processingBadges}
            />
          ) : (
            /* No reasoning: badges standalone before text */
            <div className="mb-2">{processingBadges}</div>
          )}

          {/* SubAgentTaskCards — detailed monitoring, part of processing section */}
          {agentCalls.length > 0 && (
            <div className="space-y-1">
              {agentCalls.map((tc) => (
                <SubAgentTaskCard key={tc.id} {...tc} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Text content ── */}
      {message.content && (
        <div
          className={cn(
            'max-w-[80%] rounded-xl px-4 py-2.5 text-sm',
            isUser
              ? 'bg-accent text-white'
              : 'bg-bg-secondary text-fg-primary',
          )}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose-invert prose-sm max-w-none [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-bg-tertiary [&_pre]:p-3 [&_pre]:text-xs [&_code]:rounded [&_code]:bg-bg-tertiary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_a]:text-accent [&_a]:underline">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {/* ── Widget frames (output visualisations, below text) ── */}
      {widgetCalls.length > 0 && (
        <div className="w-full max-w-[80%] space-y-1">
          {widgetCalls.map((tc) => {
            if (isValidWidgetCall(tc)) {
              const parsed = JSON.parse(tc.result!);
              return (
                <WidgetFrame
                  key={tc.id}
                  widgetId={parsed.widget_id}
                  html={parsed.html}
                  title={parsed.title}
                />
              );
            }
            return <ToolCallDisplay key={tc.id} {...tc} />;
          })}
        </div>
      )}

      {/* ── Generated images ── */}
      {imageCalls.length > 0 && (
        <div className="w-full max-w-[80%] space-y-1.5">
          {imageCalls.map((tc) => {
            let imageUrl: string | null = null;
            let prompt: string | null = null;
            try {
              const parsed = JSON.parse(tc.result ?? '{}');
              if (typeof parsed.imageUrl === 'string') imageUrl = parsed.imageUrl;
              if (typeof parsed.prompt === 'string') prompt = parsed.prompt;
            } catch {
              // fall through
            }
            if (imageUrl) {
              return (
                <div key={tc.id} className="overflow-hidden rounded-xl border border-border shadow-sm">
                  <img
                    src={imageUrl}
                    alt={prompt ?? 'AI Generated'}
                    className="w-full h-auto object-cover"
                    loading="lazy"
                  />
                  <div className="flex items-center justify-between bg-bg-tertiary px-3 py-1.5">
                    <span className="text-xs text-fg-muted">{prompt ?? 'AI Generated'}</span>
                    <a href={imageUrl} download className="text-xs text-accent hover:underline">Download</a>
                  </div>
                </div>
              );
            }
            return <ToolCallDisplay key={tc.id} {...tc} />;
          })}
        </div>
      )}

      <div
        className={cn(
          'px-2 transition-opacity duration-150',
          showTime ? 'opacity-100' : 'opacity-0',
        )}
      >
        <RelativeTime timestamp={message.timestamp} />
      </div>
    </div>
  );
}
