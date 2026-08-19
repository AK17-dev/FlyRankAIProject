# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

SEO audit tool. Capstone for the FlyRank Frontend AI Engineering track (FE2 track option).

A user submits a web page. The app collects data about it, an LLM streams a structured audit —
technical SEO issues plus a content-quality pass that flags generic, machine-sounding copy — and
the user then asks follow-up questions against that audit in the same conversation.

## Stack

- Framework: Next.js (App Router), TypeScript
- Styling: Tailwind CSS
- AI: Google Gemini via the AI SDK (`ai`, `@ai-sdk/google`, `@ai-sdk/react`)
- Package manager: npm
- Forms: `react-hook-form` + `zod`
- Testing: whatever `page.test.tsx` in the FE-03 branch runs under — confirm and name it here
  before the next test is written

## Conventions

- **Commits:** [Conventional Commits](https://www.conventionalcommits.org/). Scope in the type
  where it clarifies: `feat(chat):`, `fix(audit):`. Git history is graded across the whole track.
- **Commit granularity:** one commit per meaningful unit of work, each leaving the app runnable.
  Not one squashed commit at the end of a feature.
- **Branches:** `feat/`, `fix/`, `chore/` prefixes. One branch per assignment.
- **Language:** TypeScript throughout. No `.js` source files.

## Rules

These are enforceable. If a change would violate one, stop and say so rather than working around it.

- **Secrets are server-side only.** `GOOGLE_GENERATIVE_AI_API_KEY` and any future key is read from
  `process.env` in server code only. Never `NEXT_PUBLIC_`-prefixed, never referenced under
  `components/` or `hooks/`.
- **Model configuration lives in one module** (`lib/ai/config.ts`). Model ids, system prompts,
  temperature, and token limits appear there and nowhere else. No inline prompt strings in route
  handlers or components.
- **No `any` in component props or public function signatures.** Use `unknown` plus a narrowing
  check if the type is genuinely open.
- **Interactive components follow the W3C ARIA Authoring Practices** — correct roles, keyboard
  operation, focus management. Anything with a dialog, tabs, or disclosure pattern is keyboard-
  testable before it is considered done. Reference implementations live in
  [react-aria-patterns](https://github.com/AK17-dev/react-aria-patterns).
- **Never fabricate SEO data.** The product does not have access to traffic figures, keyword
  rankings, search volume, or competitor data. No feature, prompt, or piece of copy may present
  invented numbers as real. When data is unavailable, say what's missing.
- **Ask before adding a dependency.** Name what it replaces and why the built-in option is
  insufficient.
- **Forms use `react-hook-form` + `zod`.** No hand-rolled `useState` + `validate()` functions.
  Schemas live in a sibling `schema.ts`, not inline in the component.
- **Cross-field validation guards its dependencies.** A dependent check must not fire when the field
  it depends on is empty — validating `confirmPassword` against an empty `newPassword` produces two
  errors for one problem. Use `superRefine` with an explicit guard.
- **Validation and persistence logic ships with tests, and the tests are mutation-checked.** Weaken
  one rule, re-run, and confirm a test fails. A suite that passes against broken code is not a
  suite. This is the rule that matters most: FE-03 found that modern tooling already produces decent
  markup and ARIA from vague prompts — what it does not produce is verification.
- **Persistence goes in `lib/`.** No `console.log` placeholders standing in for a data layer.
- **One agent instruction file wins.** If Next.js scaffolds an `AGENTS.md`, this file takes
  precedence on any conflict. Do not maintain overlapping rules across both.
- **Streamed markdown always renders through `components/chat/markdown.tsx`.**
  It wraps `streamdown`, the only place raw model text becomes markup. No
  other component may pipe streamed text into a markdown parser or
  `dangerouslySetInnerHTML` directly — partial fences and emphasis mid-stream
  will break anything that isn't built for incomplete input.
- **Autoscroll logic lives only in `hooks/use-stick-to-bottom.ts`.** Components
  must not add their own scroll-position `useEffect`s or a `useEffect` keyed
  on `messages.length` — token deltas arrive without changing message count,
  so that effect shape silently stops firing mid-stream.
- **Chat routes are stateless.** The client resends the full message history
  every turn; a route handler must not read or write server-side
  conversation state between requests without discussion first.
- **A model's free-tier daily quota is verified with a live call before it
  goes in `lib/ai/config.ts`, not assumed from the model's tier name.**
  FE-06 shipped with `gemini-3.7-flash` initially, whose free tier turned out
  to cap at 20 requests/day project-wide — enough to strand every reviewer
  after the first. Per-minute limits are necessary but not sufficient.

## Guardrails

- Do not scaffold new top-level structure, add config files, or restructure directories
  speculatively. Propose first.
- Do not modify `.env*`, CI config, or `LICENSE` without being asked.
- When a request conflicts with a rule above, surface the conflict and ask which wins. Do not
  silently pick one.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
