"use client";

import { useRef } from "react";
import type { UIMessage } from "ai";
import { useStickToBottom } from "@/hooks/use-stick-to-bottom";
import { Message } from "./message";
import { ThinkingIndicator } from "./thinking-indicator";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

interface MessageListProps {
  messages: UIMessage[];
  status: ChatStatus;
}

export function MessageList({ messages, status }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isAtBottom, scrollToBottom } = useStickToBottom({ scrollRef, contentRef });

  const lastMessage = messages[messages.length - 1];
  const isGenerating = status === "streaming" || status === "submitted";
  // Before the SDK has appended an assistant placeholder for this turn
  // (status 'submitted', last message still the user's), show a standalone
  // indicator bubble. Once the assistant message exists, Message itself
  // handles the indicator-to-text handoff in the same bubble.
  const awaitingAssistantMessage = status === "submitted" && lastMessage?.role !== "assistant";
  const streamingMessageId = isGenerating && lastMessage?.role === "assistant" ? lastMessage.id : null;

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scrollRef} className="h-full overflow-y-auto overscroll-contain">
        <div ref={contentRef} className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-4 py-6">
          {messages.map((message) => (
            <Message key={message.id} message={message} isStreaming={message.id === streamingMessageId} />
          ))}
          {awaitingAssistantMessage && (
            <div className="flex justify-start">
              <div className="w-full max-w-none px-1 py-1 text-foreground">
                <ThinkingIndicator />
              </div>
            </div>
          )}
        </div>
      </div>

      {!isAtBottom && messages.length > 0 && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground shadow-lg transition-opacity hover:opacity-90"
        >
          Jump to latest
        </button>
      )}
    </div>
  );
}
