// Figure checking: every number shown on the page should exist in the source PDF.
// Pure and dependency-free so the admin editor can run it live while someone edits.

import type { ReportContent } from "./types";

export interface UnverifiedFigure {
  /** Human-readable location, e.g. "Key metric 2". */
  where: string;
  /** The figure as written, e.g. "₹33 Lakh Crore". */
  figure: string;
}

const NUMBER = /\d[\d,]*(?:\.\d+)?/g;

function numericCores(text: string): string[] {
  return (text.match(NUMBER) ?? [])
    .map((n) => n.replace(/,/g, "").replace(/\.0+$/, ""))
    .filter(Boolean);
}

export function buildSourceIndex(sourceText: string): Set<string> {
  return new Set(numericCores(sourceText));
}

/** Pull "figure-looking" fragments so warnings quote something recognisable. */
function figuresIn(text: string): { figure: string; cores: string[] }[] {
  const out: { figure: string; cores: string[] }[] = [];
  const re =
    /[₹$~]?\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:–|-|to)\s?\d[\d,]*(?:\.\d+)?)?\s?(?:%|×|x\b|lakh crore|lakh|crore|cr\b|bn\b|billion|trillion|gw\b|twh\b|mn\b|million|k\b)?/gi;
  for (const m of text.matchAll(re)) {
    const figure = m[0].trim();
    const cores = numericCores(figure);
    if (cores.length) out.push({ figure, cores });
  }
  return out;
}

export function findUnverifiedFigures(
  content: ReportContent,
  title: string,
  sourceText: string | null | undefined
): UnverifiedFigure[] {
  if (!sourceText) return [];
  const index = buildSourceIndex(sourceText);

  const fields: [string, string][] = [
    ["Title", title],
    ["Subtitle", content.subtitle],
    ["Headline stat", `${content.headlineStat.value} ${content.headlineStat.label}`],
    ...content.keyMetrics.map((m, i): [string, string] => [
      `Key metric ${i + 1}`,
      `${m.label} ${m.value} ${m.desc}`,
    ]),
    ["Executive summary", content.summary],
    ...content.keyTakeaways.map((t, i): [string, string] => [`Takeaway ${i + 1}`, t]),
    ...content.sections.flatMap((s, i): [string, string][] => [
      [`Section ${i + 1} heading`, `${s.heading} ${s.subhead ?? ""}`],
      ...s.paragraphs.map((p, j): [string, string] => [`Section ${i + 1}, paragraph ${j + 1}`, p]),
      [`Section ${i + 1} callout`, s.callout ?? ""],
      [
        `Section ${i + 1} table`,
        s.table ? [...s.table.headers, ...s.table.rows.flat()].join(" | ") : "",
      ],
    ]),
  ];

  const seen = new Set<string>();
  const result: UnverifiedFigure[] = [];
  for (const [where, text] of fields) {
    if (!text) continue;
    for (const { figure, cores } of figuresIn(text)) {
      if (cores.every((c) => index.has(c))) continue;
      const key = `${where}::${figure}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ where, figure });
    }
  }
  return result;
}
