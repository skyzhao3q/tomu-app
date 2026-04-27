export interface ToolCallInfo {
  id: string;
  name: string;
  type?: 'tool' | 'skill';
  args: Record<string, unknown>;
  result?: string;
  status: 'running' | 'completed' | 'error';
  startedAt?: number;
  endedAt?: number;
}

export interface AgentTask {
  taskId: string;
  agentId: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  description: string;
  input: Record<string, unknown>;
  output?: string;
  error?: string;
  logs: string[];
  startedAt: number;
  endedAt?: number;
  threadId: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  images?: string[];
  contentState?: 'streaming' | 'done';
  reasoning?: string;
  reasoningState?: 'streaming' | 'done';
  toolCalls?: ToolCallInfo[];
  timestamp: string;
}
