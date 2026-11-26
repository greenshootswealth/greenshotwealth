import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { getAdminSession } from "@/lib/auth";

// Issues short-lived tokens so the browser can upload PDFs and covers straight to
// Vercel Blob. Files never pass through this function, so Vercel's ~4.5 MB request
// body limit does not apply.

const MAX_PDF_BYTES = 50 * 1024 * 1024;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const NOT_CONFIGURED =
  "File storage isn't connected: BLOB_READ_WRITE_TOKEN is missing. In Vercel, open Storage → Blob, create a store and connect it to this project. For local development, copy the token into .env (or run `vercel env pull`) and restart the dev server.";

/** Preflight so the admin UI can show a clear message instead of the SDK's generic error. */
export async function GET() {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(
    process.env.BLOB_READ_WRITE_TOKEN ? { configured: true } : { configured: false, error: NOT_CONFIGURED }
  );
}

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: NOT_CONFIGURED }, { status: 500 });
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // Token requests come from the signed-in admin's browser. The completion
        // callback comes from Vercel and is verified by handleUpload itself.
        const session = await getAdminSession();
        if (!session) throw new Error("Unauthorized");

        if (!pathname.startsWith("research/")) throw new Error("Invalid upload path");
        const isPdf = pathname.endsWith(".pdf");
        return {
          allowedContentTypes: isPdf ? ["application/pdf"] : ["image/jpeg", "image/webp"],
          maximumSizeInBytes: isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES,
          addRandomSuffix: true,
          cacheControlMaxAge: 60 * 60 * 24 * 365,
        };
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 400 }
    );
  }
}
