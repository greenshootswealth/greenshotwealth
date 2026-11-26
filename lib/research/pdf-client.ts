"use client";

// Browser-only PDF processing: page count, text extraction and a first-page cover.
// Doing this client-side keeps heavy PDF rendering out of serverless functions.

import type { PDFDocumentProxy } from "pdfjs-dist";

export interface ProcessedPdf {
  pageCount: number;
  text: string;
  cover: Blob;
}

const COVER_WIDTH = 1200;

async function loadPdfjs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();
  }
  return pdfjs;
}

async function openPdf(file: Blob) {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const task = pdfjs.getDocument({ data });
  return { doc: await task.promise, close: () => task.destroy() };
}

interface TextItemLike {
  str: string;
  hasEOL?: boolean;
  transform?: number[];
}

async function extractText(doc: PDFDocumentProxy): Promise<string> {
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let out = "";
    let lastY: number | null = null;
    for (const raw of content.items) {
      const item = raw as TextItemLike;
      if (typeof item.str !== "string") continue;
      const y = item.transform?.[5] ?? null;
      // A jump in baseline means a new line even when the PDF didn't mark one.
      if (lastY !== null && y !== null && Math.abs(y - lastY) > 2 && !out.endsWith("\n")) {
        out += "\n";
      }
      out += item.str;
      if (item.hasEOL) out += "\n";
      lastY = y;
    }
    pages.push(out.trim());
    page.cleanup();
  }
  return pages.join("\n\n");
}

async function renderCover(doc: PDFDocumentProxy): Promise<Blob> {
  const page = await doc.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: COVER_WIDTH / base.width });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);

  await page.render({ canvas, viewport }).promise;
  page.cleanup();

  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not render the cover image."))),
      "image/jpeg",
      0.88
    )
  );
}

export async function processPdf(file: Blob): Promise<ProcessedPdf> {
  const { doc, close } = await openPdf(file);
  try {
    const text = await extractText(doc);
    const cover = await renderCover(doc);
    return { pageCount: doc.numPages, text, cover };
  } finally {
    await close();
  }
}

