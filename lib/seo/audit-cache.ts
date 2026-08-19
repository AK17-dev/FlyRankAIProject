import { simulateReadableStream, type TextStreamPart, type ToolSet } from "ai";

// In-memory cache of completed turn-one audits, keyed by normalized URL.
// Exists because the Gemini free tier caps at 20 requests/day project-wide
// (see the model comment in lib/ai/config.ts) — replaying an
// already-generated audit for a URL someone already asked about costs zero
// API quota. Only complete, successful audits are ever stored here (see
// route.ts's onFinish wiring, which is the only writer); follow-up turns
// are never cached, just the expensive, repeatable turn-one generation.
// In-memory only, like the rate limiter: resets on restart/redeploy and is
// per-instance on a multi-instance host — acceptable for the same reason
// the rate limiter's equivalent gap is acceptable here.
const TRACKING_PARAM_NAMES = new Set(["gclid", "fbclid", "msclkid", "mc_cid", "mc_eid", "ref", "igshid", "yclid"]);

export function normalizeUrlForCache(rawUrl: string): string {
  const url = new URL(rawUrl);
  url.hostname = url.hostname.toLowerCase();
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.slice(0, -1);
  }
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM_NAMES.has(key.toLowerCase()) || /^utm_/i.test(key)) {
      url.searchParams.delete(key);
    }
  }
  url.searchParams.sort();
  url.hash = "";
  return url.toString();
}

const cache = new Map<string, string>();

export function getCachedAudit(rawUrl: string): string | null {
  return cache.get(normalizeUrlForCache(rawUrl)) ?? null;
}

export function setCachedAudit(rawUrl: string, text: string): void {
  cache.set(normalizeUrlForCache(rawUrl), text);
}

// Replays a cached audit through the same streamText -> toUIMessageStream
// pipeline a live model call uses, so from the client's side there is no
// difference — it still receives start/text-delta/.../finish chunks
// arriving over time, just without a model call behind them.
//
// `start-step` and `finish-step` carry several fields a real model call
// would fill in (request metadata, token usage, step timing). Checked
// directly against the installed `ai` package's compiled source
// (node_modules/ai/dist/index.js, the toUIMessageChunk switch statement):
// neither case reads anything from the part beyond its `type` — both just
// return a bare `{ type: ... }` — so those fields are populated with
// structurally valid placeholders here rather than fabricated numbers.
export function createCachedAuditStream(text: string): ReadableStream<TextStreamPart<ToolSet>> {
  const id = "cached-audit";
  // TypeScript wants full LanguageModelUsage/StepResultPerformance shapes
  // for finish-step's usage/performance fields (token detail breakdowns,
  // tokens-per-second figures) that a real model call would supply and
  // that, per the source check above, nothing downstream actually reads.
  // One cast here, rather than fabricating numbers those types imply are
  // meaningful, documents that gap instead of hiding it.
  const chunks = [
    { type: "start" },
    { type: "start-step", request: {}, warnings: [] },
    { type: "text-start", id },
    { type: "text-delta", id, text },
    { type: "text-end", id },
    {
      type: "finish-step",
      response: { id: "cached", timestamp: new Date(), modelId: "cache" },
      usage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
      performance: {},
      finishReason: "stop",
      rawFinishReason: undefined,
      providerMetadata: undefined,
    },
    {
      type: "finish",
      finishReason: "stop",
      rawFinishReason: undefined,
      totalUsage: { inputTokens: undefined, outputTokens: undefined, totalTokens: undefined },
    },
  ] as unknown as TextStreamPart<ToolSet>[];

  // A short delay per chunk (rather than none) so the client's status
  // still visibly moves through submitted -> streaming -> ready instead of
  // jumping straight to a fully-formed message.
  return simulateReadableStream({ chunks, chunkDelayInMs: 20 });
}
