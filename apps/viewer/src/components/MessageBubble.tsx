import { useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import ReactMarkdown from 'react-markdown';
import { cn } from '@tomu/ui';
import type { ChatMessage } from '../types';
import { ToolCallDisplay } from './ToolCallDisplay';
import { SubAgentTaskCard } from './SubAgentTaskCard';
import { WidgetFrame } from './WidgetFrame';
import { ReasoningBlock } from './ReasoningBlock';
import { PreprocessIndicator } from './PreprocessIndicator';
import { isLoadingAtom } from '../store/atoms';

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
      {message.content && (
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
      )}

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
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;
  const hasRunningTools = message.toolCalls?.some(tc => tc.status === 'running') ?? false;
  const isStreaming = message.contentState === 'streaming';

  // Show PreprocessIndicator when assistant message is empty (waiting for first token)
  const showPreprocess =
    !isUser &&
    isLast &&
    isLoading &&
    !message.content &&
    !hasToolCalls &&
    !message.reasoning;

  if (isUser) {
    return (
      <div
        className="group relative flex flex-col items-end gap-1 py-1"
        onMouseEnter={() => setShowTime(true)}
        onMouseLeave={() => setShowTime(false)}
      >
        <HoverActions message={message} isLast={isLast} onRetry={onRetry} />
        <div className="max-w-[75%] rounded-xl bg-accent px-4 py-2.5 text-sm text-white">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
        <div className={cn('px-2 transition-opacity duration-150', showTime ? 'opacity-100' : 'opacity-0')}>
          <RelativeTime timestamp={message.timestamp} />
        </div>
      </div>
    );
  }

  // Assistant message — full-width block layout
  return (
    <div
      className="group relative flex flex-col items-start gap-1.5 py-2"
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
      <HoverActions message={message} isLast={isLast} onRetry={onRetry} />

      {/* PreprocessIndicator: shown before any content arrives */}
      {showPreprocess && <PreprocessIndicator />}

      {/* Reasoning block */}
      {message.reasoning && (
        <ReasoningBlock
          text={message.reasoning}
          state={message.reasoningState ?? 'done'}
        />
      )}

      {/* Tool calls */}
      {hasToolCalls && (
        <div className="w-full">
          {message.toolCalls!.map((tc) => {
            if (tc.name === 'Task') {
              return <SubAgentTaskCard key={tc.id} {...tc} />;
            }

            const WIDGET_TOOLS = ['widgetRenderer', 'pieChart', 'barChart'];
            if (WIDGET_TOOLS.includes(tc.name) && tc.result) {
              try {
                const parsed = JSON.parse(tc.result);
                if (parsed && typeof parsed.widget_id === 'string' && typeof parsed.html === 'string') {
                  return (
                    <WidgetFrame
                      key={tc.id}
                      widgetId={parsed.widget_id}
                      html={parsed.html}
                      title={parsed.title}
                    />
                  );
                }
              } catch {
                // fall through
              }
            }

            return <ToolCallDisplay key={tc.id} {...tc} />;
          })}
        </div>
      )}

      {/* Image content (PhotoCard) */}
      {message.images && message.images.length > 0 && (
        <div className="w-full max-w-[80%] space-y-1.5">
          {message.images.map((src, i) => (
            <div key={i} className="overflow-hidden rounded-xl border border-border shadow-sm">
              <img
                src={src}
                alt="AI Generated"
                className="w-full h-auto object-cover"
                loading="lazy"
              />
              <div className="flex items-center justify-between bg-bg-tertiary px-3 py-1.5">
                <span className="text-xs text-fg-muted">Generated by AI</span>
                <a
                  href={src}
                  download={`tomu-image-${i + 1}.jpg`}
                  className="text-xs text-accent hover:underline"
                >
                  Download
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Text content */}
      {message.content && !hasRunningTools && (
        <div className="w-full text-sm text-fg-primary">
          <div className="prose-invert prose-sm max-w-none [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:bg-bg-tertiary [&_pre]:p-3 [&_pre]:text-xs [&_code]:rounded [&_code]:bg-bg-tertiary [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-xs [&_a]:text-accent [&_a]:underline">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
          {isStreaming && (
            <span className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[2px] animate-pulse bg-accent opacity-75" aria-hidden />
          )}
        </div>
      )}

      <div className={cn('px-1 transition-opacity duration-150', showTime ? 'opacity-100' : 'opacity-0')}>
        <RelativeTime timestamp={message.timestamp} />
      </div>
    </div>
  );
}
