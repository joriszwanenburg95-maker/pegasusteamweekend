import type { Weekend } from "../types";
import { primaryNightlife } from "./nightlife";
import { assessTransport } from "./transport";

export type SplitRisk = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface GroupSplitAssessment {
  level: SplitRisk;
  reason: string;
  /** Aftrek (0-1) toegepast op BZT en Operational Quality. */
  bztPenaltyFactor: number;
  factors: string[];
}

const PENALTY: Record<SplitRisk, number> = {
  LOW: 0,
  MEDIUM: 0.1,
  HIGH: 0.25,
  CRITICAL: 0.45,
};

export function groupSplitRisk(w: Weekend): GroupSplitAssessment {
  const n = primaryNightlife(w);
  const t = assessTransport(w);
  const factors: string[] = [];
  const groupSize = w.participants.filter((p) => p.weekend === "going").length;

  if (!n) {
    return {
      level: "CRITICAL",
      reason: "Geen avondbestemming: niemand weet waar de groep heen gaat, laat staan hoe men terugkomt.",
      bztPenaltyFactor: PENALTY.CRITICAL,
      factors: ["Geen avondbestemming"],
    };
  }

  let level: SplitRisk = "LOW";
  if (!n.transportRequired) {
    factors.push("Iedereen kan lopen.");
  } else if (n.taxiRequired) {
    const taxisNeeded = Math.ceil(groupSize / 4);
    factors.push(`${taxisNeeded} taxi's nodig voor ${groupSize} personen.`);
    if (n.taxiArranged) {
      level = "HIGH";
      factors.push("Taxi's vooraf gereserveerd, maar meerdere ritten blijven een splitsingsmoment.");
    } else {
      level = "CRITICAL";
      factors.push("Taxi's niet vooraf gereserveerd.");
    }
  } else {
    // Auto's nodig; chauffeurs drinken niet → vast plan?
    const carsNeeded = Math.max(1, Math.ceil(groupSize / 4));
    factors.push(`${carsNeeded} auto('s) nodig incl. Bob(s).`);
    level = t.status === "PASS" ? "MEDIUM" : "HIGH";
    if (t.status !== "PASS") factors.push("Vervoersplanning ligt niet vast.");
    else factors.push("Planning ligt vast.");
  }

  if (n.transfers >= 3 && level !== "CRITICAL") {
    level = level === "LOW" ? "MEDIUM" : "HIGH";
    factors.push(`${n.transfers} transfers op één avond.`);
  }
  if (!n.suitableLargeGroup && n.groupCapacity < groupSize) {
    if (level === "LOW") level = "MEDIUM";
    factors.push("Locatie kan de hele groep niet aan; kans dat het team uiteenvalt.");
  }

  const reasonMap: Record<SplitRisk, string> = {
    LOW: "Iedereen kan lopen; het team blijft samen.",
    MEDIUM: "Vervoer nodig, maar de planning ligt vast.",
    HIGH: "Meerdere ritten of transfers nodig; splitsing waarschijnlijk.",
    CRITICAL: "Niemand weet hoe men terugkomt.",
  };

  return { level, reason: reasonMap[level], bztPenaltyFactor: PENALTY[level], factors };
}
