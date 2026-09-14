"use client";

import type { ReactNode } from "react";
import { Tent, Trophy, Users, Bus, PartyPopper, CalendarOff, CircleDashed, Dumbbell } from "lucide-react";
import type { SeasonEvent, SeasonEventKind } from "@/lib/types";
import { nl } from "@/lib/labels";

/* ---------- Chauffeurschips: vaste kleur per naam, zoals in het rijschema (Excel) ---------- */

const DRIVER_PALETTE: { bg: string; fg: string }[] = [
  { bg: "#dbeafe", fg: "#1e3a8a" }, // blauw
  { bg: "#fde68a", fg: "#78350f" }, // geel
  { bg: "#bbf7d0", fg: "#14532d" }, // groen
  { bg: "#fecaca", fg: "#7f1d1d" }, // rood
  { bg: "#fed7aa", fg: "#7c2d12" }, // oranje
  { bg: "#e9d5ff", fg: "#581c87" }, // paars
  { bg: "#bae6fd", fg: "#0c4a6e" }, // lichtblauw
  { bg: "#d9f99d", fg: "#365314" }, // lime
  { bg: "#fbcfe8", fg: "#831843" }, // roze
  { bg: "#99f6e4", fg: "#134e4a" }, // teal
  { bg: "#e2e8f0", fg: "#1e293b" }, // grijs
  { bg: "#c7d2fe", fg: "#312e81" }, // indigo
  { bg: "#fef3c7", fg: "#92400e" }, // amber
  { bg: "#ddd6fe", fg: "#4c1d95" }, // violet
];

/** Vaste kleuren voor de bekende namen uit het rijschema; overige namen via hash. */
const FIXED: Record<string, number> = {
  senna: 7,
  henk: 10,
  dean: 4,
  job: 4,
  wouter: 2,
  joris: 3,
  rik: 12,
  boaz: 6,
  matta: 8,
  dicky: 0,
  pep: 5,
  pepijn: 5,
  koen: 1,
  pim: 9,
};

export function driverColor(name: string): { bg: string; fg: string } {
  const key = name.trim().toLowerCase();
  if (key in FIXED) return DRIVER_PALETTE[FIXED[key]];
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return DRIVER_PALETTE[h % DRIVER_PALETTE.length];
}

export function DriverChip({ name, size = "md", title }: { name: string; size?: "sm" | "md"; title?: string }) {
  const c = driverColor(name);
  return (
    <span
      title={title ?? name}
      className={`inline-flex items-center rounded-[4px] font-semibold whitespace-nowrap ${size === "sm" ? "px-1.5 py-0 text-[10.5px]" : "px-2 py-0.5 text-[12px]"}`}
      style={{ background: c.bg, color: c.fg }}
    >
      {name}
    </span>
  );
}

/* ---------- Soorten kalenderitems ---------- */

export interface KindStyle {
  /** Klassen voor de pil in de kalender en de tabel. */
  chip: string;
  /** Kleine kleurstip. */
  dot: string;
  icon: (size: number) => ReactNode;
}

export const KIND_STYLE: Record<SeasonEventKind, KindStyle> = {
  competition: { chip: "bg-navy text-white border-navy", dot: "bg-navy", icon: (s) => <Trophy size={s} /> },
  cup: { chip: "bg-sky text-navy border-sky", dot: "bg-sky", icon: (s) => <Trophy size={s} /> },
  friendly: { chip: "bg-elev text-navy border-navy/40", dot: "bg-navy/40", icon: (s) => <Dumbbell size={s} /> },
  tournament: { chip: "bg-elev text-navy border-navy/40", dot: "bg-navy/40", icon: (s) => <Users size={s} /> },
  playoff: { chip: "bg-navy-2 text-white border-navy-2", dot: "bg-navy-2", icon: (s) => <Trophy size={s} /> },
  reserve: { chip: "bg-elev text-faint border-line-strong border-dashed", dot: "bg-line-strong", icon: (s) => <CircleDashed size={s} /> },
  teamweekend: { chip: "bg-cobalt text-white border-cobalt", dot: "bg-cobalt", icon: (s) => <Tent size={s} /> },
  meeting: { chip: "bg-sunken text-muted border-line", dot: "bg-faint", icon: (s) => <Bus size={s} /> },
  holiday: { chip: "bg-sunken text-faint border-line", dot: "bg-line-strong", icon: (s) => <CalendarOff size={s} /> },
  other: { chip: "bg-sunken text-muted border-line", dot: "bg-faint", icon: (s) => <PartyPopper size={s} /> },
};

/** Korte tekst voor een kalenderpil. */
export function eventShortLabel(ev: SeasonEvent): string {
  if (ev.kind === "competition") {
    const round = ev.title.replace(/^Ronde\s+/i, "R");
    return ev.opponent || `${round} · thuis`;
  }
  if (ev.kind === "cup") return ev.opponent || ev.title.replace(/^Beker\s+/i, "Beker ");
  return ev.opponent || ev.title;
}

export function eventFullLabel(ev: SeasonEvent): string {
  return ev.opponent ? `${ev.title} · ${ev.opponent}` : ev.title;
}

export function KindBadge({ kind, isHome, className = "" }: { kind: SeasonEventKind; isHome?: boolean; className?: string }) {
  const st = KIND_STYLE[kind];
  const match = kind === "competition" || kind === "cup" || kind === "friendly" || kind === "tournament" || kind === "playoff";
  return (
    <span className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[10.5px] font-bold tracking-[0.08em] uppercase whitespace-nowrap ${st.chip} ${className}`}>
      {st.icon(11)}
      {nl(kind)}
      {match && isHome !== undefined && <span className="opacity-70">· {isHome ? "thuis" : "uit"}</span>}
    </span>
  );
}

export function EventPill({ ev, onClick, compact = false }: { ev: SeasonEvent; onClick?: () => void; compact?: boolean }) {
  const st = KIND_STYLE[ev.kind];
  const outlined = ev.kind === "competition" && ev.isHome;
  return (
    <button
      type="button"
      onClick={onClick}
      title={eventFullLabel(ev)}
      className={`cal-pill w-full text-left rounded-[3px] border leading-tight truncate ${outlined ? "bg-elev text-navy border-navy" : st.chip} ${compact ? "px-1 py-[1px] text-[9.5px]" : "px-1.5 py-0.5 text-[10.5px]"} font-semibold`}
    >
      {eventShortLabel(ev)}
    </button>
  );
}
