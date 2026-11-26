import "server-only";

import { normalizeReportContent } from "./content";
import { SERVICE_LINKS, type ReportContent } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-120b";
const MAX_SOURCE_CHARS = 60_000;

export interface GeneratedReport {
  title: string;
  slug: string;
  /** YYYY-MM-DD if the PDF states an issue date, otherwise null. */
  issueDate: string | null;
  content: ReportContent;
  model: string;
}

export interface StyleExample {
  title: string;
  content: ReportContent;
}

export class GenerationError extends Error {
  constructor(message: string, readonly status = 502) {
    super(message);
  }
}

const nullableString = { type: ["string", "null"] };

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title", "slug", "issueDate", "subtitle", "series", "category", "summary",
    "headlineStat", "keyMetrics", "keyTakeaways", "sections", "seo", "relatedService",
  ],
  properties: {
    title: { type: "string" },
    slug: { type: "string" },
    issueDate: nullableString,
    subtitle: { type: "string" },
    series: { type: "string" },
    category: { type: "string" },
    summary: { type: "string" },
    headlineStat: {
      type: "object",
      additionalProperties: false,
      required: ["value", "label"],
      properties: { value: { type: "string" }, label: { type: "string" } },
    },
    keyMetrics: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "desc"],
        properties: {
          label: { type: "string" },
          value: { type: "string" },
          desc: { type: "string" },
        },
      },
    },
    keyTakeaways: { type: "array", items: { type: "string" } },
    sections: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["heading", "subhead", "paragraphs", "callout", "table"],
        properties: {
          heading: { type: "string" },
          subhead: nullableString,
          paragraphs: { type: "array", items: { type: "string" } },
          callout: nullableString,
          table: {
            anyOf: [
              { type: "null" },
              {
                type: "object",
                additionalProperties: false,
                required: ["headers", "rows"],
                properties: {
                  headers: { type: "array", items: { type: "string" } },
                  rows: { type: "array", items: { type: "array", items: { type: "string" } } },
                },
              },
            ],
          },
        },
      },
    },
    seo: {
      type: "object",
      additionalProperties: false,
      required: ["metaTitle", "metaDescription", "keywords"],
      properties: {
        metaTitle: { type: "string" },
        metaDescription: { type: "string" },
        keywords: { type: "array", items: { type: "string" } },
      },
    },
    relatedService: {
      type: "object",
      additionalProperties: false,
      required: ["title", "description", "href", "buttonText"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        href: { type: "string", enum: SERVICE_LINKS.map((l) => l.href) },
        buttonText: { type: "string" },
      },
    },
  },
} as const;

const SYSTEM_PROMPT = `You are the research editor at Green Shoots Wealth, a SEBI-registered Indian wealth advisory. You turn the firm's own PDF newsletters and research issues into the web version of the report.

The web page is read by Indian investors and indexed by Google. It must read like the firm wrote it: plain, specific, numerate, calm. It is a faithful web edition of the PDF, not a new article.

ACCURACY (non-negotiable)
- Every number, date, name, fund, company and claim must come from the PDF text. Never add outside facts, estimates, or examples that are not in the PDF.
- Copy figures exactly as the PDF writes them, including units and notation (₹, %, ×, Lakh, Crore, GW). Do not convert, round, or recompute.
- If the PDF does not state something, leave it out. An empty field is better than an invented one.
- Do not give personalised advice or promise returns. Keep the PDF's own caveats and risk language.

VOICE
- Short declarative sentences. Concrete nouns. Indian English spelling (behaviour, organise).
- No hype, no filler, no rhetorical questions. Never use: delve, unlock, unleash, navigate, landscape, realm, robust, seamless, game-changer, in today's fast-paced world, it's important to note, in conclusion, embark, journey (unless the PDF uses it), elevate, empower, tapestry, paradigm.
- No emojis. No exclamation marks. Do not start sentences with "Moreover" or "Furthermore".

THE PDF TEXT
- It was extracted automatically, so reading order can be scrambled and letter-spaced headings may appear as "PA R T I — T H E C A S E". Reconstruct the intended structure.
- Ignore page furniture: running headers, footers, page numbers, disclaimers repeated on every page (but do keep a single substantive risk caveat if the report has one).

FIELDS
- title: the report's own headline, in its own words. Title Case. No site name.
- slug: lowercase-hyphenated, 4–9 words, keyword-rich, no dates or stop-word padding.
- issueDate: the issue date printed on the PDF (usually a masthead like "AUGUST 2026"), as YYYY-MM-DD with day 01 if only month and year are given. A copyright line ("© 2026") or a year mentioned in the body is NOT an issue date. If no month is printed, null.
- subtitle: one sentence (max ~25 words) saying what the report shows.
- series: the newsletter/series name printed in the PDF (e.g. "The Steady Mind · Special Issue"). If none, a short descriptive series such as "Client Newsletter".
- category: 2–4 words, e.g. "Retirement & SWP", "Asset Allocation & Gold".
- summary: 3–5 sentences, ~90–130 words. The core argument and the evidence behind it.
- headlineStat: the single most striking figure in the report. value is the figure only (e.g. "~12.6%"); label explains it in under 10 words.
- keyMetrics: exactly 4 when the PDF has 4+ distinct figures, otherwise as many as exist. Each metric must be a different figure (never repeat a value, never reuse the headlineStat figure with a new label) and must mean exactly what the PDF says it means. label 2–4 words; value is the figure; desc one short sentence of context from the PDF.
- keyTakeaways: 3–5 standalone sentences an investor should remember. Each makes one point and, where the PDF supports it, carries a figure.
- sections: follow the PDF's own parts in order (usually 3–7). heading = the PDF's section heading in Title Case (never ALL CAPS); drop "Part I —" style numbering and, when the PDF has both a kicker and a descriptive line, use the descriptive line (e.g. "A Currency No Central Bank Can Print", not "PART I — THE CASE FOR GOLD"). subhead optional. paragraphs: 1–4 paragraphs of 2–4 sentences each, covering what that part of the PDF actually says. callout: one sentence the PDF itself highlights (pull quote, caveat or insight), else null. table: only when the PDF contains tabular data; reproduce its headers and rows faithfully, else null.
- seo.metaTitle: under 60 characters, leads with the main search phrase.
- seo.metaDescription: 140–158 characters, specific, includes the headline figure.
- seo.keywords: 5–8 phrases Indian investors would actually search for.
- relatedService: the most relevant Green Shoots page for a reader of this report. href must be one of the allowed values. title is a specific next step tied to this report's topic (not "Learn more" or "Explore options"); description one sentence saying what the reader gets; buttonText 2–5 words naming the action (e.g. "Check if SIF fits you").`;

