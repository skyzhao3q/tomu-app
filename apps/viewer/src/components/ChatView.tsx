import { useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';

export function ChatView() {
  const { messages, sendMessage, stopGeneration, retry } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Find the last assistant message index
  let lastAssistantIndex = -1;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') { lastAssistantIndex = i; break; }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4">
        <div className="mx-auto max-w-3xl py-6">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center pt-32">
              <p className="text-fg-muted">Start a conversation</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                isLast={i === lastAssistantIndex}
                onRetry={retry}
              />
            ))
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <ChatInput onSend={sendMessage} onStop={stopGeneration} />
    </div>
  );
}
