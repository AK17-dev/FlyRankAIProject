import { parse, NodeType, type HTMLElement, type Node } from "node-html-parser";

// Keeps the <page_data> block a bounded size regardless of page length, so a
// single huge page can't blow past the model's context/output budget.
const MAX_BODY_CHARS = 6000;
const FETCH_TIMEOUT_MS = 8000;
const USER_AGENT = "Mozilla/5.0 (compatible; SEOAuditBot/1.0; +https://flyrank.com)";

export interface PageHeading {
  level: 1 | 2 | 3 | 4 | 5 | 6;
  text: string;
}

export interface PageData {
  url: string;
  title: string | null;
  metaDescription: string | null;
  headings: PageHeading[];
  bodyText: string;
  bodyTextTruncated: boolean;
  internalLinkCount: number;
  externalLinkCount: number;
  imageCount: number;
  imagesMissingAltCount: number;
}

export type PageFetchErrorReason =
  | "invalid-url"
  | "timeout"
  | "network"
  | "http-error"
  | "non-html";

export class PageFetchError extends Error {
  constructor(
    public readonly reason: PageFetchErrorReason,
    message: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = "PageFetchError";
  }
}

// Matches the first http(s) URL in free-typed text, so a composer message
// like "audit https://example.com for me" still resolves to a fetch target.
export function extractFirstUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s<>"')\]]+/i);
  return match ? match[0] : null;
}

export async function fetchPageData(rawUrl: string): Promise<PageData> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PageFetchError("invalid-url", `"${rawUrl}" is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new PageFetchError("invalid-url", `"${rawUrl}" must use http or https.`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: { "user-agent": USER_AGENT, accept: "text/html" },
      redirect: "follow",
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new PageFetchError("timeout", `Fetching ${url.href} timed out after ${FETCH_TIMEOUT_MS}ms.`);
    }
    throw new PageFetchError("network", `Could not reach ${url.href}.`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new PageFetchError(
      "http-error",
      `${url.href} responded with ${response.status}.`,
      response.status,
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new PageFetchError("non-html", `${url.href} is not an HTML page (content-type: ${contentType || "unknown"}).`);
  }

  const html = await response.text();
  return parsePageData(url.href, html);
}

const BLOCK_TAGS = new Set([
  "ADDRESS", "ARTICLE", "ASIDE", "BLOCKQUOTE", "DD", "DETAILS", "DIALOG",
  "DIV", "DL", "DT", "FIELDSET", "FIGCAPTION", "FIGURE", "FOOTER", "FORM",
  "H1", "H2", "H3", "H4", "H5", "H6", "HEADER", "HR", "LI", "MAIN", "NAV",
  "OL", "P", "PRE", "SECTION", "TABLE", "TBODY", "TD", "TFOOT", "TH",
  "THEAD", "TR", "UL",
]);

// Walks the DOM rather than reading the element's flat `.text`, which
// concatenates every descendant text node with no separator at all — an
// <h1> immediately followed by a <p> reads back as one fused word. Each
// block-level element becomes its own paragraph; inline elements (a,
// span, strong, ...) within a block stay joined as running text, and
// runs of whitespace collapse to a single space.
function extractBodyText(root: HTMLElement): string {
  const paragraphs: string[] = [];
  let buffer = "";

  const flush = () => {
    const collapsed = buffer.replace(/\s+/g, " ").trim();
    if (collapsed) paragraphs.push(collapsed);
    buffer = "";
  };

  const walk = (node: Node) => {
    if (node.nodeType === NodeType.TEXT_NODE) {
      buffer += node.rawText;
      return;
    }
    if (node.nodeType !== NodeType.ELEMENT_NODE) return;

    const el = node as HTMLElement;
    if (el.tagName === "BR") {
      buffer += "\n";
      return;
    }

    const isBlock = BLOCK_TAGS.has(el.tagName ?? "");
    if (isBlock) flush();
    for (const child of el.childNodes) walk(child);
    if (isBlock) flush();
  };

  walk(root);
  flush();
  return paragraphs.join("\n\n");
}

function parsePageData(url: string, html: string): PageData {
  const root = parse(html);

  root.querySelectorAll("script, style, noscript, nav, footer").forEach((node) => node.remove());

  const title = root.querySelector("title")?.text.trim() || null;

  const metaDescription =
    root
      .querySelector('meta[name="description"]')
      ?.getAttribute("content")
      ?.trim() || null;

  const headings: PageHeading[] = root
    .querySelectorAll("h1, h2, h3, h4, h5, h6")
    .map((node) => ({
      level: Number(node.tagName.slice(1)) as PageHeading["level"],
      text: node.text.trim().replace(/\s+/g, " "),
    }))
    .filter((h) => h.text.length > 0);

  const bodyEl = root.querySelector("body");
  const fullBodyText = bodyEl ? extractBodyText(bodyEl) : "";
  const bodyTextTruncated = fullBodyText.length > MAX_BODY_CHARS;
  const bodyText = bodyTextTruncated ? fullBodyText.slice(0, MAX_BODY_CHARS) : fullBodyText;

  let pageHost: string | null = null;
  try {
    pageHost = new URL(url).hostname;
  } catch {
    pageHost = null;
  }

  let internalLinkCount = 0;
  let externalLinkCount = 0;
  root.querySelectorAll("a[href]").forEach((node) => {
    const href = node.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
    try {
      const linkHost = new URL(href, url).hostname;
      if (pageHost && linkHost === pageHost) internalLinkCount++;
      else externalLinkCount++;
    } catch {
      // Unparsable href (e.g. javascript:) — ignore rather than miscount.
    }
  });

  const images = root.querySelectorAll("img");
  const imagesMissingAltCount = images.filter((node) => {
    const alt = node.getAttribute("alt");
    return alt === undefined || alt.trim() === "";
  }).length;

  return {
    url,
    title,
    metaDescription,
    headings,
    bodyText,
    bodyTextTruncated,
    internalLinkCount,
    externalLinkCount,
    imageCount: images.length,
    imagesMissingAltCount,
  };
}

// Serializes PageData into the <page_data> block the system prompt expects.
// Missing fields are named explicitly rather than omitted, so the model can
// follow its instruction to say what's missing instead of guessing.
export function formatPageDataBlock(data: PageData): string {
  const headingsBlock = data.headings.length
    ? data.headings.map((h) => `H${h.level}: ${h.text}`).join("\n")
    : "(none found)";

  return [
    "<page_data>",
    `url: ${data.url}`,
    `title: ${data.title ?? "(missing)"}`,
    `meta_description: ${data.metaDescription ?? "(missing)"}`,
    "heading_structure:",
    headingsBlock,
    `body_copy${data.bodyTextTruncated ? " (truncated)" : ""}:`,
    data.bodyText || "(missing)",
    `internal_links: ${data.internalLinkCount}`,
    `external_links: ${data.externalLinkCount}`,
    `images: ${data.imageCount} total, ${data.imagesMissingAltCount} missing alt text`,
    "performance_metrics: (not collected — this tool does not run Lighthouse or field data)",
    "</page_data>",
  ].join("\n");
}
