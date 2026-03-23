import { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@tomu/ui';
import type { ChatMessage } from '../types';
import { ToolCallDisplay } from './ToolCallDisplay';
import { SubAgentTaskCard } from './SubAgentTaskCard';

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

  if (message.role === 'system') {
    return (
      <div className="flex justify-center py-2">
        <span className="text-xs text-fg-muted">{message.content}</span>
      </div>
    );
  }

  const isUser = message.role === 'user';
  const hasToolCalls = message.toolCalls && message.toolCalls.length > 0;

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

      {/* Text content (before tool calls) */}
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

      {/* Tool calls */}
      {hasToolCalls && (
        <div className="w-full max-w-[80%]">
          {message.toolCalls!.map((tc) =>
            tc.name === 'Task' ? (
              <SubAgentTaskCard key={tc.id} {...tc} />
            ) : (
              <ToolCallDisplay key={tc.id} {...tc} />
            ),
          )}
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
