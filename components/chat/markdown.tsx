import { Streamdown } from "streamdown";

interface MarkdownProps {
  content: string;
  isStreaming?: boolean;
}

// The only place raw model text becomes markup. Streamdown parses
// incomplete markdown (unclosed fences, dangling emphasis, half-written
// links) safely mid-stream, so nothing upstream needs to buffer or repair
// the trailing chunk itself.
//
// `animated` (per-word stagger reveal) is deliberately not enabled: it was
// the only remaining candidate for a reported out-of-order rendering bug
// (later sections' text visually completing before earlier sections') that
// couldn't be confirmed or reproduced in controlled testing. It's cheap to
// disable and the fallback (plain per-chunk text updates, still clearly
// streaming) has no real downside worth the risk.
export function Markdown({ content, isStreaming = false }: MarkdownProps) {
  return <Streamdown isAnimating={isStreaming}>{content}</Streamdown>;
}
