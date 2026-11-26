/**
 * One-time import of the original hand-written research reports into the database.
 *
 *   npm run research:seed
 *
 * Safe to re-run: reports that already exist (matched by slug) are left untouched,
 * so edits made in the admin portal are never overwritten.
 */
import fs from "node:fs";
import path from "node:path";
import { PrismaClient, type Prisma } from "@prisma/client";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { PUBLICATIONS } from "./data/legacy-publications";
import { normalizeReportContent } from "../lib/research/content";

const prisma = new PrismaClient();
const publicDir = path.join(process.cwd(), "public");

async function pdfText(file: string): Promise<{ text: string; pages: number }> {
  const data = new Uint8Array(fs.readFileSync(file));
  const task = pdfjs.getDocument({ data, useSystemFonts: true });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : ""))
        .join("")
        .trim()
    );
  }
  const result = { text: pages.join("\n\n"), pages: doc.numPages };
  await task.destroy();
  return result;
}

async function main() {
  let created = 0;
  for (const pub of PUBLICATIONS) {
    const exists = await prisma.researchReport.findUnique({ where: { slug: pub.slug }, select: { id: true } });
    if (exists) {
      console.log(`- exists, skipped: ${pub.slug}`);
      continue;
    }

    const pdfPath = path.join(publicDir, pub.pdfUrl);
    if (!fs.existsSync(pdfPath)) throw new Error(`Missing PDF for ${pub.slug}: ${pdfPath}`);
    const { text, pages } = await pdfText(pdfPath);

    await prisma.researchReport.create({
      data: {
        slug: pub.slug,
        status: "PUBLISHED",
        title: pub.title,
        content: normalizeReportContent(pub) as unknown as Prisma.InputJsonValue,
        publishedAt: new Date(`${pub.publishedIso}T00:00:00.000Z`),
        pdfUrl: pub.pdfUrl,
        coverImage: pub.coverImage,
        pageCount: pages || pub.pageCount,
        fileSizeBytes: fs.statSync(pdfPath).size,
        readMinutes: parseInt(pub.readTime, 10) || 5,
        originalFilename: path.basename(pub.pdfUrl),
        sourceText: text,
      },
    });
    created++;
    console.log(`+ imported: ${pub.slug}`);
  }
  console.log(`Done. ${created} imported, ${PUBLICATIONS.length - created} already present.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
