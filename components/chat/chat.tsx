"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import { Composer } from "./composer";
import { MessageList } from "./message-list";

const SUGGESTED_PROMPTS = [
  "Audit https://example.com",
  "Audit https://en.wikipedia.org/wiki/Search_engine_optimization",
  "Audit https://www.w3.org/WAI/",
];

// Container: owns useChat, wires the message list and composer together.
// `throttle` batches the re-renders a raw per-chunk stream would otherwise
// cause on a long transcript, at the cost of slightly less granular
// (but still clearly streaming) token-by-token updates.
export function Chat() {
  const { messages, status, sendMessage, stop, error, regenerate, clearError } = useChat({
    throttle: 50,
    onFinish: ({ isAbort }) => {
      // Abort is read from this flag rather than inferred from status
      // transitions — the SDK already restores status to 'ready' and
      // keeps the partial message on its own.
      void isAbort;
    },
  });
  const [input, setInput] = useState("");

  const handleSend = (text: string) => {
    if (status === "error") clearError();
    sendMessage({ text });
    setInput("");
  };

  const handleRetry = () => {
    clearError();
    regenerate();
  };

  return (
    <div className="flex h-dvh flex-col">
      {messages.length > 0 ? (
        <MessageList messages={messages} status={status} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
          <div className="max-w-2xl space-y-2">
            <h1 className="text-xl font-semibold text-foreground">SEO Audit</h1>
            <p className="text-sm text-muted-foreground">
              Paste a URL and get a structured audit — technical SEO issues plus a pass on copy
              that reads as generic or machine-written. Then ask follow-ups.
            </p>
          </div>
          <div className="flex w-full max-w-2xl flex-col gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => setInput(prompt)}
                className="min-h-11 break-words rounded-xl border border-border bg-card px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "error" && error && (
        <p role="alert" className="mx-auto w-full max-w-2xl px-4 text-sm text-red-600">
          {error.message || "Something went wrong. Try again."}
        </p>
      )}

      <Composer value={input} onChange={setInput} status={status} onSend={handleSend} onStop={stop} onRetry={handleRetry} />
    </div>
  );
}
