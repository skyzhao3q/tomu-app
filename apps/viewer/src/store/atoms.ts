import { atom } from 'jotai';
import type { Thread, Provider, Config } from '@tomu/core';
import type { ChatMessage } from '../types';

const defaultConfig: Config = {
  theme: 'dark',
  language: 'en',
  agent_max_iterations: 25,
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
