import type { Weekend } from "../types";
import { clockSpanMinutes, parseClock } from "./time";

export type CheckStatus = "PASS" | "WARNING" | "FAIL" | "UNKNOWN";

export interface FoodAssessment {
  status: CheckStatus;
  headline: string;
  issues: string[];
  /** Minuten tussen geplande dinertijd en keukensluiting. */
  kitchenBufferMin: number | null;
}

export function assessFood(w: Weekend): FoodAssessment {
  const d = w.dinner;
  const issues: string[] = [];
  const eaters = w.participants.filter((p) => p.dinner === "going").length;

  if (!d.known || !d.location.trim()) {
    return {
      status: "FAIL",
      headline: "“Wat eten we eigenlijk?” staat nog open.",
      issues: [
        "Geen dinerlocatie vastgelegd. Dit is een ernstige readiness warning: zaterdagavond ter plaatse eten zoeken kost BZT en splitst de groep.",
      ],
      kitchenBufferMin: null,
    };
  }

  const kitchenBufferMin =
    d.time && d.kitchenClosesAt ? clockSpanMinutes(d.time, d.kitchenClosesAt) : null;

  if (!d.reserved) issues.push("Niet gereserveerd. Bij een late poging kan het restaurant vol zijn (zie Maaseik).");
  if (d.reserved && d.reservedCount < eaters)
    issues.push(`Gereserveerd voor ${d.reservedCount}, ${eaters} bevestigde eters.`);
  if (parseClock(d.time) === null) issues.push("Geen dinertijd vastgelegd.");
  if (kitchenBufferMin !== null && kitchenBufferMin < 45)
    issues.push(`Keuken sluit ${kitchenBufferMin} minuten na aankomst: krap.`);
  if (kitchenBufferMin !== null && kitchenBufferMin > 12 * 60)
    issues.push("Keukensluiting lijkt vóór de dinertijd te liggen; controleer tijden.");
  if (d.travelMin > 30) issues.push(`${d.travelMin} minuten reistijd naar het eten: transfer op het critical path.`);
  if (!d.fallback.trim()) issues.push("Geen fallback wanneer de locatie vol/gesloten blijkt.");

  const hard = issues.some(
    (i) => i.startsWith("Niet gereserveerd") || i.startsWith("Gereserveerd voor"),
  );
  const status: CheckStatus = hard ? "WARNING" : issues.length ? "WARNING" : "PASS";

  return {
    status: !d.reserved && eaters > 8 ? "FAIL" : status,
    headline: d.reserved
      ? `${d.location} · ${d.time} · ${d.reservedCount} pers.`
      : `${d.location} · niet gereserveerd`,
    issues,
    kitchenBufferMin,
  };
}
