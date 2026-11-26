import { NextRequest, NextResponse } from "next/server";
import { del } from "@vercel/blob";
import type { Prisma } from "@prisma/client";
import { getAdminSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeReportContent, publishBlockers } from "@/lib/research/content";
import {
  isBlobUrl,
  revalidateResearch,
  toAdminReport,
  uniqueSlug,
} from "@/lib/research/server";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const row = await prisma.researchReport.findUnique({ where: { id } });
  if (!row) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  return NextResponse.json({ report: toAdminReport(row) });
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.researchReport.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const data: Prisma.ResearchReportUpdateInput = {};

  const title = typeof body.title === "string" ? body.title.replace(/\s+/g, " ").trim().slice(0, 200) : existing.title;
  if (typeof body.title === "string") data.title = title;

  const content =
    body.content !== undefined ? normalizeReportContent(body.content) : normalizeReportContent(existing.content);
  if (body.content !== undefined) data.content = content as unknown as Prisma.InputJsonValue;

  if (typeof body.slug === "string" && body.slug !== existing.slug) {
    data.slug = await uniqueSlug(body.slug, id);
  }

  if (typeof body.publishedAt === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.publishedAt) || Number.isNaN(Date.parse(body.publishedAt))) {
      return NextResponse.json({ error: "Publish date must be YYYY-MM-DD." }, { status: 400 });
    }
    data.publishedAt = new Date(`${body.publishedAt}T00:00:00.000Z`);
  }

  if (body.readMinutes !== undefined) {
    const n = Math.round(Number(body.readMinutes));
    if (!Number.isFinite(n) || n < 1 || n > 120) {
      return NextResponse.json({ error: "Read time must be between 1 and 120 minutes." }, { status: 400 });
    }
    data.readMinutes = n;
  }

  if (typeof body.coverImage === "string" && body.coverImage !== existing.coverImage) {
    if (!isBlobUrl(body.coverImage)) {
      return NextResponse.json({ error: "Cover must be uploaded to Blob storage." }, { status: 400 });
    }
    data.coverImage = body.coverImage;
  }

  if (body.status === "PUBLISHED" || body.status === "DRAFT") {
    if (body.status === "PUBLISHED") {
      const missing = publishBlockers(title, content);
      if (missing.length > 0) {
        return NextResponse.json(
          { error: `Complete these before publishing: ${missing.join(", ")}.`, missing },
          { status: 422 }
        );
      }
      if (existing.slug.startsWith("draft-") && typeof data.slug !== "string") {
        // Never publish under the placeholder slug the draft was created with.
        data.slug = await uniqueSlug(title, id);
      }
    }
    data.status = body.status;
  }

  try {
    const row = await prisma.researchReport.update({ where: { id }, data });
    const wasOrIsLive = existing.status === "PUBLISHED" || row.status === "PUBLISHED";
    if (wasOrIsLive) revalidateResearch([existing.slug, row.slug]);

    // Replace the old cover file once a new one is saved.
    if (data.coverImage && isBlobUrl(existing.coverImage)) {
      await del(existing.coverImage).catch((e) => console.warn("Old cover cleanup failed:", e));
    }
    return NextResponse.json({ report: toAdminReport(row) });
  } catch (error) {
    console.error("Update research report failed:", error);
    return NextResponse.json({ error: "Could not save the report." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await prisma.researchReport.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  try {
    await prisma.researchReport.delete({ where: { id } });
    const files = [existing.pdfUrl, existing.coverImage].filter(isBlobUrl);
    if (files.length > 0) {
      await del(files).catch((e) => console.warn("Blob cleanup failed:", e));
    }
    if (existing.status === "PUBLISHED") revalidateResearch([existing.slug]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete research report failed:", error);
    return NextResponse.json({ error: "Could not delete the report." }, { status: 500 });
  }
}
