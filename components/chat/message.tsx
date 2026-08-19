import type { UIMessage } from "ai";
import { Markdown } from "./markdown";
import { ThinkingIndicator } from "./thinking-indicator";

interface MessageProps {
  message: UIMessage;
  isStreaming: boolean;
}

function textOf(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

// Renders typed message parts, not a flat string. Only "text" parts are
// rendered here — any other part type (future tool/data/reasoning parts)
// is silently excluded from the joined text rather than crashing or
// printing "[object Object]".
export function Message({ message, isStreaming }: MessageProps) {
  if (message.role !== "user" && message.role !== "assistant") return null;

  const isUser = message.role === "user";
  const text = textOf(message);
  const showIndicator = !isUser && isStreaming && text.length === 0;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={
          isUser
            ? "max-w-[75%] rounded-2xl bg-foreground px-4 py-2.5 text-background"
            : "w-full max-w-none px-1 py-1 text-foreground"
        }
      >
        {/* Indicator and content share one grid cell so the handoff is a
            crossfade in place, not an unmount/remount that shifts layout. */}
        <div className="grid">
          <div
            className={`col-start-1 row-start-1 transition-opacity duration-150 ${
              showIndicator ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          >
            <ThinkingIndicator />
          </div>
          <div
            className={`col-start-1 row-start-1 transition-opacity duration-150 ${
              showIndicator ? "opacity-0" : "opacity-100"
            }`}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{text}</p>
            ) : (
              <Markdown content={text} isStreaming={isStreaming} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
