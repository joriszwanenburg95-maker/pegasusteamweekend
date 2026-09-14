"use client";

/**
 * Lichtgewicht visuals voor de Control Room. Alleen CSS/SVG-animaties (GPU-vriendelijk),
 * geen externe libs. Respecteert prefers-reduced-motion via globals.css.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Tone } from "@/components/ui";

const TONE_HEX: Record<Tone, string> = {
  go: "var(--go)",
  warn: "var(--warn)",
  nogo: "var(--nogo)",
  unknown: "var(--unknown)",
  navy: "var(--pegasus-navy)",
  neutral: "var(--pegasus-cobalt)",
};

export function toneColor(tone: Tone = "neutral") {
  return TONE_HEX[tone];
}

/* ---------- Count-up ---------- */

/** Telt van 0 (of vorige waarde) naar `value` in ~600 ms met requestAnimationFrame. */
export function useCountUp(value: number, durationMs = 600): number {
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === value) {
      fromRef.current = value;
      setDisplay(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / durationMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setDisplay(from + (value - from) * eased);
      if (k < 1) raf = requestAnimationFrame(step);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, durationMs]);
  return display;
}

export function CountUp({ value, decimals = 0, className = "" }: { value: number; decimals?: number; className?: string }) {
  const v = useCountUp(value);
  return <span className={className}>{v.toFixed(decimals)}</span>;
}

/* ---------- Radiale gauge ---------- */

export function Gauge({
  value,
  max = 100,
  size = 120,
  stroke = 10,
  tone = "neutral",
  label,
  sublabel,
  decimals = 0,
  suffix = "",
  track = "var(--bg-sunken)",
  textColor,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: Tone;
  label?: ReactNode;
  sublabel?: ReactNode;
  decimals?: number;
  suffix?: string;
  track?: string;
  textColor?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, max === 0 ? 0 : value / max));
  const shown = useCountUp(value);
  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={toneColor(tone)}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="viz-arc"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <div className="erp-mono font-semibold" style={{ fontSize: size * 0.26, color: textColor }}>
          {shown.toFixed(decimals)}
          {suffix && <span style={{ fontSize: size * 0.12 }} className="opacity-60 ml-0.5">{suffix}</span>}
        </div>
        {label && <div className="erp-label mt-1" style={{ fontSize: Math.max(8, size * 0.075) }}>{label}</div>}
        {sublabel && <div className="text-[10px] opacity-70 mt-0.5">{sublabel}</div>}
      </div>
    </div>
  );
}

/* ---------- Gestapelde balk ---------- */

export interface Segment {
  label: string;
  value: number;
  tone?: Tone;
  color?: string;
}

