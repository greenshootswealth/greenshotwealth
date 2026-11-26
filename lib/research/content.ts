// Pure helpers for research report content. Safe for client and server.

import {
  DEFAULT_RELATED_SERVICE,
  SERVICE_LINKS,
  type KeyMetric,
  type PublicationSection,
  type ReportContent,
} from "./types";

const str = (v: unknown, max = 2000): string =>
  typeof v === "string"
    ? v
        .replace(/[\u2010\u2011]/g, "-") // non-breaking/Unicode hyphens from PDFs and models
        .replace(/[\u200b-\u200d\ufeff]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
    : "";

const strList = (v: unknown, maxItems: number, maxLen = 2000): string[] =>
  Array.isArray(v)
    ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems)
    : [];

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

function normalizeSection(raw: unknown): PublicationSection | null {
  const s = obj(raw);
  const heading = str(s.heading, 200);
  const paragraphs = strList(s.paragraphs, 20, 4000);
  if (!heading && paragraphs.length === 0) return null;

  const section: PublicationSection = { heading, paragraphs };
  const subhead = str(s.subhead, 300);
  if (subhead) section.subhead = subhead;
  const callout = str(s.callout, 1200);
  if (callout) section.callout = callout;

  const t = obj(s.table);
  const headers = strList(t.headers, 8, 120);
  if (headers.length > 0 && Array.isArray(t.rows)) {
    const rows = t.rows
      .map((r) => {
        const cells = Array.isArray(r) ? r.map((c) => str(c, 300)) : [];
        // Pad/trim every row to the header width so the table never renders ragged.
        return headers.map((_, i) => cells[i] ?? "");
      })
      .filter((r) => r.some(Boolean))
      .slice(0, 30);
    if (rows.length > 0) section.table = { headers, rows };
  }
  return section;
}

/**
 * Coerce anything (AI output, request bodies, legacy rows) into a valid ReportContent.
 * Never throws; drops what it cannot use.
 */
export function normalizeReportContent(raw: unknown): ReportContent {
  const c = obj(raw);
  const headline = obj(c.headlineStat);
  const seo = obj(c.seo);
  const rs = obj(c.relatedService);

  const keyMetrics: KeyMetric[] = (Array.isArray(c.keyMetrics) ? c.keyMetrics : [])
    .map((m) => {
      const o = obj(m);
      return { label: str(o.label, 80), value: str(o.value, 60), desc: str(o.desc, 240) };
    })
    .filter((m) => m.label || m.value)
    .slice(0, 6);

  const href = str(rs.href, 200);
  const validHref = SERVICE_LINKS.some((l) => l.href === href);

  return {
    subtitle: str(c.subtitle, 400),
    series: str(c.series, 120),
    category: str(c.category, 80),
    summary: str(c.summary, 3000),
    headlineStat: { value: str(headline.value, 60), label: str(headline.label, 160) },
    keyMetrics,
    keyTakeaways: strList(c.keyTakeaways, 8, 600),
    sections: (Array.isArray(c.sections) ? c.sections : [])
      .map(normalizeSection)
      .filter((s): s is PublicationSection => s !== null)
      .slice(0, 12),
    seo: {
      metaTitle: str(seo.metaTitle, 120),
      metaDescription: str(seo.metaDescription, 320),
      keywords: Array.from(new Set(strList(seo.keywords, 12, 100))),
    },
    relatedService: {
      title: str(rs.title, 160) || DEFAULT_RELATED_SERVICE.title,
      description: str(rs.description, 400) || DEFAULT_RELATED_SERVICE.description,
      href: validHref ? href : DEFAULT_RELATED_SERVICE.href,
      buttonText: str(rs.buttonText, 50) || DEFAULT_RELATED_SERVICE.buttonText,
    },
  };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/₹/g, "rs ")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

export function formatFileSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/** "October 2026". Dates are stored as UTC midnight, so format in UTC. */
export function formatIssueDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Reading time for the online version: summary + sections at ~220 wpm. */
export function estimateReadMinutes(content: ReportContent): number {
  const text = [
    content.summary,
    ...content.keyTakeaways,
    ...content.sections.flatMap((s) => [s.heading, ...s.paragraphs, s.callout ?? ""]),
  ].join(" ");
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 220));
}

/** Which fields still need a human before the report can go live. */
export function publishBlockers(title: string, content: ReportContent): string[] {
  const missing: string[] = [];
  if (!title.trim()) missing.push("Title");
  if (!content.subtitle) missing.push("Subtitle");
  if (!content.category) missing.push("Category");
  if (!content.summary) missing.push("Executive summary");
  if (!content.headlineStat.value || !content.headlineStat.label) missing.push("Headline stat");
  if (content.keyTakeaways.length === 0) missing.push("At least one key takeaway");
  if (content.sections.length === 0) missing.push("At least one section");
  if (!content.seo.metaDescription) missing.push("SEO meta description");
  return missing;
}
