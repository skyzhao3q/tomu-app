import { useAtomValue } from 'jotai';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { activeThreadIdAtom } from './store/atoms';

export function App() {
  const activeThreadId = useAtomValue(activeThreadIdAtom);

  return (
    <div className="flex h-screen bg-bg-primary">
      <Sidebar />
      <main className="flex flex-1 flex-col">
        {activeThreadId ? (
          <ChatView />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-lg text-fg-muted">Start a conversation</p>
          </div>
        )}
      </main>
    </div>
  );
}
