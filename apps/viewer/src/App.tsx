import { useEffect } from 'react';
import { useAtomValue, useSetAtom } from 'jotai';
import { Sidebar } from './components/Sidebar';
import { ChatView } from './components/ChatView';
import { MemoryPanel } from './components/MemoryPanel';
import { UsageDashboard } from './components/UsageDashboard';
import { SettingsModal } from './components/SettingsModal';
import { ThreadSearchModal } from './components/ThreadSearchModal';
import { AgentFloatingButton } from './components/AgentFloatingButton';
import { AgentStatusWindow } from './components/AgentStatusWindow';
import { activeThreadIdAtom, memoryPanelOpenAtom, usageDashboardOpenAtom, settingsModalOpenAtom, searchModalOpenAtom, providersAtom, settingsAtom, currentModelAtom, threadsAtom } from './store/atoms';
import { api } from './lib/api';

export function App() {
  const activeThreadId = useAtomValue(activeThreadIdAtom);
  const memoryPanelOpen = useAtomValue(memoryPanelOpenAtom);
  const usageDashboardOpen = useAtomValue(usageDashboardOpenAtom);
  const settingsModalOpen = useAtomValue(settingsModalOpenAtom);
  const searchModalOpen = useAtomValue(searchModalOpenAtom);
  const setSearchModalOpen = useSetAtom(searchModalOpenAtom);
  const setProviders = useSetAtom(providersAtom);
  const setSettings = useSetAtom(settingsAtom);
  const setCurrentModel = useSetAtom(currentModelAtom);
  const setThreads = useSetAtom(threadsAtom);

  useEffect(() => {
    Promise.all([api.getProviders(), api.getSettings(), api.getThreads()])
      .then(([providers, settings, threads]) => {
        setProviders(providers);
        setSettings(settings);
        setThreads(threads);
        if (settings.default_model_id) {
          setCurrentModel(settings.default_model_id);
        }
      })
      .catch(() => {});
  }, [setProviders, setSettings, setCurrentModel, setThreads]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchModalOpen((open) => !open);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setSearchModalOpen]);

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
      {usageDashboardOpen && <UsageDashboard />}
      {settingsModalOpen && <SettingsModal />}
      {searchModalOpen && <ThreadSearchModal />}
      <AgentFloatingButton />
      <AgentStatusWindow />
    </div>
  );
}
