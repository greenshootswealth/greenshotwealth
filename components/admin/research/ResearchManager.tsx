"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { formatFileSize, formatIssueDate } from "@/lib/research/content";
import { findUnverifiedFigures } from "@/lib/research/verify";
import type { AdminReport } from "@/lib/research/types";
import { blobBaseName, researchApi, uploadToBlob } from "./api";
import ResearchEditor, { type ConfirmOptions } from "./ResearchEditor";

type Notify = (message: string, type?: "success" | "error" | "info", title?: string) => void;

type Stage = "reading" | "uploading" | "writing" | "done" | "error";

interface Job {
  key: string;
  filename: string;
  stage: Stage;
  progress: number;
  error?: string;
  reportId?: string;
}

const STAGES: { id: Exclude<Stage, "done" | "error">; label: string }[] = [
  { id: "reading", label: "Reading PDF" },
  { id: "uploading", label: "Uploading" },
  { id: "writing", label: "Writing draft" },
];

const MAX_PDF_MB = 50;

export default function ResearchManager({
  notify,
  confirm,
  searchQuery,
  onCountChange,
}: {
  notify: Notify;
  confirm: (opts: ConfirmOptions) => void;
  searchQuery: string;
  onCountChange?: (n: number) => void;
}) {
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      setReports(await researchApi.list());
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    researchApi
      .list()
      .then((list) => !cancelled && setReports(list))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : "Could not load reports."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    onCountChange?.(reports.length);
  }, [reports.length, onCountChange]);

  const upsert = useCallback((r: AdminReport) => {
    setReports((prev) => {
      const i = prev.findIndex((x) => x.id === r.id);
      if (i === -1) return [r, ...prev];
      const next = prev.slice();
      next[i] = r;
      return next;
    });
  }, []);

  const updateJob = (key: string, patch: Partial<Job>) =>
    setJobs((prev) => prev.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const processFile = async (file: File, key: string): Promise<string | undefined> => {
    let reportId: string | undefined;
    try {
      // 1. Read the PDF in the browser: text, page count and a cover render.
      const { processPdf } = await import("@/lib/research/pdf-client");
      const pdf = await processPdf(file);

      // 2. Upload both files straight to Blob storage.
      updateJob(key, { stage: "uploading", progress: 0 });
      const base = blobBaseName(file.name);
      let pdfPct = 0;
      let coverPct = 0;
      const report = () => updateJob(key, { progress: Math.round(pdfPct * 0.9 + coverPct * 0.1) });
      const [pdfUrl, coverImage] = await Promise.all([
        uploadToBlob(file, `research/${base}.pdf`, "application/pdf", (p) => {
          pdfPct = p;
          report();
        }),
        uploadToBlob(pdf.cover, `research/covers/${base}.jpg`, "image/jpeg", (p) => {
          coverPct = p;
          report();
        }),
      ]);

      // 3. Create the draft, then have the model write it.
      const draft = await researchApi.create({
        pdfUrl,
        coverImage,
        pageCount: pdf.pageCount,
        fileSizeBytes: file.size,
        originalFilename: file.name,
        sourceText: pdf.text,
      });
      reportId = draft.id;
      upsert(draft);
      updateJob(key, { stage: "writing", reportId });

      const written = await researchApi.generate(draft.id);
      upsert(written);
      updateJob(key, { stage: "done" });
      return written.id;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Something went wrong.";
      updateJob(key, {
        stage: "error",
        error: reportId
          ? `${message} The PDF is saved as a draft; open it to fill in the fields or try Regenerate.`
          : message,
        reportId,
      });
      return reportId;
    }
  };

  const handleFiles = async (list: FileList | File[]) => {
    const files = Array.from(list);
    const pdfs = files.filter((f) => f.type === "application/pdf" || /\.pdf$/i.test(f.name));
    if (pdfs.length < files.length) notify("Only PDF files can be added as research reports.", "error");
    const tooBig = pdfs.filter((f) => f.size > MAX_PDF_MB * 1024 * 1024);
    if (tooBig.length) notify(`${tooBig.map((f) => f.name).join(", ")} is over ${MAX_PDF_MB} MB.`, "error");
    const ok = pdfs.filter((f) => !tooBig.includes(f));
    if (!ok.length) return;

    // Check storage first: the Blob SDK hides the server's reason behind a generic error.
    try {
      const storage = await researchApi.storageStatus();
      if (!storage.configured) {
        notify(storage.error ?? "File storage is not configured.", "error", "Can't upload yet");
        return;
      }
    } catch (e) {
      notify(e instanceof Error ? e.message : "Could not reach the server.", "error", "Can't upload yet");
      return;
    }

    const newJobs: Job[] = ok.map((f) => ({
      key: `${f.name}-${f.size}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      filename: f.name,
      stage: "reading",
      progress: 0,
    }));
    setJobs((prev) => [...newJobs, ...prev]);

    // One at a time keeps AI rate limits and browser memory comfortable.
    const ids: (string | undefined)[] = [];
    for (let i = 0; i < ok.length; i++) ids.push(await processFile(ok[i], newJobs[i].key));

    const created = ids.filter(Boolean);
    if (ok.length === 1 && created[0]) {
      notify("Draft ready. Review every figure before publishing.", "success", "Draft written");
      setEditingId(created[0]!);
    } else if (created.length) {
      notify(`${created.length} drafts are ready for review.`, "success", "Drafts written");
    }
  };

  const remove = (r: AdminReport) =>
    confirm({
      title: "Delete this report?",
      message: `"${r.title}" and its PDF will be permanently deleted${
        r.status === "PUBLISHED" ? " and removed from the website" : ""
      }. This cannot be undone.`,
      confirmText: "Delete report",
      isDestructive: true,
      onConfirm: async () => {
        try {
          await researchApi.remove(r.id);
          setReports((prev) => prev.filter((x) => x.id !== r.id));
          setJobs((prev) => prev.filter((j) => j.reportId !== r.id));
          notify(`"${r.title}" was deleted.`, "info", "Deleted");
        } catch (e) {
          notify(e instanceof Error ? e.message : "Delete failed.", "error");
        }
      },
    });

  const categorySuggestions = useMemo(
    () => Array.from(new Set(reports.map((r) => r.content.category).filter(Boolean))).sort(),
    [reports]
  );
  const seriesSuggestions = useMemo(
    () => Array.from(new Set(reports.map((r) => r.content.series).filter(Boolean))).sort(),
    [reports]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = reports
      .slice()
      .sort((a, b) =>
        a.status !== b.status
          ? a.status === "DRAFT"
            ? -1
            : 1
          : b.publishedAt.localeCompare(a.publishedAt)
      );
    if (!q) return sorted;
    return sorted.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        r.slug.includes(q) ||
        r.content.category.toLowerCase().includes(q)
    );
  }, [reports, searchQuery]);

  const editing = editingId ? reports.find((r) => r.id === editingId) : undefined;
  if (editing) {
    return (
      <div className="fixed inset-0 z-[45] overflow-y-auto bg-[#F5F1E8]">
        <ResearchEditor
          key={editing.id}
          report={editing}
          categorySuggestions={categorySuggestions}
          seriesSuggestions={seriesSuggestions}
          onClose={() => setEditingId(null)}
          onChange={upsert}
          notify={notify}
          confirm={confirm}
        />
      </div>
    );
  }

  const activeJobs = jobs.filter((j) => j.stage !== "done");
  const live = reports.filter((r) => r.status === "PUBLISHED").length;

  return (
    <div className="space-y-5">
      {/* Drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
        }}
        onClick={() => fileInput.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileInput.current?.click()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging
            ? "border-[#8fa868] bg-[#EEF0D9]/60"
            : "border-[#d8d0bf] bg-white hover:border-[#8fa868] hover:bg-[#faf8f5]"
        }`}
      >
        <div className="mx-auto w-11 h-11 rounded-full bg-[#EEF0D9] flex items-center justify-center text-[#52704e]">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1" />
          </svg>
        </div>
        <p className="mt-3 text-sm font-semibold text-[#1F3A2C]">Drop a research PDF here, or click to choose</p>
        <p className="mt-1 text-xs text-[#7d8b81] max-w-md mx-auto">
          We render the cover, upload the file and write a draft web page from the PDF. Nothing goes live until you review it and press Publish.
        </p>
        <input
          ref={fileInput}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {/* Upload progress */}
      {activeJobs.length > 0 && (
        <div className="bg-white rounded-2xl border border-[#e5dfd3] divide-y divide-[#f0ebe0]">
          {activeJobs.map((job) => {
            const current = STAGES.findIndex((s) => s.id === job.stage);
            return (
              <div key={job.key} className="px-5 py-4 space-y-2.5">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm font-semibold text-[#1F3A2C] truncate">{job.filename}</span>
                  {job.stage === "error" && (
                    <div className="flex gap-3 shrink-0">
                      {job.reportId && (
                        <button
                          onClick={() => setEditingId(job.reportId!)}
                          className="text-xs font-semibold text-[#1F3A2C] hover:underline"
                        >
                          Open draft
                        </button>
                      )}
                      <button
                        onClick={() => setJobs((prev) => prev.filter((j) => j.key !== job.key))}
                        className="text-xs text-[#9aa79d] hover:text-[#1F3A2C]"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
                {job.stage === "error" ? (
                  <p className="text-xs text-rose-700">{job.error}</p>
                ) : (
                  <ol className="flex items-center gap-2 text-[11px]">
                    {STAGES.map((s, i) => {
                      const state = i < current ? "done" : i === current ? "active" : "todo";
                      return (
                        <li key={s.id} className="flex items-center gap-2">
                          {i > 0 && <span className="w-6 h-px bg-[#e5dfd3]" />}
                          <span
                            className={`flex items-center gap-1.5 ${
                              state === "done"
                                ? "text-[#52704e]"
                                : state === "active"
                                ? "text-[#1F3A2C] font-semibold"
                                : "text-[#b5bcb3]"
                            }`}
                          >
                            {state === "done" ? (
                              <span>✓</span>
                            ) : state === "active" ? (
                              <span className="w-3 h-3 rounded-full border-2 border-[#8fa868] border-t-transparent animate-spin" />
                            ) : (
                              <span className="w-3 h-3 rounded-full border border-current" />
                            )}
                            {s.label}
                            {state === "active" && s.id === "uploading" && ` ${job.progress}%`}
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Report list */}
      <div className="bg-white rounded-2xl border border-[#e5dfd3] shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 bg-[#f8f5ee] border-b border-[#e5dfd3] flex items-center justify-between">
          <span className="text-xs text-[#5d7064] font-medium">
            {live} live · {reports.length - live} draft{reports.length - live === 1 ? "" : "s"}
          </span>
          <button onClick={load} className="text-xs text-[#5d7064] hover:text-[#1F3A2C]">
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="py-16 text-center text-xs text-[#9aa79d]">Loading reports…</div>
        ) : loadError ? (
          <div className="py-16 text-center text-xs text-rose-700">{loadError}</div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-xs text-[#9aa79d]">
            {searchQuery ? "No reports match your search." : "No research reports yet. Drop a PDF above to add the first one."}
          </div>
        ) : (
          <ul className="divide-y divide-[#f0ebe0]">
            {filtered.map((r) => {
              const checks = findUnverifiedFigures(r.content, r.title, r.sourceText).length;
              const isLive = r.status === "PUBLISHED";
              const generating = jobs.some((j) => j.reportId === r.id && j.stage === "writing");
              return (
                <li key={r.id} className="px-5 py-4 flex items-center gap-4 hover:bg-[#faf9f5] transition-colors">
                  <button
                    onClick={() => setEditingId(r.id)}
                    className="relative w-12 h-16 rounded-md overflow-hidden bg-[#f3efe6] border border-[#e8e2d4] shrink-0"
                  >
                    {r.coverImage && (
                      <Image src={r.coverImage} alt="" fill sizes="48px" className="object-cover object-top" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                          isLive
                            ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                            : "bg-amber-50 text-amber-800 border-amber-200"
                        }`}
                      >
                        {isLive ? "Live" : generating ? "Writing…" : "Draft"}
                      </span>
                      {r.content.category && (
                        <span className="text-[11px] font-semibold text-[#8fa868] uppercase tracking-wider">
                          {r.content.category}
                        </span>
                      )}
                      {checks > 0 && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800">
                          {checks} figure{checks === 1 ? "" : "s"} to check
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setEditingId(r.id)}
                      className="block text-left text-sm font-semibold text-[#1F3A2C] hover:text-[#52704e] mt-1 truncate max-w-full"
                    >
                      {r.title}
                    </button>
                    <p className="text-[11px] text-[#9aa79d] mt-0.5">
                      {formatIssueDate(new Date(`${r.publishedAt}T00:00:00Z`))} · {r.pageCount} pages ·{" "}
                      {formatFileSize(r.fileSizeBytes)} · edited{" "}
                      {new Date(r.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isLive ? (
                      <a
                        href={`/insights/research/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium"
                      >
                        View live ↗
                      </a>
                    ) : (
                      <a
                        href={`/admin/research/preview/${r.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-medium"
                      >
                        Preview ↗
                      </a>
                    )}
                    <button
                      onClick={() => setEditingId(r.id)}
                      className="px-2.5 py-1.5 rounded-lg bg-[#1F3A2C] hover:bg-[#14281e] text-white text-xs font-medium"
                    >
                      {isLive ? "Edit" : "Review"}
                    </button>
                    <button
                      onClick={() => remove(r)}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
