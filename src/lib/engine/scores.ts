import type { OperationalInput, OutcomeInput, Retrospective, Weekend } from "../types";
import { groupSplitRisk } from "./groupSplit";

export interface OperationalQuality {
  score: number; // 0-100
  deductions: { label: string; points: number }[];
}

export interface WeekendOutcome {
  score: number; // 0-10, één decimaal
  parts: { label: string; value: number }[];
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function operationalQuality(input: OperationalInput, w?: Weekend): OperationalQuality {
  const d: { label: string; points: number }[] = [];
  const add = (label: string, points: number) => {
    if (points > 0) d.push({ label, points: Math.round(points) });
  };
  add("Last-minute decisions", clamp(input.lastMinuteDecisions * 4, 0, 20));
  add("Unresolved items at departure", clamp(input.unresolvedAtDeparture * 5, 0, 25));
  add("Unnecessary travel time", clamp(input.unnecessaryTravelMin / 10, 0, 10));
  add("Waiting", clamp(input.waitingMin / 10, 0, 8));
  add("Group splits", clamp(input.groupSplits * 4, 0, 12));
  add("Reservation problems", clamp(input.reservationIssues * 5, 0, 10));
  add("Transport problems", clamp(input.transportIssues * 4, 0, 8));
  add("BZT loss", clamp(input.bztLossMin / 15, 0, 10));
  add("Overrides", clamp(input.overrides * 3, 0, 9));
  if (w) {
    const split = groupSplitRisk(w);
    if (split.level === "HIGH") add("Planned Group Split Risk HIGH", 5);
    if (split.level === "CRITICAL") add("Planned Group Split Risk CRITICAL", 10);
  }
  const score = clamp(100 - d.reduce((s, x) => s + x.points, 0), 0, 100);
  return { score, deductions: d.sort((a, b) => b.points - a.points) };
}

export function weekendOutcome(input: OutcomeInput): WeekendOutcome {
  const parts = [
    { label: "Gezelligheid", value: input.gezelligheid, w: 2 },
    { label: "Gerealiseerde BZT", value: input.realizedBzt, w: 1.5 },
    { label: "Locatie", value: input.location, w: 1 },
    { label: "Avond", value: input.evening, w: 1.5 },
    { label: "Accommodatie", value: input.accommodation, w: 1 },
    { label: "Activiteit", value: input.activity, w: 1 },
    { label: "Algemeen", value: input.overall, w: 2 },
  ];
  const wsum = parts.reduce((s, p) => s + p.w, 0);
  const score = Math.round((parts.reduce((s, p) => s + p.value * p.w, 0) / wsum) * 10) / 10;
  return { score, parts: parts.map(({ label, value }) => ({ label, value })) };
}

export function classify(outcome: number, ops: number): string {
  const goodOutcome = outcome >= 7.5;
  const goodOps = ops >= 70;
  if (goodOutcome && goodOps) return "Solid process. Solid result.";
  if (goodOutcome && !goodOps) return "Questionable process. Acceptable result.";
  if (!goodOutcome && goodOps) return "Solid process. Disappointing result. Investigate external factors.";
  return "Questionable process. Disappointing result. Full retrospective required.";
}

export function retrospectiveScores(r: Retrospective, w?: Weekend) {
  const ops = operationalQuality(r.operational, w);
  const out = weekendOutcome(r.outcome);
  return { ops, out, classification: classify(out.score, ops.score) };
}
