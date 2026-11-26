"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  estimateReadMinutes,
  formatFileSize,
  publishBlockers,
  slugify,
} from "@/lib/research/content";
import { findUnverifiedFigures } from "@/lib/research/verify";
import {
  SERVICE_LINKS,
  type AdminReport,
  type PublicationSection,
  type ReportContent,
} from "@/lib/research/types";
import { researchApi, uploadToBlob } from "./api";
import {
  Card,
  Field,
  IconButton,
  ParagraphsInput,
  TagsInput,
  TextArea,
  TextInput,
  inputCls,
  move,
} from "./fields";

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
}

interface Props {
  report: AdminReport;
  categorySuggestions: string[];
  seriesSuggestions: string[];
  onClose: () => void;
  onChange: (report: AdminReport) => void;
  notify: (message: string, type?: "success" | "error" | "info", title?: string) => void;
  confirm: (opts: ConfirmOptions) => void;
}

interface Draft {
  title: string;
  slug: string;
  publishedAt: string;
  readMinutes: number;
  content: ReportContent;
}

const toDraft = (r: AdminReport): Draft => ({
  title: r.title,
  slug: r.slug,
  publishedAt: r.publishedAt,
  readMinutes: r.readMinutes,
  content: r.content,
});

const NAV = [
  ["basics", "Basics"],
  ["highlights", "Highlights"],
  ["summary", "Summary & takeaways"],
  ["sections", "Sections"],
  ["seo", "Search (SEO)"],
  ["cta", "Call to action"],
] as const;

