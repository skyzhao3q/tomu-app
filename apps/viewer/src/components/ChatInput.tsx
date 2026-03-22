import { useRef, useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { cn } from '@tomu/ui';
import { isLoadingAtom, messagesAtom } from '../store/atoms';

interface ChatInputProps {
  onSend: (content: string) => void;
  onStop: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const isLoading = useAtomValue(isLoadingAtom);
  const messages = useAtomValue(messagesAtom);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Check if any tool is currently running
  const hasRunningTools = messages.some(
    (m) => m.toolCalls?.some((tc) => tc.status === 'running'),
  );

  const resetHeight = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, isLoading, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.nativeEvent.isComposing || e.keyCode === 229) return;
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  return (
    <div className="border-t border-border bg-bg-primary p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            resetHeight();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Message tomu..."
          disabled={disabled}
          rows={1}
          className={cn(
            'flex-1 resize-none bg-transparent text-sm text-fg-primary outline-none placeholder:text-fg-muted',
            disabled && 'cursor-not-allowed opacity-50',
          )}
          style={{ maxHeight: 200 }}
        />
        {isLoading ? (
          <button
            onClick={onStop}
            className={cn(
              'flex-shrink-0 rounded-md p-1.5',
              hasRunningTools
                ? 'animate-pulse text-red-400 hover:bg-red-400/10 hover:text-red-300'
                : 'text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary',
            )}
            aria-label="Stop generation"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            className={cn(
              'flex-shrink-0 rounded-md p-1.5',
              value.trim() && !disabled
                ? 'text-accent hover:bg-bg-tertiary'
                : 'cursor-not-allowed text-fg-muted opacity-40',
            )}
            aria-label="Send message"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
