import { useEffect, useRef } from 'react';
import { useChat } from '../hooks/useChat';
import { ChatInput } from './ChatInput';
import { MessageBubble } from './MessageBubble';

export function ChatView() {
  const { messages, sendMessage, stopGeneration } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4">
        <div className="mx-auto max-w-3xl py-6">
          {messages.length === 0 ? (
            <div className="flex h-full items-center justify-center pt-32">
              <p className="text-fg-muted">Start a conversation</p>
            </div>
          ) : (
            messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
          )}
          <div ref={bottomRef} />
        </div>
      </div>
      <ChatInput onSend={sendMessage} onStop={stopGeneration} />
    </div>
  );
}