export default function ResearchEditor({
  report,
  categorySuggestions,
  seriesSuggestions,
  onClose,
  onChange,
  notify,
  confirm,
}: Props) {
  const [saved, setSaved] = useState<Draft>(() => toDraft(report));
  const [draft, setDraft] = useState<Draft>(() => toDraft(report));
  const [busy, setBusy] = useState<null | "save" | "publish" | "unpublish" | "generate" | "cover">(null);
  const [showSource, setShowSource] = useState(false);
  const [sourceQuery, setSourceQuery] = useState("");
  const coverInput = useRef<HTMLInputElement>(null);

  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(saved), [draft, saved]);
  const isLive = report.status === "PUBLISHED";
  const { content } = draft;

  const setContent = useCallback(
    (fn: (c: ReportContent) => ReportContent) => setDraft((d) => ({ ...d, content: fn(d.content) })),
    []
  );
  const setSections = (fn: (s: PublicationSection[]) => PublicationSection[]) =>
    setContent((c) => ({ ...c, sections: fn(c.sections) }));

  const unverified = useMemo(
    () => findUnverifiedFigures(content, draft.title, report.sourceText),
    [content, draft.title, report.sourceText]
  );
  const blockers = useMemo(() => publishBlockers(draft.title, content), [draft.title, content]);

  const apply = useCallback(
    (updated: AdminReport) => {
      const d = toDraft(updated);
      setSaved(d);
      setDraft(d);
      onChange(updated);
    },
    [onChange]
  );

  const patchBody = () => ({
    title: draft.title,
    slug: draft.slug,
    publishedAt: draft.publishedAt,
    readMinutes: draft.readMinutes,
    content: draft.content,
  });

  const save = useCallback(async () => {
    if (!dirty || busy) return;
    setBusy("save");
    try {
      apply(await researchApi.update(report.id, patchBody()));
      notify(isLive ? "Changes are live on the website." : "Draft saved.", "success", "Saved");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Save failed.", "error", "Save failed");
    } finally {
      setBusy(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, busy, draft, report.id, isLive]);

  // Cmd/Ctrl+S saves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save]);

  // Warn before closing the tab with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const publish = async () => {
    if (blockers.length) return;
    const doPublish = async () => {
      setBusy("publish");
      try {
        apply(await researchApi.update(report.id, { ...patchBody(), status: "PUBLISHED" }));
        notify("The report is now live in Insights → Research.", "success", "Published");
      } catch (e) {
        notify(e instanceof Error ? e.message : "Publish failed.", "error", "Publish failed");
      } finally {
        setBusy(null);
      }
    };
    if (unverified.length > 0) {
      confirm({
        title: "Publish with unchecked figures?",
        message: `${unverified.length} figure${unverified.length === 1 ? "" : "s"} on this page could not be found in the PDF text. Publish only if you have checked each one against the PDF.`,
        confirmText: "I've checked them, publish",
        onConfirm: doPublish,
      });
    } else {
      doPublish();
    }
  };

  const unpublish = () =>
    confirm({
      title: "Unpublish this report?",
      message: "It will disappear from the website and sitemap. The PDF and your edits are kept as a draft.",
      confirmText: "Unpublish",
      isDestructive: true,
      onConfirm: async () => {
        setBusy("unpublish");
        try {
          apply(await researchApi.update(report.id, { ...patchBody(), status: "DRAFT" }));
          notify("The report is back in drafts.", "info", "Unpublished");
        } catch (e) {
          notify(e instanceof Error ? e.message : "Unpublish failed.", "error");
        } finally {
          setBusy(null);
        }
      },
    });

  const regenerate = () =>
    confirm({
      title: "Rewrite all fields from the PDF?",
      message:
        "This replaces the title, summary, metrics, sections, SEO and call to action with a fresh draft. Any edits you made to those fields will be lost.",
      confirmText: "Regenerate",
      isDestructive: true,
      onConfirm: async () => {
        setBusy("generate");
        try {
          apply(await researchApi.generate(report.id));
          notify("A fresh draft was written from the PDF. Review it before publishing.", "success", "Regenerated");
        } catch (e) {
          notify(e instanceof Error ? e.message : "Generation failed.", "error", "Generation failed");
        } finally {
          setBusy(null);
        }
      },
    });

  const replaceCover = async (file: File) => {
    if (!["image/jpeg", "image/webp"].includes(file.type)) {
      notify("Use a JPG or WebP image.", "error");
      return;
    }
    setBusy("cover");
    try {
      const url = await uploadToBlob(file, `research/covers/${slugify(draft.slug) || "cover"}.${file.type === "image/webp" ? "webp" : "jpg"}`, file.type);
      apply(await researchApi.update(report.id, { coverImage: url }));
      notify("Cover image replaced.", "success");
    } catch (e) {
      notify(e instanceof Error ? e.message : "Cover upload failed.", "error");
    } finally {
      setBusy(null);
    }
  };

  const openPreview = async () => {
    const url = `/admin/research/preview/${report.id}`;
    if (!dirty) {
      window.open(url, "_blank");
      return;
    }
    // Open the tab inside the click (so it isn't blocked), then load it after saving.
    const tab = window.open("about:blank", "_blank");
    await save();
    if (tab) tab.location.href = url;
  };

  const close = () => {
    if (!dirty) return onClose();
    confirm({
      title: "Discard unsaved changes?",
      message: "You have edits that haven't been saved.",
      confirmText: "Discard",
      isDestructive: true,
      onConfirm: onClose,
    });
  };

  const sourceMatches = useMemo(() => {
    const q = sourceQuery.trim().toLowerCase();
    if (!q || !report.sourceText) return null;
    const text = report.sourceText;
    const lower = text.toLowerCase();
    const hits: string[] = [];
    let i = lower.indexOf(q);
    while (i !== -1 && hits.length < 8) {
      hits.push(text.slice(Math.max(0, i - 70), i + q.length + 70).replace(/\s+/g, " "));
      i = lower.indexOf(q, i + q.length);
    }
    return hits;
  }, [sourceQuery, report.sourceText]);

  const urlPath = `/insights/research/${draft.slug}`;

  return (
    <div className="min-h-screen bg-[#F5F1E8] text-[#1F3A2C] font-sans">
      {/* Top bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#e5dfd3]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center gap-4">
          <button
            onClick={close}
            className="text-xs font-semibold text-[#5d7064] hover:text-[#1F3A2C] flex items-center gap-1.5 shrink-0"
          >
            <span aria-hidden>←</span> Reports
          </button>
          <div className="min-w-0 flex-1 flex items-center gap-2.5">
            <span
              className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                isLive
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              }`}
            >
              {isLive ? "Live" : "Draft"}
            </span>
            <span className="truncate text-sm font-semibold">{draft.title || "Untitled report"}</span>
            <span className="hidden md:inline text-[11px] text-[#9aa79d] shrink-0">
              {busy === "save" ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={openPreview}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#ded8cb] bg-white hover:bg-[#faf8f5]"
            >
              Preview ↗
            </button>
            <button
              onClick={save}
              disabled={!dirty || busy !== null}
              className="px-3 py-2 rounded-lg text-xs font-semibold border border-[#1F3A2C] text-[#1F3A2C] hover:bg-[#1F3A2C]/5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {busy === "save" ? "Saving…" : isLive ? "Update live page" : "Save draft"}
            </button>
            {isLive ? (
              <button
                onClick={unpublish}
                disabled={busy !== null}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-[#f3efe6] text-[#5d4d2b] hover:bg-[#ebe4d5] disabled:opacity-40"
              >
                Unpublish
              </button>
            ) : (
              <button
                onClick={publish}
                disabled={blockers.length > 0 || busy !== null}
                title={blockers.length ? `Missing: ${blockers.join(", ")}` : undefined}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1F3A2C] text-white hover:bg-[#14281e] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy === "publish" ? "Publishing…" : "Publish"}
              </button>
            )}
          </div>
        </div>
      </header>

      {busy === "generate" && (
        <div className="fixed inset-0 z-50 bg-[#F5F1E8]/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-2xl border border-[#e5dfd3] shadow-xl px-8 py-6 text-center space-y-2">
            <div className="w-6 h-6 mx-auto rounded-full border-2 border-[#8fa868] border-t-transparent animate-spin" />
            <p className="text-sm font-semibold">Reading the PDF and writing a fresh draft…</p>
            <p className="text-xs text-[#7d8b81]">Usually 10–30 seconds.</p>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 items-start">
        {/* LEFT: the form */}
        <div className="space-y-6 min-w-0">
          <nav className="flex flex-wrap gap-1.5">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-white border border-[#e5dfd3] text-[#5d7064] hover:text-[#1F3A2C] hover:border-[#c9c1b0]"
              >
                {label}
              </a>
            ))}
          </nav>

          <Card id="basics" title="Basics" description="How the report is titled, filed and dated.">
            <Field label="Title" count={draft.title.length} limit={90}>
              <TextInput
                value={draft.title}
                onChange={(v) => setDraft((d) => ({ ...d, title: v }))}
                placeholder="Who Will Power India's Next Decade?"
                className="text-base font-semibold"
              />
            </Field>
            <Field label="Subtitle" count={content.subtitle.length} limit={200} hint="One sentence under the title.">
              <TextArea
                minRows={2}
                value={content.subtitle}
                onChange={(v) => setContent((c) => ({ ...c, subtitle: v }))}
              />
            </Field>
            <Field
              label="URL"
              hint={
                isLive && draft.slug !== saved.slug
                  ? "Changing the URL of a live report breaks links already shared or indexed by Google."
                  : `greenshootswealth.com${urlPath}`
              }
            >
              <div className="flex items-center">
                <span className="px-3 py-2 rounded-l-lg border border-r-0 border-[#ded8cb] bg-[#faf8f5] text-xs text-[#7d8b81] whitespace-nowrap">
                  /insights/research/
                </span>
                <input
                  value={draft.slug}
                  onChange={(e) => setDraft((d) => ({ ...d, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") }))}
                  onBlur={() => setDraft((d) => ({ ...d, slug: slugify(d.slug) || saved.slug }))}
                  className={`${inputCls} rounded-l-none font-mono text-xs`}
                />
              </div>
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Category">
                <TextInput
                  list="research-categories"
                  value={content.category}
                  onChange={(v) => setContent((c) => ({ ...c, category: v }))}
                  placeholder="Retirement & SWP"
                />
                <datalist id="research-categories">
                  {categorySuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Series">
                <TextInput
                  list="research-series"
                  value={content.series}
                  onChange={(v) => setContent((c) => ({ ...c, series: v }))}
                  placeholder="The Steady Mind · Special Issue"
                />
                <datalist id="research-series">
                  {seriesSuggestions.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </Field>
              <Field label="Issue date" hint="Shown as month and year. Newest reports are listed first.">
                <input
                  type="date"
                  value={draft.publishedAt}
                  onChange={(e) => setDraft((d) => ({ ...d, publishedAt: e.target.value }))}
                  className={inputCls}
                />
              </Field>
              <Field label="Read time (minutes)">
                <div className="flex gap-2">
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={draft.readMinutes}
                    onChange={(e) => setDraft((d) => ({ ...d, readMinutes: Number(e.target.value) || 1 }))}
                    className={inputCls}
                  />
                  <button
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, readMinutes: estimateReadMinutes(d.content) }))}
                    className="px-3 rounded-lg border border-[#ded8cb] text-xs font-semibold text-[#5d7064] hover:bg-[#faf8f5] whitespace-nowrap"
                  >
                    Estimate
                  </button>
                </div>
              </Field>
            </div>
          </Card>

          <Card
            id="highlights"
            title="Highlights"
            description="The headline figure on the card, and the metric strip at the top of the page."
            action={
              content.keyMetrics.length < 6 && (
                <button
                  type="button"
                  onClick={() =>
                    setContent((c) => ({ ...c, keyMetrics: [...c.keyMetrics, { label: "", value: "", desc: "" }] }))
                  }
                  className="text-xs font-semibold text-[#52704e] hover:text-[#1F3A2C] whitespace-nowrap"
                >
                  + Metric
                </button>
              )
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-3 p-4 rounded-xl bg-[#EEF0D9]/50 border border-[#8fa868]/25">
              <Field label="Headline figure">
                <TextInput
                  value={content.headlineStat.value}
                  onChange={(v) => setContent((c) => ({ ...c, headlineStat: { ...c.headlineStat, value: v } }))}
                  placeholder="555 GW"
                  className="font-semibold"
                />
              </Field>
              <Field label="What it means">
                <TextInput
                  value={content.headlineStat.label}
                  onChange={(v) => setContent((c) => ({ ...c, headlineStat: { ...c.headlineStat, label: v } }))}
                  placeholder="Installed power capacity, 52.3% now non-fossil"
                />
              </Field>
            </div>

            {content.keyMetrics.length === 0 && (
              <p className="text-xs text-[#9aa79d]">No metrics yet. Four works best.</p>
            )}
            <div className="space-y-3">
              {content.keyMetrics.map((m, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="mt-2 w-5 text-[11px] font-mono text-[#9aa79d]">{i + 1}</span>
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
                    <TextInput
                      value={m.label}
                      placeholder="Label"
                      onChange={(v) =>
                        setContent((c) => ({
                          ...c,
                          keyMetrics: c.keyMetrics.map((x, j) => (j === i ? { ...x, label: v } : x)),
                        }))
                      }
                    />
                    <TextInput
                      value={m.value}
                      placeholder="Figure"
                      className="font-semibold"
                      onChange={(v) =>
                        setContent((c) => ({
                          ...c,
                          keyMetrics: c.keyMetrics.map((x, j) => (j === i ? { ...x, value: v } : x)),
                        }))
                      }
                    />
                    <div className="sm:col-span-2">
                      <TextInput
                        value={m.desc}
                        placeholder="One line of context"
                        onChange={(v) =>
                          setContent((c) => ({
                            ...c,
                            keyMetrics: c.keyMetrics.map((x, j) => (j === i ? { ...x, desc: v } : x)),
                          }))
                        }
                      />
                    </div>
                  </div>
                  <div className="flex flex-col">
                    <IconButton label="Move up" disabled={i === 0} onClick={() => setContent((c) => ({ ...c, keyMetrics: move(c.keyMetrics, i, i - 1) }))}>↑</IconButton>
                    <IconButton label="Move down" disabled={i === content.keyMetrics.length - 1} onClick={() => setContent((c) => ({ ...c, keyMetrics: move(c.keyMetrics, i, i + 1) }))}>↓</IconButton>
                    <IconButton label="Remove metric" tone="danger" onClick={() => setContent((c) => ({ ...c, keyMetrics: c.keyMetrics.filter((_, j) => j !== i) }))}>✕</IconButton>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card id="summary" title="Summary & takeaways">
            <Field
              label="Executive summary"
              count={content.summary.split(/\s+/).filter(Boolean).length}
              limit={160}
              hint="Word count. 90–130 words reads best."
            >
              <TextArea
                minRows={5}
                value={content.summary}
                onChange={(v) => setContent((c) => ({ ...c, summary: v }))}
              />
            </Field>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5d7064]">Key takeaways</span>
                {content.keyTakeaways.length < 8 && (
                  <button
                    type="button"
                    onClick={() => setContent((c) => ({ ...c, keyTakeaways: [...c.keyTakeaways, ""] }))}
                    className="text-xs font-semibold text-[#52704e] hover:text-[#1F3A2C]"
                  >
                    + Takeaway
                  </button>
                )}
              </div>
              {content.keyTakeaways.map((t, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="mt-2.5 text-[#8fa868] text-xs">•</span>
                  <TextArea
                    minRows={1}
                    value={t}
                    onChange={(v) =>
                      setContent((c) => ({ ...c, keyTakeaways: c.keyTakeaways.map((x, j) => (j === i ? v : x)) }))
                    }
                  />
                  <div className="flex">
                    <IconButton label="Move up" disabled={i === 0} onClick={() => setContent((c) => ({ ...c, keyTakeaways: move(c.keyTakeaways, i, i - 1) }))}>↑</IconButton>
                    <IconButton label="Remove takeaway" tone="danger" onClick={() => setContent((c) => ({ ...c, keyTakeaways: c.keyTakeaways.filter((_, j) => j !== i) }))}>✕</IconButton>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card
            id="sections"
            title="Sections"
            description="The full web version of the report. Separate paragraphs with a blank line."
            action={
              <button
                type="button"
                onClick={() => setSections((s) => [...s, { heading: "", paragraphs: [] }])}
                className="text-xs font-semibold text-[#52704e] hover:text-[#1F3A2C] whitespace-nowrap"
              >
                + Section
              </button>
            }
          >
            {content.sections.length === 0 && <p className="text-xs text-[#9aa79d]">No sections yet.</p>}
            {content.sections.map((s, i) => (
              <SectionEditor
                key={i}
                index={i}
                total={content.sections.length}
                section={s}
                onChange={(next) => setSections((all) => all.map((x, j) => (j === i ? next : x)))}
                onMove={(to) => setSections((all) => move(all, i, to))}
                onRemove={() =>
                  confirm({
                    title: "Remove this section?",
                    message: `"${s.heading || `Section ${i + 1}`}" will be removed from the draft.`,
                    confirmText: "Remove",
                    isDestructive: true,
                    onConfirm: () => setSections((all) => all.filter((_, j) => j !== i)),
                  })
                }
              />
            ))}
          </Card>

          <Card id="seo" title="Search (SEO)" description="What Google shows. The page title and description in search results.">
            <SearchPreview
              title={content.seo.metaTitle || draft.title}
              url={`greenshootswealth.com › insights › research › ${draft.slug}`}
              description={content.seo.metaDescription}
            />
            <Field label="Meta title" count={content.seo.metaTitle.length} limit={60}>
              <TextInput
                value={content.seo.metaTitle}
                onChange={(v) => setContent((c) => ({ ...c, seo: { ...c.seo, metaTitle: v } }))}
              />
            </Field>
            <Field label="Meta description" count={content.seo.metaDescription.length} limit={158}>
              <TextArea
                minRows={2}
                value={content.seo.metaDescription}
                onChange={(v) => setContent((c) => ({ ...c, seo: { ...c.seo, metaDescription: v } }))}
              />
            </Field>
            <Field label="Keywords" hint="Press Enter or comma to add.">
              <TagsInput
                value={content.seo.keywords}
                onChange={(v) => setContent((c) => ({ ...c, seo: { ...c.seo, keywords: v } }))}
                placeholder="gold vs nifty returns"
              />
            </Field>
          </Card>

          <Card id="cta" title="Call to action" description="The dark band near the end of the report.">
            <Field label="Links to">
              <select
                value={content.relatedService.href}
                onChange={(e) =>
                  setContent((c) => ({ ...c, relatedService: { ...c.relatedService, href: e.target.value } }))
                }
                className={inputCls}
              >
                {SERVICE_LINKS.map((l) => (
                  <option key={l.href} value={l.href}>
                    {l.label} ({l.href})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Heading">
              <TextInput
                value={content.relatedService.title}
                onChange={(v) => setContent((c) => ({ ...c, relatedService: { ...c.relatedService, title: v } }))}
              />
            </Field>
            <Field label="Description">
              <TextArea
                minRows={2}
                value={content.relatedService.description}
                onChange={(v) =>
                  setContent((c) => ({ ...c, relatedService: { ...c.relatedService, description: v } }))
                }
              />
            </Field>
            <Field label="Button text" count={content.relatedService.buttonText.length} limit={30}>
              <TextInput
                value={content.relatedService.buttonText}
                onChange={(v) =>
                  setContent((c) => ({ ...c, relatedService: { ...c.relatedService, buttonText: v } }))
                }
              />
            </Field>
          </Card>
        </div>

        {/* RIGHT: file, checks, source */}
        <aside className="space-y-5 lg:sticky lg:top-24">
          <div className="bg-white rounded-2xl border border-[#e5dfd3] overflow-hidden">
            <div className="relative aspect-[3/4] bg-[#f3efe6]">
              {report.coverImage && (
                <Image
                  src={report.coverImage}
                  alt="Report cover"
                  fill
                  sizes="340px"
                  className="object-cover object-top"
                />
              )}
              {busy === "cover" && (
                <div className="absolute inset-0 bg-white/70 flex items-center justify-center text-xs font-semibold">
                  Uploading…
                </div>
              )}
            </div>
            <div className="p-4 space-y-3 text-xs">
              <div className="flex justify-between text-[#5d7064]">
                <span>
                  {report.pageCount} pages · {formatFileSize(report.fileSizeBytes)}
                </span>
                <a href={report.pdfUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#1F3A2C] hover:underline">
                  Open PDF ↗
                </a>
              </div>
              {report.originalFilename && (
                <p className="text-[11px] text-[#9aa79d] truncate" title={report.originalFilename}>
                  {report.originalFilename}
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => coverInput.current?.click()}
                  disabled={busy !== null}
                  className="flex-1 py-2 rounded-lg border border-[#ded8cb] font-semibold hover:bg-[#faf8f5] disabled:opacity-40"
                >
                  Replace cover
                </button>
                {!isLive && report.sourceText && (
                  <button
                    type="button"
                    onClick={regenerate}
                    disabled={busy !== null}
                    className="flex-1 py-2 rounded-lg border border-[#ded8cb] font-semibold hover:bg-[#faf8f5] disabled:opacity-40"
                  >
                    Regenerate
                  </button>
                )}
              </div>
              <input
                ref={coverInput}
                type="file"
                accept="image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) replaceCover(f);
                }}
              />
              {report.aiModel && report.generatedAt && (
                <p className="text-[11px] text-[#9aa79d]">
                  Drafted by {report.aiModel.split("/").pop()} on{" "}
                  {new Date(report.generatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </p>
              )}
            </div>
          </div>

          {/* Publish checklist */}
          {!isLive && (
            <div className="bg-white rounded-2xl border border-[#e5dfd3] p-4 space-y-2">
              <h4 className="text-xs font-semibold">Ready to publish?</h4>
              {blockers.length === 0 ? (
                <p className="text-xs text-emerald-700">All required fields are filled in.</p>
              ) : (
                <ul className="space-y-1 text-xs text-[#7d6a3d]">
                  {blockers.map((b) => (
                    <li key={b} className="flex gap-2">
                      <span className="text-[#c5a963]">○</span> {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Figure check */}
          <div className="bg-white rounded-2xl border border-[#e5dfd3] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold">Figure check</h4>
              {report.sourceText && (
                <span
                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    unverified.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"
                  }`}
                >
                  {unverified.length ? `${unverified.length} to check` : "All found in PDF"}
                </span>
              )}
            </div>
            {!report.sourceText ? (
              <p className="text-xs text-[#9aa79d]">No PDF text is stored for this report, so figures can&apos;t be checked automatically.</p>
            ) : unverified.length === 0 ? (
              <p className="text-xs text-[#7d8b81]">Every number on the page appears in the PDF text.</p>
            ) : (
              <>
                <p className="text-xs text-[#7d8b81]">
                  These figures don&apos;t appear in the PDF text. They may be reworded (e.g. ₹10.4 Lakh vs 10,40,000), or wrong. Check each one.
                </p>
                <ul className="max-h-56 overflow-y-auto divide-y divide-[#f0ebe0] text-xs">
                  {unverified.map((u, i) => (
                    <li key={i} className="py-1.5 flex justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowSource(true);
                          setSourceQuery(u.figure.replace(/[^\d.,]/g, "").split(/[.,]/)[0] || u.figure);
                        }}
                        className="font-semibold text-[#1F3A2C] hover:underline text-left"
                        title="Search the PDF text for this number"
                      >
                        {u.figure}
                      </button>
                      <span className="text-[#9aa79d] text-right">{u.where}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>

          {/* Source text */}
          {report.sourceText && (
            <div className="bg-white rounded-2xl border border-[#e5dfd3] p-4 space-y-3">
              <button
                type="button"
                onClick={() => setShowSource((v) => !v)}
                className="w-full flex items-center justify-between text-xs font-semibold"
              >
                <span>PDF text</span>
                <span className="text-[#9aa79d]">{showSource ? "Hide" : "Search"}</span>
              </button>
              {showSource && (
                <>
                  <input
                    value={sourceQuery}
                    onChange={(e) => setSourceQuery(e.target.value)}
                    placeholder="Search the PDF…"
                    className={`${inputCls} text-xs`}
                  />
                  {sourceMatches ? (
                    sourceMatches.length ? (
                      <ul className="space-y-2 max-h-72 overflow-y-auto">
                        {sourceMatches.map((m, i) => (
                          <li key={i} className="text-[11px] leading-relaxed text-[#4a5f51] bg-[#faf8f5] rounded-lg p-2">
                            …{m}…
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[11px] text-[#9aa79d]">Not found in the PDF.</p>
                    )
                  ) : (
                    <pre className="max-h-72 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed text-[#4a5f51] font-sans bg-[#faf8f5] rounded-lg p-3">
                      {report.sourceText}
                    </pre>
                  )}
                </>
              )}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function SearchPreview({ title, url, description }: { title: string; url: string; description: string }) {
  return (
    <div className="rounded-xl border border-[#e5dfd3] bg-[#fdfcfa] p-4 font-[arial,sans-serif]">
      <p className="text-[12px] text-[#4d5156] truncate">{url}</p>
      <p className="text-[18px] leading-snug text-[#1a0dab] truncate mt-0.5">{title || "Page title"}</p>
      <p className="text-[13px] leading-snug text-[#4d5156] mt-1 line-clamp-2">
        {description || "Meta description appears here."}
      </p>
    </div>
  );
}

function SectionEditor({
  index,
  total,
  section,
  onChange,
  onMove,
  onRemove,
}: {
  index: number;
  total: number;
  section: PublicationSection;
  onChange: (s: PublicationSection) => void;
  onMove: (to: number) => void;
  onRemove: () => void;
}) {
  const [open, setOpen] = useState(true);
  const set = <K extends keyof PublicationSection>(key: K, value: PublicationSection[K]) =>
    onChange({ ...section, [key]: value });

  return (
    <div className="rounded-xl border border-[#e8e2d4] bg-[#fdfcfa]">
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#f0ebe0]">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex-1 flex items-center gap-2 text-left min-w-0">
          <span className="text-[11px] font-mono text-[#8fa868] shrink-0">{String(index + 1).padStart(2, "0")}</span>
          <span className="text-sm font-semibold truncate">{section.heading || "Untitled section"}</span>
          <span className="text-[11px] text-[#9aa79d] shrink-0">
            {section.paragraphs.length} ¶{section.callout ? " · callout" : ""}
            {section.table ? " · table" : ""}
          </span>
        </button>
        <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}>↑</IconButton>
        <IconButton label="Move down" disabled={index === total - 1} onClick={() => onMove(index + 1)}>↓</IconButton>
        <IconButton label="Remove section" tone="danger" onClick={onRemove}>✕</IconButton>
      </div>
      {open && (
        <div className="p-4 space-y-3">
          <TextInput value={section.heading} onChange={(v) => set("heading", v)} placeholder="Section heading" className="font-semibold" />
          <TextInput
            value={section.subhead ?? ""}
            onChange={(v) => set("subhead", v || undefined)}
            placeholder="Subhead (optional)"
            className="italic text-[13px]"
          />
          <ParagraphsInput
            value={section.paragraphs}
            onChange={(v) => set("paragraphs", v)}
            placeholder="Write paragraphs here. Leave a blank line between paragraphs."
          />
          <Field label="Key insight callout (optional)">
            <TextArea minRows={1} value={section.callout ?? ""} onChange={(v) => set("callout", v || undefined)} />
          </Field>
          {section.table ? (
            <TableEditor table={section.table} onChange={(t) => set("table", t)} />
          ) : (
            <button
              type="button"
              onClick={() => set("table", { headers: ["", ""], rows: [["", ""]] })}
              className="text-xs font-semibold text-[#52704e] hover:text-[#1F3A2C]"
            >
              + Add data table
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TableEditor({
  table,
  onChange,
}: {
  table: NonNullable<PublicationSection["table"]>;
  onChange: (t: PublicationSection["table"]) => void;
}) {
  const cols = table.headers.length;
  const cell = "px-2 py-1.5 text-xs bg-transparent w-full min-w-[110px] focus:outline-none focus:bg-white";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5d7064]">Data table</span>
        <div className="flex gap-3 text-xs font-semibold">
          <button type="button" className="text-[#52704e]" onClick={() => onChange({ headers: [...table.headers, ""], rows: table.rows.map((r) => [...r, ""]) })}>+ Column</button>
          <button type="button" className="text-[#52704e]" onClick={() => onChange({ ...table, rows: [...table.rows, Array(cols).fill("")] })}>+ Row</button>
          <button type="button" className="text-rose-600" onClick={() => onChange(undefined)}>Remove table</button>
        </div>
      </div>
      <div className="overflow-x-auto rounded-lg border border-[#e8e2d4]">
        <table className="w-full">
          <thead className="bg-[#1F3A2C]">
            <tr>
              {table.headers.map((h, c) => (
                <th key={c} className="border-r border-white/10 last:border-r-0">
                  <div className="flex items-center">
                    <input
                      value={h}
                      placeholder={`Column ${c + 1}`}
                      onChange={(e) => onChange({ ...table, headers: table.headers.map((x, j) => (j === c ? e.target.value : x)) })}
                      className={`${cell} text-white font-semibold placeholder:text-white/40 focus:bg-white/10`}
                    />
                    {cols > 1 && (
                      <button
                        type="button"
                        title="Remove column"
                        onClick={() => onChange({ headers: table.headers.filter((_, j) => j !== c), rows: table.rows.map((r) => r.filter((_, j) => j !== c)) })}
                        className="px-1.5 text-white/40 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[#f0ebe0] bg-white">
            {table.rows.map((row, r) => (
              <tr key={r}>
                {row.map((v, c) => (
                  <td key={c} className="border-r border-[#f0ebe0] last:border-r-0">
                    <input
                      value={v}
                      onChange={(e) =>
                        onChange({
                          ...table,
                          rows: table.rows.map((x, i) => (i === r ? x.map((y, j) => (j === c ? e.target.value : y)) : x)),
                        })
                      }
                      className={`${cell} text-[#1F3A2C]`}
                    />
                  </td>
                ))}
                <td className="w-8 text-center">
                  <button
                    type="button"
                    title="Remove row"
                    onClick={() => onChange({ ...table, rows: table.rows.filter((_, i) => i !== r) })}
                    className="text-[#b9a9a9] hover:text-rose-600 text-xs"
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
