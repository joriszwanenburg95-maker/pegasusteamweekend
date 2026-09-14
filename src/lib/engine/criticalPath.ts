import type { PathCategory, PathStep, Weekend } from "../types";
import { addMinutes, isoToClock } from "./time";

export interface PathAnalysis {
  steps: (PathStep & { startAt: string; endAt: string; cumulativeMin: number })[];
  totalMin: number;
  byCategory: Record<PathCategory, number>;
  /** Minuten van MATCH END tot FIRST BEER (eerste stap met categorie 'bzt'). */
  minutesToFirstBeer: number | null;
  firstBeerAt: string | null;
  transfers: number;
  optimizations: Optimization[];
}

export interface Optimization {
  stepId: string;
  label: string;
  savesMin: number;
  detail: string;
}

export const CATEGORY_LABEL: Record<PathCategory, string> = {
  valueAdding: "VALUE ADDING",
  bzt: "BZT",
  logistics: "NECESSARY LOGISTICS",
  waste: "PURE WASTE",
};

export function analyzeCriticalPath(w: Weekend): PathAnalysis {
  const start = w.match.matchEnd;
  let cursor = start;
  let cumulative = 0;
  const byCategory: Record<PathCategory, number> = {
    valueAdding: 0,
    bzt: 0,
    logistics: 0,
    waste: 0,
  };
  let minutesToFirstBeer: number | null = null;
  let firstBeerAt: string | null = null;
  let transfers = 0;
  const optimizations: Optimization[] = [];

  const steps = w.criticalPath.map((s) => {
    const startAt = cursor;
    const endAt = addMinutes(cursor, s.durationMin);
    if (s.category === "bzt" && minutesToFirstBeer === null) {
      minutesToFirstBeer = cumulative;
      firstBeerAt = startAt;
    }
    cumulative += s.durationMin;
    byCategory[s.category] += s.durationMin;
    if (s.isTransfer) transfers += 1;
    if (s.optional && s.durationMin > 0 && s.category !== "bzt") {
      optimizations.push({
        stepId: s.id,
        label: s.label,
        savesMin: s.durationMin,
        detail:
          s.optimizationHint ??
          `Skipping “${s.label}” saves ${s.durationMin} minutes of team time.`,
      });
    } else if (s.category === "waste" && s.durationMin > 0) {
      optimizations.push({
        stepId: s.id,
        label: s.label,
        savesMin: s.durationMin,
        detail: s.optimizationHint ?? `“${s.label}” is pure waste: ${s.durationMin} minutes without value.`,
      });
    }
    cursor = endAt;
    return { ...s, startAt, endAt, cumulativeMin: cumulative };
  });

  optimizations.sort((a, b) => b.savesMin - a.savesMin);

  return {
    steps,
    totalMin: cumulative,
    byCategory,
    minutesToFirstBeer,
    firstBeerAt,
    transfers,
    optimizations,
  };
}

export function firstBeerClock(w: Weekend): string | null {
  const a = analyzeCriticalPath(w);
  return a.firstBeerAt ? isoToClock(a.firstBeerAt) : null;
}
