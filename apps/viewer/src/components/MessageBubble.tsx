import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@tomu/ui';
import type { ChatMessage } from '../types';
import { ToolCallDisplay } from './ToolCallDisplay';

interface MessageBubbleProps {
  message: ChatMessage;
}

function RelativeTime({ timestamp }: { timestamp: string }) {
  const date = new Date(timestamp);
  return (
    <time className="text-xs text-fg-muted" dateTime={timestamp}>
      {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
    </time>
  );
}

export function MessageBubble({ message }: MessageBubbleProps) {
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
      className={cn('flex flex-col gap-1 py-1', isUser ? 'items-end' : 'items-start')}
      onMouseEnter={() => setShowTime(true)}
      onMouseLeave={() => setShowTime(false)}
    >
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
          {message.toolCalls!.map((tc) => (
            <ToolCallDisplay key={tc.id} {...tc} />
          ))}
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
