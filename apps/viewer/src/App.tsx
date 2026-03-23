import { useAtomValue } from 'jotai';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { MemoryPanel } from './components/MemoryPanel';
import { SettingsModal } from './components/SettingsModal';
import { activeThreadIdAtom, memoryPanelOpenAtom, settingsModalOpenAtom } from './store/atoms';

export function App() {
  const activeThreadId = useAtomValue(activeThreadIdAtom);
  const memoryPanelOpen = useAtomValue(memoryPanelOpenAtom);
  const settingsModalOpen = useAtomValue(settingsModalOpenAtom);

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
      {memoryPanelOpen && <MemoryPanel />}
      {settingsModalOpen && <SettingsModal />}
    </div>
  );
}
