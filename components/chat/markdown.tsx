import { Streamdown } from "streamdown";

interface MarkdownProps {
  content: string;
  isStreaming?: boolean;
}

// The only place raw model text becomes markup. Streamdown parses
// incomplete markdown (unclosed fences, dangling emphasis, half-written
// links) safely mid-stream, so nothing upstream needs to buffer or repair
// the trailing chunk itself.
export function Markdown({ content, isStreaming = false }: MarkdownProps) {
  return (
    <Streamdown animated isAnimating={isStreaming}>
      {content}
    </Streamdown>
  );
}
