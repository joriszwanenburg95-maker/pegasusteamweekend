"use client";

/**
 * Bob-risico-index — ludieke mascotte-visuals.
 * De keytar-Bob (public/bob-keytar.jpg) is het gezicht van de KPI: hoe hoger het risico,
 * hoe wilder Bob beweegt. Puur presentatie; de score komt uit src/lib/engine/bobRisk.ts.
 * Animaties staan in globals.css (.bob-*) en respecteren prefers-reduced-motion.
 */

import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowRight, Music } from "lucide-react";
import type { BobRiskIndex } from "@/lib/engine";
import { Badge, type Tone } from "@/components/ui";
import { toneColor, useCountUp } from "@/components/viz";
import { nl } from "@/lib/labels";

export const BOB_IMAGE = "/bob-keytar.jpg";
export const BOB_ALT = "Bob op het podium met een rode keytar";

type Level = BobRiskIndex["level"];

const RANK: Record<Level, number> = { NEGLIGIBLE: 0, MODERATE: 1, ELEVATED: 2, SEVERE: 3, CATASTROPHIC: 4 };

/** Hoger = risicovoller: de Bob-index draait de kleurschaal om. */
export function toneForBobLevel(level: Level | string): Tone {
  if (level === "NEGLIGIBLE") return "go";
  if (level === "MODERATE" || level === "ELEVATED") return "warn";
  return "nogo";
}

export function bobRank(level: Level): number {
  return RANK[level];
}

/** Ludieke duiding per niveau; de cijfers zelf blijven leidend. */
export const BOB_COPY: Record<Level, { headline: string; sub: string; badge: string }> = {
  NEGLIGIBLE: {
    headline: "Bob staat rustig aan de bar.",
    sub: "Plan klopt. De keytar blijft in de koffer.",
    badge: "STATUS",
  },
  MODERATE: {
    headline: "Bob stemt de keytar.",
    sub: "Enkele open punten. Nog geen reden voor een solo.",
    badge: "STATUS",
  },
  ELEVATED: {
    headline: "Bob staat al op het podium.",
    sub: "Verhoogd risico: los de zwaarste factor op vóór T-72 uur.",
    badge: "LET OP",
  },
  SEVERE: {
    headline: "Bob speelt. Op de tafel.",
    sub: "Ernstig: één Bob is genoeg, dit worden er meer.",
    badge: "BOB-ALARM",
  },
  CATASTROPHIC: {
    headline: "Volledige Bob-escalatie.",
    sub: "Catastrofaal: dit weekend organiseert zichzelf, en dat merk je.",
    badge: "CODE ROOD",
  },
};

function motionClass(level: Level): string {
  switch (level) {
    case "NEGLIGIBLE":
      return "bob-calm";
    case "MODERATE":
      return "bob-sway";
    case "ELEVATED":
      return "bob-wobble";
    case "SEVERE":
      return "bob-shake";
    case "CATASTROPHIC":
      return "bob-panic";
  }
}

function ringClass(level: Level): string {
  if (RANK[level] >= RANK.SEVERE) return "bob-ring-alarm";
  if (level === "ELEVATED") return "bob-ring-warn";
  return "";
}

/* ---------- Gauge met Bob in het midden ---------- */

export function BobGauge({
  bob,
  size = 120,
  stroke = 9,
  track = "var(--bg-sunken)",
  showLevel = true,
  className = "",
}: {
  bob: BobRiskIndex;
  size?: number;
  stroke?: number;
  track?: string;
  showLevel?: boolean;
  className?: string;
}) {
  const tone = toneForBobLevel(bob.level);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, bob.score / 100));
  const shown = useCountUp(bob.score);
  const severe = RANK[bob.level] >= RANK.SEVERE;
  const pill = Math.max(18, Math.round(size * 0.2));

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size + pill / 2 + (showLevel ? 16 : 0) }}
      title={`${bob.primaryDriver} — ${bob.tooltip}`}
    >
      <div className={`absolute top-0 left-0 rounded-full ${ringClass(bob.level)}`} style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90 block">
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
        <div className={`absolute rounded-full overflow-hidden bg-navy ${motionClass(bob.level)}`} style={{ inset: stroke + 3 }}>
          <Image src={BOB_IMAGE} alt={BOB_ALT} fill sizes={`${size}px`} className="object-cover" />
          {severe && <div className="absolute inset-0 bg-nogo bob-flash pointer-events-none" aria-hidden />}
        </div>
      </div>
      <div
        className="absolute left-1/2 -translate-x-1/2 erp-mono font-bold text-white rounded-full border-2 border-elev flex items-center justify-center shadow-sm"
        style={{
          top: size - pill / 2,
          minWidth: pill * 1.6,
          height: pill,
          fontSize: pill * 0.6,
          padding: "0 6px",
          background: toneColor(tone),
        }}
      >
        {shown.toFixed(0)}
      </div>
      {showLevel && (
        <div className="absolute left-0 right-0 text-center erp-label" style={{ top: size + pill / 2 + 3, fontSize: Math.max(8, size * 0.075) }}>
          {nl(bob.level)}
        </div>
      )}
    </div>
  );
}

