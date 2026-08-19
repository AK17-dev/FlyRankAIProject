"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

type ChatStatus = "submitted" | "streaming" | "ready" | "error";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  status: ChatStatus;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
}

const MAX_TEXTAREA_LINES = 5;
const LINE_HEIGHT_PX = 24;

export function Composer({ value, onChange, status, onSend, onStop, onRetry }: ComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Lazy initializer reads the media query directly instead of setting
  // state from inside an effect body (avoids an extra cascading render).
  const [isCoarsePointer, setIsCoarsePointer] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches,
  );
  const prevStatusRef = useRef(status);

  // Desktop: Enter sends. Touch: Enter inserts a newline, send is
  // button-only. `pointer: coarse` is the input-modality signal, not a UA
  // sniff, so it tracks the actual pointing device rather than guessing
  // from screen width. The effect only subscribes to future changes (e.g.
  // a 2-in-1 laptop switching to tablet mode) — the initial value above.
  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    const onChangeMatch = () => setIsCoarsePointer(mql.matches);
    mql.addEventListener("change", onChangeMatch);
    return () => mql.removeEventListener("change", onChangeMatch);
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = LINE_HEIGHT_PX * MAX_TEXTAREA_LINES;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value]);

  // Refocus after a stream finishes or is stopped, so "stop -> type -> send"
  // works without the reviewer having to click back into the field.
  useEffect(() => {
    const wasGenerating = prevStatusRef.current === "streaming" || prevStatusRef.current === "submitted";
    if (wasGenerating && status === "ready") {
      textareaRef.current?.focus();
    }
    prevStatusRef.current = status;
  }, [status]);

  const isGenerating = status === "streaming" || status === "submitted";
  const isError = status === "error";
  const hasContent = value.trim().length > 0;

  const submit = () => {
    const text = value.trim();
    if (!text) return;
    onSend(text);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (isGenerating) {
      onStop();
      return;
    }
    if (isError) {
      onRetry();
      return;
    }
    submit();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Enter" || e.shiftKey || isCoarsePointer || isGenerating) return;
    e.preventDefault();
    submit();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-end gap-2 border-t border-border bg-background p-3"
      style={{ paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Paste a URL to audit, or ask a follow-up…"
        rows={1}
        disabled={isGenerating}
        aria-label="Message"
        className="min-h-11 flex-1 resize-none overflow-y-auto rounded-2xl border border-border bg-card px-4 py-2.5 text-base leading-6 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
      />
      <SendStopButton status={status} hasContent={hasContent} />
    </form>
  );
}

function SendStopButton({ status, hasContent }: { status: ChatStatus; hasContent: boolean }) {
  const isGenerating = status === "streaming" || status === "submitted";
  const isError = status === "error";
  const disabled = !isGenerating && !isError && !hasContent;
  const iconState = isGenerating ? "stop" : isError ? "retry" : "send";
  const label = isGenerating ? "Stop" : isError ? "Retry" : "Send";

  return (
    <button
      type="submit"
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "flex size-11 shrink-0 items-center justify-center rounded-full transition-colors duration-150",
        disabled
          ? "cursor-not-allowed bg-muted text-muted-foreground"
          : isError
            ? "bg-red-600 text-white hover:bg-red-700 active:bg-red-800"
            : "bg-foreground text-background hover:opacity-90 active:opacity-80",
      ].join(" ")}
    >
      <SendStopIcon state={iconState} />
    </button>
  );
}

function SendStopIcon({ state }: { state: "send" | "stop" | "retry" }) {
  return (
    <span className="relative flex size-4 items-center justify-center" aria-hidden="true">
      <svg
        viewBox="0 0 24 24"
        className={`absolute inset-0 transition-all duration-200 ${
          state === "send" ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      >
        <path d="M4 20L20 12L4 4V10L14 12L4 14V20Z" fill="currentColor" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className={`absolute inset-0 transition-all duration-200 ${
          state === "stop" ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      >
        <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
      </svg>
      <svg
        viewBox="0 0 24 24"
        className={`absolute inset-0 transition-all duration-200 ${
          state === "retry" ? "scale-100 opacity-100" : "scale-50 opacity-0"
        }`}
      >
        <path
          d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6a6 6 0 0 1-6 6 6 6 0 0 1-6-6H4a8 8 0 0 0 8 8 8 8 0 0 0 8-8 8 8 0 0 0-8-8Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}
