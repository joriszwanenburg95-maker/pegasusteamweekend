import type { Weekend } from "../types";
import { analyzeCriticalPath } from "./criticalPath";
import { groupSplitRisk } from "./groupSplit";
import { primaryNightlife } from "./nightlife";
import { clockSpanMinutes, isoToClock } from "./time";

/**
 * BZT — Bier Zuip Tijd:
 * de tijd waarin het team daadwerkelijk gezamenlijk kan zijn met een biertje,
 * van EERSTE BIER tot het moment dat de primaire locatie sluit,
 * gecorrigeerd voor Group Split Risk.
 */
export interface BztEstimate {
  /** Bruto minuten van first beer tot sluiting primaire locatie. */
  grossMin: number;
  /** Aftrek door Group Split Risk. */
  splitPenaltyMin: number;
  /** Netto verwachte BZT. */
  netMin: number;
  firstBeerClock: string | null;
  closesAt: string | null;
  detail: string;
}

export function estimateBzt(w: Weekend): BztEstimate {
  const path = analyzeCriticalPath(w);
  const n = primaryNightlife(w);
  const split = groupSplitRisk(w);
  const firstBeer = path.firstBeerAt ? isoToClock(path.firstBeerAt) : null;

  if (!n || !firstBeer) {
    return {
      grossMin: 0,
      splitPenaltyMin: 0,
      netMin: 0,
      firstBeerClock: firstBeer,
      closesAt: n?.closesAt ?? null,
      detail: !n ? "Geen primaire avondlocatie." : "Geen EERSTE BIER op het kritieke pad.",
    };
  }
  // BZT telt vanaf EERSTE BIER tot sluiting; een sluiting vóór het eerste bier (span > 14u) telt als 0.
  const span = clockSpanMinutes(firstBeer, n.closesAt) ?? 0;
  const grossMin = span > 14 * 60 ? 0 : Math.min(span, 9 * 60);
  const splitPenaltyMin = Math.round(grossMin * split.bztPenaltyFactor);
  return {
    grossMin,
    splitPenaltyMin,
    netMin: grossMin - splitPenaltyMin,
    firstBeerClock: firstBeer,
    closesAt: n.closesAt,
    detail: `Eerste bier ${firstBeer}, ${n.name} sluit ${n.closesAt}. Groepssplitsingsrisico ${split.level} kost ${splitPenaltyMin} min.`,
  };
}
