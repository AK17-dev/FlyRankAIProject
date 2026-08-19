import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { MAX_OUTPUT_TOKENS, MODEL, SYSTEM_PROMPT, TEMPERATURE } from "@/lib/ai/config";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractFirstUrl, fetchPageData, formatPageDataBlock, PageFetchError } from "@/lib/seo/page-data";

export const maxDuration = 30;

// Parts are validated loosely (type + passthrough) rather than against the
// full UIMessage union — the shape the client actually sends is dictated by
// the installed `ai` version, and re-deriving that union here would drift
// out of sync with it. This still rejects anything structurally malformed.
const partSchema = z.object({ type: z.string() }).passthrough();

const messageSchema = z.object({
  id: z.string(),
  role: z.enum(["user", "assistant", "system"]),
  parts: z.array(partSchema).min(1),
});

const requestSchema = z.object({
  messages: z.array(messageSchema).min(1),
});

function textOf(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

// Stateless route: the client resends the full message history every turn,
// so there is nothing to look up here beyond what's in the request body.
export async function POST(req: Request) {
  const forwardedFor = req.headers.get("x-forwarded-for");
  const clientKey = forwardedFor?.split(",")[0]?.trim() || "unknown";
  const rateLimit = checkRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return Response.json(
      { error: `Too many requests. Try again in ${rateLimit.retryAfterSeconds}s.` },
      { status: 429, headers: { "retry-after": String(rateLimit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Malformed request body." }, { status: 400 });
  }

  const messages = parsed.data.messages as UIMessage[];
  const auditAlreadyGiven = messages.some((m) => m.role === "assistant");

  // Turn one: if the audit hasn't happened yet and the newest user message
  // contains a URL, fetch and parse that page server side, then fold the
  // resulting <page_data> block into the message before it reaches the
  // model. Every later turn skips this — the audit (and its page data)
  // already lives in the transcript the client resent.
  if (!auditAlreadyGiven) {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    const url = lastUserMessage ? extractFirstUrl(textOf(lastUserMessage)) : null;

    if (url && lastUserMessage) {
      try {
        const pageData = await fetchPageData(url);
        lastUserMessage.parts = [
          ...lastUserMessage.parts,
          { type: "text", text: `\n\n${formatPageDataBlock(pageData)}` },
        ];
      } catch (err) {
        const message = err instanceof PageFetchError ? err.message : "Could not fetch that page. Check the URL and try again.";
        return Response.json({ error: message }, { status: 422 });
      }
    }
  }

  const modelMessages = await convertToModelMessages(messages);

  let result: ReturnType<typeof streamText>;
  try {
    result = streamText({
      model: MODEL,
      instructions: SYSTEM_PROMPT,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      messages: modelMessages,
      onError: ({ error }) => {
        // Server-side only — never forwarded to the client as-is.
        console.error("streamText error", error);
      },
    });
  } catch {
    return Response.json({ error: "The audit couldn't be started. Please try again." }, { status: 502 });
  }

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      // Masks provider internals (rate limits, auth errors, stack traces)
      // behind one message the client can render as-is.
      onError: () => "The audit hit an error partway through. Please try again.",
    }),
  });
}
