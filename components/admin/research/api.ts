"use client";

import { upload } from "@vercel/blob/client";
import { slugify } from "@/lib/research/content";
import type { AdminReport } from "@/lib/research/types";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status}).`, res.status);
  return data as T;
}

export const researchApi = {
  list: () => request<{ reports: AdminReport[] }>("/api/admin/research").then((d) => d.reports),

  create: (input: {
    pdfUrl: string;
    coverImage: string;
    pageCount: number;
    fileSizeBytes: number;
    originalFilename: string;
    sourceText: string;
  }) =>
    request<{ report: AdminReport }>("/api/admin/research", {
      method: "POST",
      body: JSON.stringify(input),
    }).then((d) => d.report),

  generate: (id: string) =>
    request<{ report: AdminReport }>(`/api/admin/research/${id}/generate`, { method: "POST" }).then(
      (d) => d.report
    ),

  update: (id: string, patch: Record<string, unknown>) =>
    request<{ report: AdminReport }>(`/api/admin/research/${id}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }).then((d) => d.report),

  storageStatus: () =>
    request<{ configured: boolean; error?: string }>("/api/admin/research/upload"),

  remove: (id: string) => request<{ success: true }>(`/api/admin/research/${id}`, { method: "DELETE" }),
};

/** Upload straight from the browser to Vercel Blob. */
export async function uploadToBlob(
  file: Blob,
  pathname: string,
  contentType: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const result = await upload(pathname, file, {
    access: "public",
    handleUploadUrl: "/api/admin/research/upload",
    contentType,
    multipart: file.size > 8 * 1024 * 1024,
    onUploadProgress: onProgress ? ({ percentage }) => onProgress(percentage) : undefined,
  });
  return result.url;
}

export function blobBaseName(filename: string): string {
  return slugify(filename.replace(/\.pdf$/i, "")) || "report";
}
