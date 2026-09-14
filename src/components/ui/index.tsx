"use client";

import type { ReactNode } from "react";
import type { CheckStatus } from "@/lib/engine";
import type { WeekendPhase } from "@/lib/types";

/* ---------- Status ---------- */

export type Tone = "go" | "warn" | "nogo" | "unknown" | "navy" | "neutral";

export function toneForStatus(s: CheckStatus | string): Tone {
  switch (s) {
    case "PASS":
    case "OK":
    case "GO":
    case "LOW":
    case "EXCELLENT":
    case "GOOD":
    case "done":
      return "go";
    case "WARNING":
    case "AT RISK":
    case "MEDIUM":
    case "MARGINAL":
    case "CONDITIONAL GO":
    case "OVERBOOKED":
    case "inProgress":
    case "MODERATE":
    case "ELEVATED":
      return "warn";
    case "FAIL":
    case "NO GO":
    case "HIGH":
    case "CRITICAL":
    case "POOR":
    case "UNVIABLE":
    case "MISSED":
    case "CAPACITY MISMATCH":
    case "blocked":
    case "SEVERE":
    case "CATASTROPHIC":
      return "nogo";
    case "UNKNOWN":
    case "UPCOMING":
    case "open":
    case "na":
      return "unknown";
    default:
      return "neutral";
  }
}

const TONE_CLASS: Record<Tone, string> = {
  go: "bg-go-bg text-go border-go/30",
  warn: "bg-warn-bg text-warn border-warn/30",
  nogo: "bg-nogo-bg text-nogo border-nogo/30",
  unknown: "bg-unknown-bg text-unknown border-unknown/30",
  navy: "bg-navy text-white border-navy",
  neutral: "bg-sunken text-muted border-line",
};

export function Badge({ tone = "neutral", children, className = "", title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.08em] uppercase whitespace-nowrap ${TONE_CLASS[tone]} ${className}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ status, className = "" }: { status: string; className?: string }) {
  return <Badge tone={toneForStatus(status)} className={className}>{status}</Badge>;
}

export function PhaseBadge({ phase }: { phase: WeekendPhase }) {
  const tone: Tone = phase === "COMPLETED" ? "neutral" : phase === "LIVE" ? "go" : phase === "LOCKED" ? "navy" : phase === "READY" ? "go" : phase === "PLANNING" ? "warn" : "unknown";
  return <Badge tone={tone}>{phase}</Badge>;
}

/* ---------- Layout ---------- */

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <div className="erp-label mb-1">{eyebrow}</div>}
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-navy">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, eyebrow, actions, children, className = "", navy = false, padded = true }: { title?: ReactNode; eyebrow?: string; actions?: ReactNode; children: ReactNode; className?: string; navy?: boolean; padded?: boolean }) {
  return (
    <section className={`${navy ? "card-navy" : "card"} ${className}`}>
      {(title || eyebrow || actions) && (
        <header className={`flex items-start justify-between gap-2 px-4 pt-3 ${padded ? "pb-2" : "pb-3 border-b border-line"}`}>
          <div>
            {eyebrow && <div className="erp-label">{eyebrow}</div>}
            {title && <h2 className={`text-sm font-bold ${navy ? "text-white" : "text-navy"}`}>{title}</h2>}
          </div>
          {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      <div className={padded ? "px-4 pb-4" : ""}>{children}</div>
    </section>
  );
}

export function Kpi({ label, value, unit, sub, tone, className = "" }: { label: string; value: ReactNode; unit?: string; sub?: ReactNode; tone?: Tone; className?: string }) {
  const color = tone === "go" ? "text-go" : tone === "warn" ? "text-warn" : tone === "nogo" ? "text-nogo" : "";
  return (
    <div className={`card px-4 py-3 ${className}`}>
      <div className="erp-label">{label}</div>
      <div className={`erp-mono text-2xl font-semibold leading-tight mt-1 ${color}`}>
        {value}
        {unit && <span className="text-sm font-medium text-faint ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-[11.5px] text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function Progress({ value, tone, className = "" }: { value: number; tone?: Tone; className?: string }) {
  const bar = tone === "go" ? "bg-go" : tone === "warn" ? "bg-warn" : tone === "nogo" ? "bg-nogo" : "bg-cobalt";
  return (
    <div className={`h-2 w-full rounded-full bg-sunken overflow-hidden ${className}`}>
      <div className={`h-full ${bar}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

export function toneForPercent(p: number): Tone {
  return p >= 80 ? "go" : p >= 55 ? "warn" : "nogo";
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card px-6 py-10 text-center">
      <div className="font-bold text-navy">{title}</div>
      {children && <div className="text-sm text-muted mt-1">{children}</div>}
    </div>
  );
}

export function Callout({ tone = "warn", title, children }: { tone?: Tone; title?: ReactNode; children: ReactNode }) {
  return (
    <div className={`rounded-[6px] border px-3 py-2 text-sm ${TONE_CLASS[tone]}`}>
      {title && <div className="font-bold text-xs tracking-[0.08em] uppercase mb-0.5">{title}</div>}
      <div className="text-[13px] leading-snug">{children}</div>
    </div>
  );
}

/* ---------- Forms ---------- */

export function Field({ label, hint, children, className = "" }: { label: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="erp-label block mb-1">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-faint mt-0.5">{hint}</span>}
    </label>
  );
}

export function TextInput({ value, onChange, placeholder, type = "text" }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return <input className="input" type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />;
}

export function NumberInput({ value, onChange, min = 0, max, step = 1 }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }) {
  return (
    <input
      className="input erp-mono"
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      step={step}
      onChange={(e) => onChange(e.target.value === "" ? 0 : Number(e.target.value))}
    />
  );
}

export function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { value: T; label: string }[] }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
      <input type="checkbox" className="input" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label && <span>{label}</span>}
    </label>
  );
}

/** datetime-local ↔ ISO helper */
export function DateTimeInput({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
  const local = value ? toLocalInput(value) : "";
  return (
    <input
      className="input erp-mono"
      type="datetime-local"
      value={local}
      onChange={(e) => {
        if (!e.target.value) return;
        onChange(new Date(e.target.value).toISOString());
      }}
    />
  );
}

export function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
