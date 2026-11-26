import "server-only";

import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import type { ResearchReport } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  formatFileSize,
  formatIssueDate,
  normalizeReportContent,
  slugify,
  toIsoDate,
} from "./content";
import type { AdminReport, Publication, ReportStatus } from "./types";

export const RESEARCH_TAG = "research-reports";

function asStatus(s: string): ReportStatus {
  return s === "PUBLISHED" ? "PUBLISHED" : "DRAFT";
}

/** Vercel Blob serves `?download=1` with Content-Disposition: attachment. */
function downloadUrlFor(pdfUrl: string): string {
  return isBlobUrl(pdfUrl) ? `${pdfUrl}${pdfUrl.includes("?") ? "&" : "?"}download=1` : pdfUrl;
}

export function toPublication(row: ResearchReport): Publication {
  const content = normalizeReportContent(row.content);
  return {
    ...content,
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: asStatus(row.status),
    issueDate: formatIssueDate(row.publishedAt),
    publishedIso: toIsoDate(row.publishedAt),
    updatedIso: row.updatedAt.toISOString(),
    readTime: `${row.readMinutes} min read`,
    pageCount: row.pageCount,
    fileSize: formatFileSize(row.fileSizeBytes),
    coverImage: row.coverImage,
    pdfUrl: row.pdfUrl,
    pdfDownloadUrl: downloadUrlFor(row.pdfUrl),
  };
}

export function toAdminReport(row: ResearchReport): AdminReport {
  return {
    id: row.id,
    slug: row.slug,
    status: asStatus(row.status),
    title: row.title,
    content: normalizeReportContent(row.content),
    publishedAt: toIsoDate(row.publishedAt),
    pdfUrl: row.pdfUrl,
    coverImage: row.coverImage,
    pageCount: row.pageCount,
    fileSizeBytes: row.fileSizeBytes,
    readMinutes: row.readMinutes,
    originalFilename: row.originalFilename,
    sourceText: row.sourceText,
    aiModel: row.aiModel,
    generatedAt: row.generatedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Public reads are cached and tagged; admin writes call revalidateResearch().
// The cache stores plain JSON, so map rows to Publication inside the cached function.

export const getPublishedReports = unstable_cache(
  async (): Promise<Publication[]> => {
    const rows = await prisma.researchReport.findMany({
      where: { status: "PUBLISHED" },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    });
    return rows.map(toPublication);
  },
  ["research-published-list"],
  { tags: [RESEARCH_TAG], revalidate: 3600 }
);

export const getPublishedReportBySlug = unstable_cache(
  async (slug: string): Promise<Publication | null> => {
    const row = await prisma.researchReport.findUnique({ where: { slug } });
    return row && row.status === "PUBLISHED" ? toPublication(row) : null;
  },
  ["research-published-by-slug"],
  { tags: [RESEARCH_TAG], revalidate: 3600 }
);

/** Make every public surface that lists reports pick up a change on the next request. */
export function revalidateResearch(slugs: string[] = []) {
  revalidateTag(RESEARCH_TAG, { expire: 0 });
  revalidatePath("/insights");
  revalidatePath("/insights/research/[slug]", "page");
  for (const slug of slugs) revalidatePath(`/insights/research/${slug}`);
  revalidatePath("/sitemap.xml");
}

/** Turn a wanted slug into one no other report uses. */
export async function uniqueSlug(wanted: string, excludeId?: string): Promise<string> {
  const base = slugify(wanted) || `research-report-${Date.now().toString(36)}`;
  let candidate = base;
  for (let n = 2; n < 100; n++) {
    const clash = await prisma.researchReport.findFirst({
      where: { slug: candidate, ...(excludeId ? { id: { not: excludeId } } : {}) },
      select: { id: true },
    });
    if (!clash) return candidate;
    candidate = `${base}-${n}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export function isBlobUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".blob.vercel-storage.com");
  } catch {
    return false;
  }
}
