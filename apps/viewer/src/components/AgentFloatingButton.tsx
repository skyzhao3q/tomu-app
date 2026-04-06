import { useAtomValue, useSetAtom } from 'jotai';
import { agentTasksAtom, agentWindowOpenAtom } from '../store/atoms';

export function AgentFloatingButton() {
  const tasks = useAtomValue(agentTasksAtom);
  const setWindowOpen = useSetAtom(agentWindowOpenAtom);

  const taskList = Object.values(tasks);
  if (taskList.length === 0) return null;

  const hasRunning = taskList.some((t) => t.status === 'running' || t.status === 'pending');

  return (
    <button
      className="fixed bottom-4 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-600 shadow-lg transition-colors hover:bg-emerald-500"
      onClick={() => setWindowOpen((v) => !v)}
      aria-label="Toggle agent status"
    >
      {hasRunning && (
        <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-60" />
      )}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="relative h-5 w-5 text-white"
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
      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-bg-primary text-[9px] font-bold text-fg-primary ring-1 ring-border">
        {taskList.length}
      </span>
    </button>
  );
}
