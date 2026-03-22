import type { Provider, Config, Model, Thread } from '@tomu/core';

const API_BASE = '/api';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchJSON<T>(
  path: string,
  options?: { method?: string; body?: unknown },
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options?.method ?? 'GET',
    headers: options?.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new ApiError(res.status, text);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface CreateProviderRequest {
  name: string;
  type: Provider['type'];
  api_key?: string;
  base_url?: string;
}

export interface ChatRequest {
  model: string;
  messages: Array<{ role: string; content: string }>;
  thread_id?: string;
  provider_id?: string;
  stream?: boolean;
}

export const api = {
  // Health
  health: () => fetchJSON<{ status: string }>('/health'),

  // Providers
  getProviders: () => fetchJSON<Provider[]>('/providers'),
  createProvider: (data: CreateProviderRequest) =>
    fetchJSON<Provider>('/providers', { method: 'POST', body: data }),
  deleteProvider: (id: string) =>
    fetchJSON<void>(`/providers/${id}`, { method: 'DELETE' }),
  testProvider: (id: string) =>
    fetchJSON<{ success: boolean; error?: string }>(`/providers/${id}/test`, {
      method: 'POST',
    }),
  fetchModels: (id: string) =>
    fetchJSON<Model[]>(`/providers/${id}/models/fetch`, { method: 'POST' }),

  // Settings
  getSettings: () => fetchJSON<Config>('/settings'),
  updateSettings: (data: Partial<Config>) =>
    fetchJSON<Config>('/settings', { method: 'PUT', body: data }),

  // Threads
  getThreads: () => fetchJSON<Thread[]>('/threads'),
  createThread: () =>
    fetchJSON<Thread>('/threads', { method: 'POST', body: {} }),
  getThread: (id: string) => fetchJSON<Thread>(`/threads/${id}`),
  deleteThread: (id: string) =>
    fetchJSON<void>(`/threads/${id}`, { method: 'DELETE' }),

  // Chat (SSE streaming)
  chatCompletions: (body: ChatRequest, signal?: AbortSignal) => {
    return fetch(`${API_BASE}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
  },
};
