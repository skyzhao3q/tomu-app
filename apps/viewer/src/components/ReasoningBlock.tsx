import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@tomu/ui';

interface ReasoningBlockProps {
  text: string;
  state: 'streaming' | 'done';
  rightSlot?: React.ReactNode;
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5a3 3 0 1 0-5.993.142A4.002 4.002 0 0 0 4 13c0 1.657.672 3.157 1.757 4.243A2 2 0 0 0 7.5 21h9a2 2 0 0 0 1.743-2.757A4.002 4.002 0 0 0 20 13a4.002 4.002 0 0 0-2.007-3.458A3 3 0 0 0 12 5Z" />
      <path d="M12 13a3 3 0 0 0-3 3" />
      <path d="M15 13a3 3 0 0 1 3 3" />
    </svg>
  );
}

export function ReasoningBlock({ text, state, rightSlot }: ReasoningBlockProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [duration, setDuration] = useState<number | null>(null);
  const startTimeRef = useRef<number | null>(null);

  // Open and start timer when streaming begins
  useEffect(() => {
    if (state === 'streaming') {
      if (!startTimeRef.current) startTimeRef.current = Date.now();
      setIsOpen(true);
    }
  }, [state]);

  // Compute duration and auto-close 1s after streaming completes
  useEffect(() => {
    if (state === 'done' && startTimeRef.current) {
      setDuration(Math.round((Date.now() - startTimeRef.current) / 1000));
      startTimeRef.current = null;
      const timer = setTimeout(() => setIsOpen(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [state]);

  const label =
    state === 'streaming'
      ? '思考中...'
      : duration !== null
        ? `思考プロセス (${duration}s)`
        : '思考プロセス';

  return (
    <div className="mb-2">
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-fg-muted hover:bg-bg-tertiary hover:text-fg-secondary transition-colors"
        >
          <BrainIcon
            className={cn(
              'h-3.5 w-3.5',
              state === 'streaming' && 'animate-pulse text-accent',
            )}
          />
          <span>{label}</span>
          <svg
            className={cn('h-3 w-3 transition-transform', isOpen && 'rotate-90')}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5l8 7-8 7z" />
          </svg>
        </button>
        {rightSlot}
      </div>

      {isOpen && (
        <div className="border-l-2 border-border pl-3 mt-1 text-xs text-fg-muted">
          <div className="prose-invert prose-xs max-w-none [&_pre]:overflow-x-auto [&_pre]:rounded [&_pre]:bg-bg-tertiary [&_pre]:p-2 [&_pre]:text-xs [&_code]:rounded [&_code]:bg-bg-tertiary [&_code]:px-1 [&_code]:text-xs">
            <ReactMarkdown>{text}</ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
