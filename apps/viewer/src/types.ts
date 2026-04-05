export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  status: 'running' | 'completed' | 'error';
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  reasoningState?: 'streaming' | 'done';
  toolCalls?: ToolCallInfo[];
  timestamp: string;
}
