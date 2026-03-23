import { useRef, useState, useCallback } from 'react';
import { useAtomValue } from 'jotai';
import { cn } from '@tomu/ui';
import { isLoadingAtom, messagesAtom } from '../store/atoms';
import { ModelSelector } from './ModelSelector';

interface FileAttachment {
  id: string;
  file: File;
  preview?: string;
}

interface ChatInputProps {
  onSend: (content: string, attachments?: FileAttachment[]) => void;
  onStop: () => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, onStop, disabled }: ChatInputProps) {
  const [value, setValue] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);
  const isLoading = useAtomValue(isLoadingAtom);
  const messages = useAtomValue(messagesAtom);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if ((!trimmed && attachments.length === 0) || isLoading || disabled) return;
    onSend(trimmed, attachments.length > 0 ? attachments : undefined);
    setValue('');
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, attachments, isLoading, disabled, onSend]);

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

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newAttachments: FileAttachment[] = [];
      for (const file of Array.from(files)) {
        const attachment: FileAttachment = {
          id: crypto.randomUUID(),
          file,
        };
        if (file.type.startsWith('image/')) {
          attachment.preview = URL.createObjectURL(file);
        }
        newAttachments.push(attachment);
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
      // Reset input so same file can be selected again
      e.target.value = '';
    },
    [],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  return (
    <div className="border-t border-border bg-bg-primary p-4">
      <div className="mx-auto max-w-3xl">
        {/* File attachment chips */}
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="flex items-center gap-1.5 rounded-md border border-border bg-bg-secondary px-2 py-1"
              >
                {att.preview ? (
                  <img
                    src={att.preview}
                    alt={att.file.name}
                    className="h-6 w-6 rounded object-cover"
                  />
                ) : (
                  <svg
                    className="h-4 w-4 text-fg-muted"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                )}
                <span className="max-w-[120px] truncate text-xs text-fg-secondary">
                  {att.file.name}
                </span>
                <button
                  onClick={() => removeAttachment(att.id)}
                  className="ml-0.5 text-fg-muted hover:text-fg-primary"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2 rounded-lg border border-border bg-bg-secondary px-3 py-2">
          {/* Model selector */}
          <ModelSelector />

          {/* File attachment button */}
          <button
            type="button"
            onClick={handleFileSelect}
            disabled={disabled}
            className={cn(
              'flex-shrink-0 rounded-md p-1.5 text-fg-muted hover:bg-bg-tertiary hover:text-fg-primary',
              disabled && 'cursor-not-allowed opacity-50',
            )}
            aria-label="Attach file"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.txt,.md,.json,.csv,.xml,.yaml,.yml,.toml"
            onChange={handleFileChange}
            className="hidden"
          />

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
              disabled={!value.trim() && attachments.length === 0 || disabled}
              className={cn(
                'flex-shrink-0 rounded-md p-1.5',
                (value.trim() || attachments.length > 0) && !disabled
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
    </div>
  );
}
