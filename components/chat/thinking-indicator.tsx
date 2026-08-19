export function ThinkingIndicator() {
  return (
    <span
      role="status"
      aria-label="Assistant is thinking"
      className="inline-flex items-center gap-1 py-1.5"
    >
      <span className="size-1.5 rounded-full bg-current opacity-60 motion-safe:animate-bounce [animation-delay:-0.3s]" />
      <span className="size-1.5 rounded-full bg-current opacity-60 motion-safe:animate-bounce [animation-delay:-0.15s]" />
      <span className="size-1.5 rounded-full bg-current opacity-60 motion-safe:animate-bounce" />
    </span>
  );
}
