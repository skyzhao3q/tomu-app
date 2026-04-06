import { atom } from 'jotai';
import type { Thread, Provider, Config, AgentsConfig } from '@tomu/core';
import type { ChatMessage, AgentTask } from '../types';

const defaultConfig: Config = {
  theme: 'dark',
  language: 'en',
  agent_max_iterations: 25,
  agents_enabled: true,
  agents_allow_delegation: true,
};

export const threadsAtom = atom<Thread[]>([]);
export const activeThreadIdAtom = atom<string | null>(null);
export const providersAtom = atom<Provider[]>([]);
export const settingsAtom = atom<Config>(defaultConfig);

export const activeThreadAtom = atom<Thread | undefined>((get) => {
  const id = get(activeThreadIdAtom);
  if (!id) return undefined;
  return get(threadsAtom).find((t) => t.thread_id === id);
});

export const isLoadingAtom = atom<boolean>(false);
export const currentModelAtom = atom<string | null>(null);
export const messagesAtom = atom<ChatMessage[]>([]);
export const memoryPanelOpenAtom = atom<boolean>(false);
export const settingsModalOpenAtom = atom<boolean>(false);
export const searchModalOpenAtom = atom<boolean>(false);
export const usageDashboardOpenAtom = atom<boolean>(false);
export const agentsConfigAtom = atom<AgentsConfig | null>(null);
export const agentTasksAtom = atom<Record<string, AgentTask>>({});
export const agentWindowOpenAtom = atom<boolean>(false);
