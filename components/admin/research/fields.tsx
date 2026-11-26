"use client";

import React, { useEffect, useRef, useState } from "react";

// Small form primitives for the research editor, styled to match the admin portal.

export const inputCls =
  "w-full px-3 py-2 rounded-lg bg-white border border-[#ded8cb] text-sm text-[#1F3A2C] placeholder:text-[#a3ab9f] focus:outline-none focus:ring-2 focus:ring-[#8fa868]/50 focus:border-[#8fa868] transition-shadow";

export function Field({
  label,
  hint,
  count,
  limit,
  children,
}: {
  label: string;
  hint?: string;
  count?: number;
  limit?: number;
  children: React.ReactNode;
}) {
  const over = limit !== undefined && count !== undefined && count > limit;
  return (
    <label className="block space-y-1.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#5d7064]">{label}</span>
        {count !== undefined && (
          <span className={`text-[11px] tabular-nums ${over ? "text-rose-600 font-semibold" : "text-[#9aa79d]"}`}>
            {count}
            {limit !== undefined && ` / ${limit}`}
          </span>
        )}
      </span>
      {children}
      {hint && <span className="block text-[11px] text-[#8a978d] leading-snug">{hint}</span>}
    </label>
  );
}

export function TextInput(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
    value: string;
    onChange: (v: string) => void;
  }
) {
  const { value, onChange, className, ...rest } = props;
  return (
    <input
      {...rest}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} ${className ?? ""}`}
    />
  );
}

/** Textarea that grows with its content. */
export function TextArea({
  value,
  onChange,
  minRows = 3,
  className,
  ...rest
}: Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange" | "value"> & {
  value: string;
  onChange: (v: string) => void;
  minRows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea
      {...rest}
      ref={ref}
      rows={minRows}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${inputCls} resize-none leading-relaxed ${className ?? ""}`}
    />
  );
}

/**
 * Edits a list of paragraphs as one textarea, separated by blank lines.
 * Keeps the raw text locally so typing a blank line doesn't move the caret.
 */
export function ParagraphsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const joined = value.join("\n\n");
  const [text, setText] = useState(joined);
  const lastEmitted = useRef(joined);

  // Pick up outside changes (e.g. regenerate) without clobbering local typing.
  useEffect(() => {
    if (joined !== lastEmitted.current) {
      setText(joined);
      lastEmitted.current = joined;
    }
  }, [joined]);

  return (
    <TextArea
      value={text}
      minRows={4}
      placeholder={placeholder}
      onChange={(v) => {
        setText(v);
        const parts = v
          .split(/\n\s*\n/)
          .map((p) => p.replace(/\s+/g, " ").trim())
          .filter(Boolean);
        lastEmitted.current = parts.join("\n\n");
        onChange(parts);
      }}
    />
  );
}

/** Comma/Enter separated tags. */
export function TagsInput({
  value,
  onChange,
  placeholder,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = () => {
    const parts = draft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };
  return (
    <div className={`${inputCls} flex flex-wrap gap-1.5 items-center min-h-[42px] py-1.5`}>
      {value.map((tag, i) => (
        <span
          key={`${tag}-${i}`}
          className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-[#EEF0D9] text-[#1F3A2C] text-xs"
        >
          {tag}
          <button
            type="button"
            aria-label={`Remove ${tag}`}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
            className="w-4 h-4 rounded-full hover:bg-[#1F3A2C]/10 text-[#5d7064] leading-none"
          >
            ×
          </button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={commit}
        placeholder={value.length ? "" : placeholder}
        className="flex-1 min-w-[140px] bg-transparent text-sm focus:outline-none placeholder:text-[#a3ab9f]"
      />
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
  tone = "neutral",
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`w-7 h-7 shrink-0 rounded-md text-xs flex items-center justify-center border transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
        tone === "danger"
          ? "border-transparent text-rose-600 hover:bg-rose-50"
          : "border-transparent text-[#5d7064] hover:bg-[#f0ebe0]"
      }`}
    >
      {children}
    </button>
  );
}

export function Card({
  title,
  description,
  action,
  children,
  id,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="bg-white rounded-2xl border border-[#e5dfd3] shadow-xs scroll-mt-24">
      <header className="px-5 py-4 border-b border-[#f0ebe0] flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#1F3A2C]">{title}</h3>
          {description && <p className="text-xs text-[#7d8b81] mt-0.5">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-5 space-y-4">{children}</div>
    </section>
  );
}

export function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = list.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
