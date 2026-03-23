import { useState } from 'react';

interface TerminalPreviewProps {
  command: string;
  output: string;
}

export function TerminalPreview({ command, output }: TerminalPreviewProps) {
  const lineCount = output.split('\n').length;
  const [open, setOpen] = useState(lineCount < 10);

  return (
    <div className="my-1.5 overflow-hidden rounded-lg border border-border">
      {/* Header */}
      <div className="flex items-center gap-2 bg-[#1a1a2e] px-3 py-1.5">
        <div className="flex gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
        </div>
        <span className="text-[10px] font-medium text-gray-400">Terminal</span>
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto text-[10px] text-gray-500 hover:text-gray-300"
        >
          {open ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {/* Command */}
      <div className="bg-[#0d0d1a] px-3 py-1.5 font-mono text-xs">
        <span className="text-green-400">$ </span>
        <span className="text-gray-200">{command}</span>
      </div>

      {/* Output */}
      {open && output && (
        <pre className="max-h-64 overflow-auto bg-[#0d0d1a] px-3 pb-2 pt-0 font-mono text-xs leading-relaxed text-gray-300">
          {output}
        </pre>
      )}

      {!open && output && (
        <div className="bg-[#0d0d1a] px-3 pb-1.5 pt-0">
          <span className="text-[10px] text-gray-500">
            {lineCount} lines — click Expand to view
          </span>
        </div>
      )}
    </div>
  );
}
