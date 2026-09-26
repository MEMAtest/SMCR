"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { AlertTriangle, Info, OctagonAlert, ShieldCheck } from "lucide-react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ----------------------------------- Layout ---------------------------------- */

export function Panel({ children, className, as: Tag = "section" }: { children: ReactNode; className?: string; as?: "section" | "div" | "article" }) {
  return <Tag className={cx("glass-panel p-6", className)}>{children}</Tag>;
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        {eyebrow && <p className="text-xs uppercase tracking-[0.3em] text-emerald">{eyebrow}</p>}
        <h1 className="text-3xl sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-sm text-sand/70">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-2xl">{title}</h2>
        {description && <p className="mt-1 text-sm text-sand/70">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 px-6 py-10 text-center">
      {icon && <div className="mx-auto mb-3 flex justify-center text-sand/50">{icon}</div>}
      <p className="font-semibold text-sand">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-sand/60">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* ---------------------------------- Buttons ---------------------------------- */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const buttonStyles: Record<ButtonVariant, string> = {
  primary: "bg-emerald text-midnight hover:bg-emerald/90 font-semibold",
  secondary: "border border-white/20 text-sand hover:border-emerald/60 hover:bg-white/5",
  ghost: "text-sand/80 hover:bg-white/5 hover:text-sand",
  danger: "border border-danger/50 text-danger hover:bg-danger/10",
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: "sm" | "md" }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full transition disabled:cursor-not-allowed disabled:opacity-40",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-5 py-2.5 text-sm",
        buttonStyles[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}

/* ----------------------------------- Forms ----------------------------------- */

const inputBase =
  "w-full rounded-xl border border-white/20 bg-midnight/60 px-3 py-2 text-sm text-sand placeholder:text-sand/40 focus:border-emerald focus:outline-none";

export function Field({ label, hint, error, children, className }: { label: string; hint?: ReactNode; error?: string; children: ReactNode; className?: string }) {
  return (
    <label className={cx("block space-y-1", className)}>
      <span className="text-sm text-sand/80">{label}</span>
      {children}
      {hint && !error && <span className="block text-xs text-sand/50">{hint}</span>}
      {error && <span className="block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(inputBase, props.className)} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={cx(inputBase, props.className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(inputBase, "pr-8", props.className)} />;
}

export function Checkbox({ label, hint, checked, onChange, disabled }: { label: ReactNode; hint?: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cx("flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2", disabled ? "opacity-50" : "cursor-pointer hover:border-white/25")}>
      <input type="checkbox" className="mt-1 size-4 accent-emerald" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className="block text-sm text-sand">{label}</span>
        {hint && <span className="block text-xs text-sand/60">{hint}</span>}
      </span>
    </label>
  );
}

/** Accessible segmented radio group (visible focus ring, arrow-key navigation via native radios). */
export function Segmented<T extends string>({
  name,
  value,
  options,
  onChange,
  ariaLabel,
}: {
  name: string;
  value: T | undefined;
  options: { value: T; label: string; tone?: "good" | "bad" | "neutral" }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex flex-wrap gap-2">
      {options.map((o) => {
        const selected = value === o.value;
        const tone =
          selected && o.tone === "bad"
            ? "border-warning bg-warning/15 text-warning"
            : selected && o.tone === "good"
              ? "border-emerald bg-emerald/15 text-emerald"
              : selected
                ? "border-sand/60 bg-sand/10 text-sand"
                : "border-white/20 text-sand/70 hover:border-white/40";
        return (
          <label key={o.value} className={cx("relative cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-emerald", tone)}>
            <input type="radio" name={name} value={o.value} checked={selected} onChange={() => onChange(o.value)} className="sr-only" />
            {o.label}
          </label>
        );
      })}
    </div>
  );
}

/* ---------------------------------- Status ----------------------------------- */

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "info" | "plum"; className?: string }) {
  const tones = {
    neutral: "border-white/20 text-sand/80",
    good: "border-emerald/50 bg-emerald/10 text-emerald",
    warn: "border-warning/50 bg-warning/10 text-warning",
    bad: "border-danger/50 bg-danger/10 text-danger",
    info: "border-cloud/30 bg-cloud/5 text-cloud",
    plum: "border-plumAccent/50 bg-plumAccent/10 text-plumAccent",
  };
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function VerifyBadge({ title = "Not yet confirmed against the live FCA Handbook" }: { title?: string }) {
  return (
    <span title={title}>
      <Badge tone="warn">verify</Badge>
    </span>
  );
}

export function SeverityIcon({ severity, className }: { severity: "blocker" | "warning" | "info" | "ok"; className?: string }) {
  const c = cx("size-4 shrink-0", className);
  if (severity === "blocker") return <OctagonAlert className={cx(c, "text-danger")} aria-label="Blocker" />;
  if (severity === "warning") return <AlertTriangle className={cx(c, "text-warning")} aria-label="Warning" />;
  if (severity === "info") return <Info className={cx(c, "text-cloud")} aria-label="Info" />;
  return <ShieldCheck className={cx(c, "text-emerald")} aria-label="OK" />;
}

export function Callout({ tone = "info", title, children }: { tone?: "info" | "warn" | "bad" | "good"; title?: string; children: ReactNode }) {
  const tones = {
    info: "border-cloud/20 bg-cloud/5",
    warn: "border-warning/40 bg-warning/10",
    bad: "border-danger/40 bg-danger/10",
    good: "border-emerald/40 bg-emerald/10",
  };
  const sev = tone === "bad" ? "blocker" : tone === "warn" ? "warning" : tone === "good" ? "ok" : "info";
  return (
    <div className={cx("flex gap-3 rounded-2xl border px-4 py-3 text-sm", tones[tone])}>
      <SeverityIcon severity={sev} className="mt-0.5" />
      <div className="space-y-1">
        {title && <p className="font-semibold text-sand">{title}</p>}
        <div className="text-sand/80">{children}</div>
      </div>
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="space-y-1">
      {label && (
        <div className="flex justify-between text-xs text-sand/70">
          <span>{label}</span>
          <span>{v}%</span>
        </div>
      )}
      <div className="h-2 overflow-hidden rounded-full bg-midnight/70" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className="h-full rounded-full bg-emerald transition-all duration-500" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

/** Skeleton shown until the persisted workspace has hydrated. */
export function LoadingPanel() {
  return <div className="glass-panel h-48 animate-pulse" aria-busy="true" aria-label="Loading workspace" />;
}

/** Trigger a browser download of a Blob or string. */
export function downloadFile(content: Blob | string, filename: string, type = "text/plain;charset=utf-8") {
  const blob = typeof content === "string" ? new Blob([content], { type }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function slugify(s: string): string {
  return (s || "firm").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "firm";
}
