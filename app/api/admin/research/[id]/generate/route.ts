import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { estimateReadMinutes, normalizeReportContent } from "@/lib/research/content";
import { GenerationError, generateReportFromText } from "@/lib/research/generate";
import { toAdminReport, uniqueSlug } from "@/lib/research/server";

export const maxDuration = 120;

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * (Re)generate a report's written content from its stored PDF text.
 * Overwrites the content fields; file metadata and status are left alone.
 * Live reports keep their URL; only drafts take the suggested slug and issue date.
 */
export async function POST(_req: NextRequest, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.researchReport.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (existing.status === "PUBLISHED") {
    return NextResponse.json(
      { error: "Unpublish the report before regenerating it, so readers never see an unreviewed version." },
      { status: 409 }
    );
  }
  if (!existing.sourceText) {
    return NextResponse.json(
      { error: "No text was extracted from this PDF, so there is nothing to generate from." },
      { status: 422 }
    );
  }

  // Use the most recently edited live report as the tone/length reference.
  const reference = await prisma.researchReport.findFirst({
    where: { status: "PUBLISHED", id: { not: id } },
    orderBy: { updatedAt: "desc" },
    select: { title: true, content: true },
  });

  try {
    const generated = await generateReportFromText(
      existing.sourceText,
      reference ? { title: reference.title, content: normalizeReportContent(reference.content) } : null
    );

    const data: Prisma.ResearchReportUpdateInput = {
      content: generated.content as unknown as Prisma.InputJsonValue,
      readMinutes: estimateReadMinutes(generated.content),
      aiModel: generated.model,
      generatedAt: new Date(),
    };
    if (generated.title) data.title = generated.title;
    data.slug = await uniqueSlug(generated.slug || generated.title || existing.title, id);
    if (generated.issueDate) data.publishedAt = new Date(`${generated.issueDate}T00:00:00.000Z`);

    const row = await prisma.researchReport.update({ where: { id }, data });
    return NextResponse.json({ report: toAdminReport(row) });
  } catch (error) {
    if (error instanceof GenerationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Generate research report failed:", error);
    return NextResponse.json({ error: "Generation failed unexpectedly. Try again." }, { status: 500 });
  }
}
