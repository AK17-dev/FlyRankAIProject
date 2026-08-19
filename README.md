# SEO Audit

Paste a URL, get a structured SEO audit streamed back, then ask follow-up questions about it.

**Live:** [https://fly-rank-ai-project.vercel.app/]

Capstone project for the FlyRank Frontend AI Engineering track.

---

## What it does

Submit a URL and the server fetches that page, parses its structure, and streams back an audit
organised into five sections: a plain-language verdict, critical issues, issues worth fixing, a
content-quality pass, and what's already working. Every finding names the problem, why it matters,
and the concrete fix.

The content-quality section is a **de-AI pass** — it flags copy that reads as generic or
machine-written (throat-clearing openers, hollow intensifiers, paragraphs that restate their own
heading) and supplies a rewrite that keeps the meaning and cuts the padding. It judges the writing,
not its origin: it never claims text was AI-generated, only that it reads as generic.

After the audit, the conversation continues. Ask why a finding matters, request a rewritten meta
description, or dig into the heading structure — answers are grounded in the audit already on screen.

**What it will not do:** invent traffic figures, keyword rankings, or search volume. It has no access
to that data and says so rather than guessing, quantitatively or qualitatively.

---

## Stack

- **Next.js** (App Router) + TypeScript
- **Tailwind CSS**
- **AI SDK** (`ai`, `@ai-sdk/google`, `@ai-sdk/react`) — `streamText` server-side, `useChat` client-side
- **Google Gemini** (`gemini-3.5-flash-lite`)
- **Streamdown** for streaming-safe markdown rendering
- Deployed on **Vercel**

---

## Architecture

```
app/api/chat/route.ts        Stateless streaming endpoint
lib/ai/config.ts             Model, system prompt, generation settings — single source of truth
lib/seo/page-data.ts         Fetches and parses a URL into typed PageData
lib/seo/audit-cache.ts       Caches completed audits by normalised URL
hooks/use-stick-to-bottom.ts Autoscroll pin/release logic
components/chat/             Chat container, message list, composer, markdown renderer
```

**Model config is centralised.** Model id, system prompt, temperature, and token limits live only in
`lib/ai/config.ts`. No provider-specific types leak outside that module, so switching providers is a
single import and a single constant.

**The route is stateless.** The client resends the full message history each turn; the server holds
no session state.

**The API key is server-side only.** Read from `process.env`, never prefixed `NEXT_PUBLIC_`, never
referenced in `components/` or `hooks/`.

---

## Implementation notes

**Autoscroll** pins to the bottom only while the user is already there, releases the moment they
scroll up, and re-engages when they return. Content growth is observed with a `ResizeObserver`
rather than a message-count effect, because tokens arrive without changing the message count. A
jump-to-latest control appears when unpinned.

**Stopping mid-stream** aborts the request end to end: the abort signal reaches `streamText` so the
server stops generating, the partial message persists in the transcript, the input re-enables, and
the next send works immediately with the truncated turn correctly in history.

**Streaming markdown** renders through Streamdown, so half-finished markdown — unclosed code fences,
dangling emphasis, tables mid-row — never breaks the layout mid-stream.

**Rate limiting** is applied per IP. The free tier caps daily requests, and the deployed URL is
public.

**Audit caching** stores completed audits keyed on the normalised URL and replays them through the
same stream pipeline, so repeat requests for the same page cost no model call. Only successful
audits are cached; aborted and errored responses never are. Follow-up turns always hit the model.

---

## Running locally

```bash
npm install
cp .env.example .env.local   # add your key
npm run dev
```

Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/).

```
GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
```

---

## License

MIT — see [LICENSE](./LICENSE).