export function StackedBar({ segments, height = 14, showLegend = true, formatValue }: { segments: Segment[]; height?: number; showLegend?: boolean; formatValue?: (v: number) => string }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  return (
    <div>
      <div className="flex w-full overflow-hidden rounded-full bg-sunken" style={{ height }}>
        {segments.map((s) => (
          <div
            key={s.label}
            title={`${s.label}: ${formatValue ? formatValue(s.value) : s.value}`}
            className="viz-grow h-full"
            style={{ width: `${(s.value / total) * 100}%`, background: s.color ?? toneColor(s.tone) }}
          />
        ))}
      </div>
      {showLegend && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5 text-[11px] text-muted">
          {segments.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-sm" style={{ background: s.color ?? toneColor(s.tone) }} />
              {s.label} <span className="erp-mono text-fg">{formatValue ? formatValue(s.value) : s.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Tijdvenster (avondbalk) ---------- */

export interface TimeSpan {
  label: string;
  fromMin: number; // minuten sinds 00:00, mag > 1440 voor na middernacht
  toMin: number;
  tone?: Tone;
  color?: string;
  hatched?: boolean;
}

/** Horizontale tijdlijn, standaard 16:00 → 04:00. */
export function TimeWindowBar({ spans, startMin = 16 * 60, endMin = 28 * 60, markers = [], height = 22 }: { spans: TimeSpan[]; startMin?: number; endMin?: number; markers?: { atMin: number; label: string; tone?: Tone }[]; height?: number }) {
  const range = endMin - startMin;
  const pos = (m: number) => `${Math.max(0, Math.min(100, ((m - startMin) / range) * 100))}%`;
  const ticks: number[] = [];
  for (let m = Math.ceil(startMin / 120) * 120; m <= endMin; m += 120) ticks.push(m);
  const clock = (m: number) => `${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:00`;
  return (
    <div className="w-full">
      <div className="relative w-full rounded bg-sunken" style={{ height: height + 8 }}>
        {spans.map((s, i) => (
          <div
            key={`${s.label}-${i}`}
            title={s.label}
            className={`absolute top-1 rounded-sm viz-grow-x ${s.hatched ? "viz-hatched" : ""}`}
            style={{
              left: pos(s.fromMin),
              width: `calc(${pos(Math.max(s.fromMin, s.toMin))} - ${pos(s.fromMin)})`,
              height,
              background: s.color ?? toneColor(s.tone),
              opacity: 0.9,
            }}
          >
            <span className="absolute inset-0 flex items-center px-1.5 text-[10px] font-semibold text-white truncate">{s.label}</span>
          </div>
        ))}
        {markers.map((m) => (
          <div key={m.label} className="absolute top-0 bottom-0" style={{ left: pos(m.atMin) }}>
            <div className="w-0.5 h-full" style={{ background: toneColor(m.tone ?? "navy") }} />
            <div className="absolute -top-0 left-1 text-[9.5px] font-bold whitespace-nowrap erp-mono" style={{ color: toneColor(m.tone ?? "navy") }}>
              {m.label}
            </div>
          </div>
        ))}
      </div>
      <div className="relative h-4 mt-0.5 text-[9.5px] text-faint erp-mono">
        {ticks.map((t) => (
          <span key={t} className="absolute -translate-x-1/2" style={{ left: pos(t) }}>
            {clock(t)}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- Stoelgrid (auto) ---------- */

export function SeatGrid({ seats, filled, lost, size = 18 }: { seats: number; filled: number; lost: number; size?: number }) {
  const cells = Array.from({ length: Math.max(seats, filled) }, (_, i) => {
    if (i >= seats - lost && i < seats) return "lost";
    if (i < filled) return "filled";
    return "free";
  });
  const overflow = filled > seats - lost;
  return (
    <div className="flex flex-wrap gap-1" title={`${filled} ingedeeld · ${lost} verloren aan bagage · ${seats} stoelen`}>
      {cells.map((c, i) => (
        <span
          key={i}
          className={`inline-flex items-center justify-center rounded-[3px] viz-pop ${c === "filled" ? (overflow && i >= seats - lost ? "bg-nogo" : "bg-cobalt") : c === "lost" ? "viz-hatched bg-warn" : "bg-sunken border border-line-strong"}`}
          style={{ width: size, height: size, animationDelay: `${i * 30}ms` }}
        >
          {c === "lost" && <span className="text-[9px] font-bold text-white">B</span>}
        </span>
      ))}
    </div>
  );
}

/* ---------- Puntenmatrix (aanwezigheid) ---------- */

export function DotRow({ values, size = 10 }: { values: ("going" | "notGoing" | "unknown")[]; size?: number }) {
  return (
    <div className="flex flex-wrap gap-0.5">
      {values.map((v, i) => (
        <span
          key={i}
          className={`inline-block rounded-full viz-pop ${v === "going" ? "bg-go" : v === "notGoing" ? "bg-nogo/70" : "bg-unknown/40 border border-unknown/60"}`}
          style={{ width: size, height: size, animationDelay: `${i * 20}ms` }}
        />
      ))}
    </div>
  );
}

/* ---------- Mini-sparkline / score-schaal ---------- */

export function ScoreScale({ value, max, tone, ticks = 5, height = 8 }: { value: number; max: number; tone?: Tone; ticks?: number; height?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="relative w-full rounded-full bg-sunken overflow-hidden" style={{ height }}>
      <div className="h-full viz-grow-x rounded-full" style={{ width: `${pct}%`, background: toneColor(tone) }} />
      {Array.from({ length: ticks - 1 }, (_, i) => (
        <span key={i} className="absolute top-0 bottom-0 w-px bg-white/70" style={{ left: `${((i + 1) / ticks) * 100}%` }} />
      ))}
    </div>
  );
}

/* ---------- Fase-stepper ---------- */

export function PhaseStepper({ phases, current, labels }: { phases: readonly string[]; current: string; labels: (p: string) => string }) {
  const idx = phases.indexOf(current);
  return (
    <ol className="flex items-center w-full">
      {phases.map((p, i) => {
        const done = i < idx;
        const active = i === idx;
        return (
          <li key={p} className="flex items-center flex-1 min-w-0 last:flex-none">
            <div className="flex flex-col items-center gap-1 min-w-0">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-colors ${
                  active ? "bg-cobalt border-cobalt text-white viz-pulse" : done ? "bg-navy border-navy text-white" : "bg-elev border-line-strong text-faint"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className={`text-[9.5px] tracking-wide font-semibold truncate max-w-[72px] ${active ? "text-cobalt" : done ? "text-navy" : "text-faint"}`}>{labels(p)}</span>
            </div>
            {i < phases.length - 1 && <div className={`h-0.5 flex-1 mx-1 mb-4 ${i < idx ? "bg-navy" : "bg-line"}`} />}
          </li>
        );
      })}
    </ol>
  );
}
