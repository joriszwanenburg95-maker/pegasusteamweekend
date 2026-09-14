import type { Weekend } from "../types";
import { headcount } from "./headcount";
import { primaryNightlife } from "./nightlife";
import { assessTransport } from "./transport";
import { hoursBetween } from "./time";

/**
 * BOB RISK INDEX — puur ludieke secundaire KPI (0-100).
 * Uitsluitend gebaseerd op echte planningdata. Nooit gebruiken voor GO/NO GO.
 * Tooltip: “One Bob is enough.”
 */
export interface BobRiskDriver {
  label: string;
  points: number; // + verhoogt risico, - verlaagt
}

export interface BobRiskIndex {
  score: number;
  level: "NEGLIGIBLE" | "MODERATE" | "ELEVATED" | "SEVERE" | "CATASTROPHIC";
  drivers: BobRiskDriver[];
  primaryDriver: string;
  tooltip: string;
}

export function bobRiskIndex(w: Weekend, nowIso: string): BobRiskIndex {
  const drivers: BobRiskDriver[] = [];
  const hc = headcount(w);
  const t = assessTransport(w);
  const n = primaryNightlife(w);
  const a = w.accommodation;

  // Verhogend
  if (a.ownShelterRequired || a.type === "camping")
    drivers.push({ label: "Accommodation requires participants to provide their own shelter.", points: 25 });
  if (!a.ownShelterRequired && a.bedsProvided < hc.overnight.going)
    drivers.push({ label: "Not everyone has an actual bed.", points: 12 });
  if (!w.dinner.known || !w.dinner.location)
    drivers.push({ label: "Dinner is still unknown.", points: 18 });
  else if (!w.dinner.reserved) drivers.push({ label: "Dinner not reserved.", points: 8 });
  if (!hc.locked) drivers.push({ label: "Headcount not locked.", points: 12 });
  if (!n) drivers.push({ label: "Nightlife destination unknown.", points: 18 });
  else {
    if (n.taxiRequired && !n.taxiArranged) drivers.push({ label: "Taxi required but not arranged.", points: 14 });
    if (n.distanceKm >= 15) drivers.push({ label: "Evening programme is far away.", points: 8 });
  }
  if (w.sunday.relevant && w.sunday.travelFromAccommodationMin > 30)
    drivers.push({ label: "Sunday activity at considerable distance.", points: 5 });
  const lastMinute = w.decisions.filter((d) => {
    const h = hoursBetween(d.at, w.departureAt);
    return h >= 0 && h < 24;
  }).length;
  if (lastMinute > 0) drivers.push({ label: `${lastMinute} plan change(s) within 24h of departure.`, points: Math.min(20, lastMinute * 7) });
  const hoursToDeparture = hoursBetween(nowIso, w.departureAt);
  if (hoursToDeparture >= 0 && hoursToDeparture < 24 && !w.planFinalAt)
    drivers.push({ label: "Less than 24h to departure and the plan is still not final.", points: 10 });

  // Verlagend
  if (a.confirmed && (a.type === "hotel" || a.type === "hostel" || a.type === "holidayHome"))
    drivers.push({ label: "Hotel/hostel/holiday home confirmed.", points: -15 });
  if (w.dinner.known && w.dinner.reserved) drivers.push({ label: "Dinner reserved.", points: -10 });
  if (n && !n.transportRequired && n.walkMin <= 15) drivers.push({ label: "Pub within walking distance.", points: -10 });
  if (hc.weekend.unknown === 0 && hc.total > 0) drivers.push({ label: "Participants known.", points: -6 });
  if (t.status === "PASS") drivers.push({ label: "Transport closes.", points: -10 });
  if (w.planFinalAt && hoursBetween(w.planFinalAt, w.departureAt) > 72)
    drivers.push({ label: "Plan complete >72h before departure.", points: -12 });

  const base = 35;
  const score = Math.max(0, Math.min(100, base + drivers.reduce((s, d) => s + d.points, 0)));
  const level: BobRiskIndex["level"] =
    score >= 90 ? "CATASTROPHIC" : score >= 70 ? "SEVERE" : score >= 50 ? "ELEVATED" : score >= 25 ? "MODERATE" : "NEGLIGIBLE";
  const positive = drivers.filter((d) => d.points > 0).sort((a, b) => b.points - a.points);
  const negative = drivers.filter((d) => d.points < 0).sort((a, b) => a.points - b.points);
  const primaryDriver = positive[0]?.label ?? negative[0]?.label ?? "No planning data yet.";
  return { score, level, drivers, primaryDriver, tooltip: "One Bob is enough." };
}
