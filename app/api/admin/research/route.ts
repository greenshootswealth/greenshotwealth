import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { emptyReportContent } from "@/lib/research/types";
import { isBlobUrl, toAdminReport, uniqueSlug } from "@/lib/research/server";

export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const rows = await prisma.researchReport.findMany({
      orderBy: [{ updatedAt: "desc" }],
    });
    return NextResponse.json({ reports: rows.map(toAdminReport) });
  } catch (error) {
    console.error("List research reports failed:", error);
    return NextResponse.json({ error: "Could not load research reports." }, { status: 500 });
  }
}

function titleFromFilename(name: string): string {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Create a draft from files the browser already uploaded to Vercel Blob. */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pdfUrl = typeof body.pdfUrl === "string" ? body.pdfUrl : "";
  const coverImage = typeof body.coverImage === "string" ? body.coverImage : "";
  if (!isBlobUrl(pdfUrl) || !isBlobUrl(coverImage)) {
    return NextResponse.json({ error: "PDF and cover must be uploaded to Blob storage first." }, { status: 400 });
  }

  const originalFilename =
    typeof body.originalFilename === "string" ? body.originalFilename.slice(0, 255) : "report.pdf";
  const sourceText = typeof body.sourceText === "string" ? body.sourceText.slice(0, 400_000) : "";
  const pageCount = Number.isFinite(body.pageCount) ? Math.max(0, Math.round(Number(body.pageCount))) : 0;
  const fileSizeBytes = Number.isFinite(body.fileSizeBytes)
    ? Math.max(0, Math.round(Number(body.fileSizeBytes)))
    : 0;

  try {
    const title = titleFromFilename(originalFilename) || "Untitled Report";
    const row = await prisma.researchReport.create({
      data: {
        slug: await uniqueSlug(`draft-${title}`),
        status: "DRAFT",
        title,
        content: JSON.parse(JSON.stringify(emptyReportContent())),
        publishedAt: new Date(new Date().toISOString().slice(0, 10)),
        pdfUrl,
        coverImage,
        pageCount,
        fileSizeBytes,
        originalFilename,
        sourceText: sourceText || null,
      },
    });
    return NextResponse.json({ report: toAdminReport(row) }, { status: 201 });
  } catch (error) {
    console.error("Create research report failed:", error);
    return NextResponse.json({ error: "Could not create the report." }, { status: 500 });
  }
}