function serviceGuide(): string {
  return SERVICE_LINKS.map((l) => `  ${l.href} — ${l.label}`).join("\n");
}

function buildUserPrompt(sourceText: string, example: StyleExample | null): string {
  const parts: string[] = [];
  parts.push(`Allowed relatedService.href values:\n${serviceGuide()}`);
  if (example) {
    parts.push(
      `A published report the firm is happy with, for tone, length and structure only. Do NOT reuse any of its facts:\n<example>\n${JSON.stringify(
        { title: example.title, ...example.content }
      )}\n</example>`
    );
  }
  parts.push(`The PDF text:\n<pdf>\n${sourceText.slice(0, MAX_SOURCE_CHARS)}\n</pdf>`);
  parts.push("Produce the web edition as JSON matching the schema.");
  return parts.join("\n\n");
}

const MONTHS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

/**
 * Accept the model's issue date only if that month and year are printed close together
 * in the PDF. Stops a copyright year turning into "January 2026".
 */
function isPrintedIssueDate(iso: string, text: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return false;
  const year = m[1];
  const name = `(?:${month}|${month.slice(0, 3)})`;
  const re = new RegExp(`${name}\\W{0,3}(?:\\d{1,2}\\W{0,3})?${year}|${year}\\W{0,3}${name}`, "i");
  return re.test(text.replace(/\s+/g, " "));
}

/** Tidy obvious extraction noise before it reaches the model. */
export function cleanExtractedText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export async function generateReportFromText(
  sourceText: string,
  example: StyleExample | null
): Promise<GeneratedReport> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new GenerationError("GROQ_API_KEY is not set on the server.", 500);
  }
  const text = cleanExtractedText(sourceText);
  if (text.length < 200) {
    throw new GenerationError(
      "This PDF has almost no selectable text (it may be a scanned image). Fill in the fields manually.",
      422
    );
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const body = {
    model,
    temperature: 0.2,
    max_completion_tokens: 12_000,
    reasoning_effort: "medium",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(text, example) },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "research_report", strict: true, schema: RESPONSE_SCHEMA },
    },
  };

  let res: Response | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    res = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(90_000),
    });
    // Retry rate limits and transient upstream errors with a short backoff.
    if (res.status !== 429 && res.status < 500) break;
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  if (!res || !res.ok) {
    const detail = res ? await res.text().catch(() => "") : "";
    console.error("Groq generation failed:", res?.status, detail.slice(0, 500));
    throw new GenerationError(
      res?.status === 429
        ? "The AI provider is rate-limiting requests. Wait a minute and try again."
        : "The AI provider returned an error. Try again, or fill in the fields manually."
    );
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = data.choices?.[0]?.message?.content;
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw ?? "");
  } catch {
    throw new GenerationError("The AI response was not valid JSON. Try again.");
  }

  const content = normalizeReportContent(parsed);
  const title = typeof parsed.title === "string" ? parsed.title.trim().slice(0, 200) : "";
  const slug = typeof parsed.slug === "string" ? parsed.slug : "";
  const issueDate =
    typeof parsed.issueDate === "string" && isPrintedIssueDate(parsed.issueDate, text)
      ? parsed.issueDate
      : null;

  return { title, slug, issueDate, content, model };
}
