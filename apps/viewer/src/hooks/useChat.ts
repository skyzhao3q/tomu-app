import { useCallback, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  messagesAtom,
  isLoadingAtom,
  activeThreadIdAtom,
  threadsAtom,
  currentModelAtom,
  providersAtom,
} from '../store/atoms';
import { api } from '../lib/api';
import type { ChatMessage, ToolCallInfo } from '../types';

export function useChat() {
  const [messages, setMessages] = useAtom(messagesAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom);
  const [activeThreadId, setActiveThreadId] = useAtom(activeThreadIdAtom);
  const setThreads = useSetAtom(threadsAtom);
  const currentModel = useAtomValue(currentModelAtom);
  const providers = useAtomValue(providersAtom);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'user',
        content,
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      const assistantId = crypto.randomUUID();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        toolCalls: [],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const activeProvider = providers.find((p) => p.enabled);
        const allMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await api.chatCompletions(
          {
            model: currentModel ?? '',
            messages: allMessages,
            thread_id: activeThreadId ?? undefined,
            provider_id: activeProvider?.id,
            stream: true,
          },
          controller.signal,
        );

        if (!res.ok) {
          const errorText = await res.text().catch(() => res.statusText);
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: `Error: ${errorText}` } : m,
            ),
          );
          setIsLoading(false);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) {
          setIsLoading(false);
          return;
        }

        const decoder = new TextDecoder();
        let buffer = '';
        let accumulatedText = '';
        let toolCalls: ToolCallInfo[] = [];

        const updateAssistant = () => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: accumulatedText, toolCalls: [...toolCalls] }
                : m,
            ),
          );
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';

          let eventType = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              eventType = line.slice(7).trim();
              continue;
            }

            if (line.startsWith('data: ')) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);

                // Support both named events (event: xxx) and typed payloads (parsed.type)
                const type = eventType || parsed.type;

                if (type === 'text_delta' || parsed.delta?.content) {
                  const deltaText = parsed.text ?? parsed.delta?.content ?? '';
                  accumulatedText += deltaText;
                  updateAssistant();
                } else if (type === 'tool_call_start') {
                  toolCalls = [
                    ...toolCalls,
                    {
                      id: parsed.id,
                      name: parsed.name,
                      args: parsed.args ?? {},
                      status: 'running',
                    },
                  ];
                  updateAssistant();
                } else if (type === 'tool_call_result') {
                  toolCalls = toolCalls.map((tc) =>
                    tc.id === parsed.id
                      ? { ...tc, result: parsed.result ?? '', status: 'completed' as const }
                      : tc,
                  );
                  updateAssistant();
                } else if (type === 'completion' || type === 'done') {
                  if (parsed.thread_id && !activeThreadId) {
                    setActiveThreadId(parsed.thread_id);
                  }
                } else if (type === 'error') {
                  const errMsg = parsed.error ?? parsed.message ?? 'Unknown error';
                  accumulatedText += `\n\nError: ${errMsg}`;
                  updateAssistant();
                }
              } catch {
                // skip unparseable lines
              }

              eventType = '';
            }
          }
        }
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          // Mark the message as stopped
          setMessages((prev) =>
            prev.map((m) => {
              if (m.id !== assistantId) return m;
              const stoppedCalls = m.toolCalls?.map((tc) =>
                tc.status === 'running' ? { ...tc, status: 'error' as const, result: 'Stopped by user' } : tc,
              );
              return {
                ...m,
                content: m.content + (m.content ? '\n\n' : '') + '_Generation stopped._',
                toolCalls: stoppedCalls,
              };
            }),
          );
        } else {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `Error: ${errorMsg}` }
                : m,
            ),
          );
        }
      } finally {
        abortRef.current = null;
        setIsLoading(false);
        api.getThreads().then(setThreads).catch(() => {});
      }
    },
    [
      isLoading,
      messages,
      activeThreadId,
      currentModel,
      providers,
      setMessages,
      setIsLoading,
      setActiveThreadId,
      setThreads,
    ],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, sendMessage, stopGeneration, isLoading };
}
