// Fixed-window rate limiter, in memory. This holds per-instance only: on a
// serverless/edge host with multiple instances or cold starts, the true
// limit is "N per window per instance", not global. That's an acceptable
// gap for a capstone demo on a single small deployment; swapping in a
// shared store (e.g. Upstash Redis) would need a dependency add, which
// CLAUDE.md requires asking about first.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

const hits = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
}

export function checkRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    hits.set(key, recent);
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((recent[0] + WINDOW_MS - now) / 1000),
    };
  }

  recent.push(now);
  hits.set(key, recent);
  return { allowed: true, retryAfterSeconds: 0 };
}