/* ---------- Mini-avatar voor tabellen ---------- */

export function BobAvatar({ bob, size = 26, className = "" }: { bob: BobRiskIndex; size?: number; className?: string }) {
  const tone = toneForBobLevel(bob.level);
  const wild = RANK[bob.level] >= RANK.SEVERE ? "bob-shake" : bob.level === "ELEVATED" ? "bob-wobble" : "";
  return (
    <span
      className={`relative inline-block rounded-full overflow-hidden shrink-0 align-middle ${wild} ${className}`}
      style={{ width: size, height: size, boxShadow: `0 0 0 2px ${toneColor(tone)}` }}
      title={`${nl(bob.level)} · ${bob.primaryDriver}`}
    >
      <Image src={BOB_IMAGE} alt={BOB_ALT} fill sizes={`${size}px`} className="object-cover" />
    </span>
  );
}

/* ---------- Statusbalk / alarm voor de homepage ---------- */

export function BobAlarm({ bob, href, className = "" }: { bob: BobRiskIndex; href?: string; className?: string }) {
  const level = bob.level;
  const rank = RANK[level];
  const elevated = rank >= RANK.ELEVATED;
  const severe = rank >= RANK.SEVERE;
  const tone = toneForBobLevel(level);
  const copy = BOB_COPY[level];
  const risers = bob.drivers.filter((d) => d.points > 0).sort((a, b) => b.points - a.points);
  const border = severe ? "border-nogo" : elevated ? "border-warn" : "border-line";

  return (
    <section
      className={`card overflow-hidden ${border} ${className}`}
      role={severe ? "alert" : "status"}
      aria-label={`Bob-risico-index ${bob.score}, ${nl(level)}`}
    >
      {elevated && <div className={`h-2 ${severe ? "bob-tape-alarm" : "bob-tape"}`} aria-hidden />}
      <div className="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3">
        <BobGauge bob={bob} size={64} stroke={6} showLevel={false} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="erp-label">Bob-risico-index</span>
            <Badge tone={tone} className={severe ? "bob-blink" : ""}>
              {severe ? <AlertTriangle size={11} /> : <Music size={11} />}
              {copy.badge} · {nl(level)}
            </Badge>
          </div>
          <div className="font-extrabold text-navy tracking-tight text-sm sm:text-base leading-tight mt-0.5">{copy.headline}</div>
          <div className="text-[12px] text-muted leading-snug mt-0.5">
            {copy.sub}{" "}
            <span className="text-fg">
              Zwaarste factor: <span className="font-semibold">{bob.primaryDriver}</span>
            </span>
          </div>
        </div>
        {href && (
          <Link href={href} className={`btn btn-sm shrink-0 ${severe ? "btn-danger" : ""}`}>
            Poort <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {elevated && risers.length > 0 && (
        <div className="bob-ticker-wrap border-t border-line bg-sunken py-1 text-[11px] erp-mono text-fg">
          <div className="bob-ticker">
            {[...risers, ...risers].map((d, i) => (
              <span key={`${d.label}-${i}`} className="inline-flex items-center gap-1.5 px-4">
                <AlertTriangle size={11} className={severe ? "text-nogo" : "text-warn"} />
                {d.label}
                <span className={`font-semibold ${severe ? "text-nogo" : "text-warn"}`}>+{d.points}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
