import { useCallback, useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import {
  messagesAtom,
  isLoadingAtom,
  activeThreadIdAtom,
  threadsAtom,
  currentModelAtom,
  providersAtom,
  agentTasksAtom,
} from '../store/atoms';
import { api } from '../lib/api';
import type { ChatMessage, ToolCallInfo, AgentTask } from '../types';

export function useChat() {
  const [messages, setMessages] = useAtom(messagesAtom);
  const [isLoading, setIsLoading] = useAtom(isLoadingAtom);
  const [activeThreadId, setActiveThreadId] = useAtom(activeThreadIdAtom);
  const setThreads = useSetAtom(threadsAtom);
  const currentModel = useAtomValue(currentModelAtom);
  const providers = useAtomValue(providersAtom);
  const setAgentTasks = useSetAtom(agentTasksAtom);
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
        const activeProviderId = (() => {
          for (const p of providers) {
            if (p.models.some((m) => m.id === currentModel)) return p.id;
          }
          return providers.find((p) => p.enabled)?.id;
        })();
        const allMessages = [...messages, userMessage].map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await api.chatCompletions(
          {
            model: currentModel ?? '',
            messages: allMessages,
            thread_id: activeThreadId ?? undefined,
            provider_id: activeProviderId,
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
        let accumulatedReasoning = '';
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

                if (type === 'reasoning_delta') {
                  accumulatedReasoning += parsed.text ?? '';
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, reasoning: accumulatedReasoning, reasoningState: 'streaming' }
                        : m,
                    ),
                  );
                } else if (type === 'text_delta' || parsed.delta?.content) {
                  const deltaText = parsed.text ?? parsed.delta?.content ?? '';
                  accumulatedText += deltaText;
                  updateAssistant();
                } else if (type === 'tool_call_start') {
                  const callName = parsed.name as string;
                  const callType: ToolCallInfo['type'] = callName?.startsWith('skill:') ? 'skill' : 'tool';
                  const newCall: ToolCallInfo = {
                    id: parsed.id,
                    name: callName,
                    type: callType,
                    args: parsed.args ?? {},
                    status: 'running',
                    startedAt: Date.now(),
                  };
                  toolCalls = [...toolCalls, newCall];

                  if (callName === 'Task') {
                    const agentId = ((parsed.args?.agent_id ?? parsed.args?.type ?? 'general-purpose') as string);
                    const newTask: AgentTask = {
                      taskId: parsed.id,
                      agentId,
                      status: 'running',
                      description: (parsed.args?.prompt ?? '') as string,
                      input: parsed.args ?? {},
                      logs: [],
                      startedAt: Date.now(),
                      threadId: activeThreadId ?? '',
                    };
                    setAgentTasks((prev) => ({ ...prev, [parsed.id]: newTask }));
                  }

                  updateAssistant();
                } else if (type === 'tool_call_result') {
                  const existingCall = toolCalls.find((tc) => tc.id === parsed.id);
                  toolCalls = toolCalls.map((tc) =>
                    tc.id === parsed.id
                      ? { ...tc, result: parsed.result ?? '', status: 'completed' as const, endedAt: Date.now() }
                      : tc,
                  );

                  if (existingCall?.name === 'Task') {
                    let taskStatus: AgentTask['status'] = 'running';
                    let output: string | undefined;
                    let backendTaskId: string | undefined;
                    try {
                      const r = JSON.parse(parsed.result ?? '{}') as Record<string, unknown>;
                      if (r.status === 'failed' || r.error) {
                        taskStatus = 'failed';
                      } else if (r.status === 'running') {
                        taskStatus = 'running';
                        backendTaskId = r.task_id as string;
                      } else {
                        taskStatus = 'success';
                      }
                      output = (r.result ?? r.output ?? parsed.result) as string | undefined;
                    } catch {
                      taskStatus = 'failed';
                      output = parsed.result as string | undefined;
                    }
                    setAgentTasks((prev) => {
                      const existing = prev[parsed.id];
                      if (!existing) return prev;
                      return {
                        ...prev,
                        [parsed.id]: {
                          ...existing,
                          status: taskStatus,
                          output,
                          ...(taskStatus !== 'running' ? { endedAt: Date.now() } : {}),
                        },
                      };
                    });
                    const scheduleCleanup = (callId: string) => {
                      setTimeout(() => {
                        setAgentTasks((prev) => {
                          const next = { ...prev };
                          delete next[callId];
                          return next;
                        });
                      }, 5 * 60 * 1000);
                    };
                    if (backendTaskId) {
                      const callId = parsed.id;
                      const tid = backendTaskId;
                      const iv = setInterval(async () => {
                        try {
                          const t = await api.getTask(tid);
                          if (t.status === 'running') return;
                          clearInterval(iv);
                          const finalStatus: AgentTask['status'] = t.status === 'completed' ? 'success' : 'failed';
                          setAgentTasks((prev) => {
                            const ex = prev[callId];
                            if (!ex) return prev;
                            return {
                              ...prev,
                              [callId]: { ...ex, status: finalStatus, output: t.result, endedAt: Date.now() },
                            };
                          });
                          scheduleCleanup(callId);
                        } catch { /* ignore transient errors */ }
                      }, 3000);
                      // Safety: stop polling after 30 minutes regardless
                      setTimeout(() => clearInterval(iv), 30 * 60 * 1000);
                    } else {
                      scheduleCleanup(parsed.id);
                    }
                  }

                  updateAssistant();
                } else if (type === 'completion' || type === 'done') {
                  if (accumulatedReasoning) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantId ? { ...m, reasoningState: 'done' } : m,
                      ),
                    );
                  }
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
                tc.status === 'running' ? { ...tc, status: 'error' as const, result: 'Stopped by user', endedAt: Date.now() } : tc,
              );
              return {
                ...m,
                content: m.content + (m.content ? '\n\n' : '') + '_Generation stopped._',
                toolCalls: stoppedCalls,
              };
            }),
          );
          // Mark any running agent tasks as failed
          setAgentTasks((prev) => {
            const updated: typeof prev = {};
            for (const [id, task] of Object.entries(prev)) {
              updated[id] = task.status === 'running'
                ? { ...task, status: 'failed', error: 'Stopped by user', endedAt: Date.now() }
                : task;
            }
            return updated;
          });
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
      setAgentTasks,
    ],
  );

  const stopGeneration = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    if (isLoading) return;

    // Find the last user message
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') { lastUserIndex = i; break; }
    }
    if (lastUserIndex === -1) return;

    const lastUserMessage = messages[lastUserIndex];

    // Remove messages from the last user message onward
    setMessages((prev) => prev.slice(0, lastUserIndex));

    // Re-send the user message
    // Use setTimeout to let the state update propagate
    setTimeout(() => {
      sendMessage(lastUserMessage.content);
    }, 0);
  }, [isLoading, messages, setMessages, sendMessage]);

  return { messages, sendMessage, stopGeneration, retry, isLoading };
}
