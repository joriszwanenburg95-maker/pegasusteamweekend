import type { Weekend } from "../types";
import { headcount } from "./headcount";
import { primaryNightlife } from "./nightlife";
import { assessTransport } from "./transport";
import { hoursBetween } from "./time";
import { chipsGuardStatus } from "./lessons";

/**
 * BOB RISK INDEX — puur ludieke secundaire KPI (0-100).
 * Uitsluitend gebaseerd op echte planningdata. Nooit gebruiken voor GO/NO GO.
 * Tooltip: “Eén Bob is genoeg.”
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
    drivers.push({ label: "Accommodatie vereist dat deelnemers zelf een slaapplek meenemen.", points: 25 });
  if (!a.ownShelterRequired && a.bedsProvided < hc.overnight.going)
    drivers.push({ label: "Niet iedereen heeft een echt bed.", points: 12 });
  if (!w.dinner.known || !w.dinner.location)
    drivers.push({ label: "Eten is nog onbekend.", points: 18 });
  else if (!w.dinner.reserved) drivers.push({ label: "Eten niet gereserveerd.", points: 8 });
  if (!hc.locked) drivers.push({ label: "Deelnemersaantal niet vergrendeld.", points: 12 });
  if (!n) drivers.push({ label: "Avondbestemming onbekend.", points: 18 });
  else {
    if (n.taxiRequired && !n.taxiArranged) drivers.push({ label: "Taxi nodig maar niet geregeld.", points: 14 });
    if (n.distanceKm >= 15) drivers.push({ label: "Avondprogramma ligt op grote afstand.", points: 8 });
  }
  if (w.sunday.relevant && w.sunday.travelFromAccommodationMin > 30)
    drivers.push({ label: "Zondagactiviteit op aanzienlijke afstand.", points: 5 });
  const lastMinute = w.decisions.filter((d) => {
    const h = hoursBetween(d.at, w.departureAt);
    return h >= 0 && h < 24;
  }).length;
  if (lastMinute > 0) drivers.push({ label: `${lastMinute} planwijziging(en) binnen 24 uur voor vertrek.`, points: Math.min(20, lastMinute * 7) });
  const hoursToDeparture = hoursBetween(nowIso, w.departureAt);
  if (hoursToDeparture >= 0 && hoursToDeparture < 24 && !w.planFinalAt)
    drivers.push({ label: "Minder dan 24 uur tot vertrek en het plan is nog niet definitief.", points: 10 });
  // Les Maaseik: onbewaakte chips van Rik verdwijnen. Checklistpunt open = risico.
  const chips = chipsGuardStatus(w);
  if (chips === "open") drivers.push({ label: "Chips van Rik nog onbewaakt (les Maaseik).", points: 6 });

  // Verlagend
  if (a.confirmed && (a.type === "hotel" || a.type === "hostel" || a.type === "holidayHome"))
    drivers.push({ label: "Hotel/hostel/vakantiehuis bevestigd.", points: -15 });
  if (w.dinner.known && w.dinner.reserved) drivers.push({ label: "Eten gereserveerd.", points: -10 });
  if (n && !n.transportRequired && n.walkMin <= 15) drivers.push({ label: "Kroeg op loopafstand.", points: -10 });
  if (hc.weekend.unknown === 0 && hc.total > 0) drivers.push({ label: "Deelnemers bekend.", points: -6 });
  if (t.status === "PASS") drivers.push({ label: "Vervoer sluit.", points: -10 });
  if (w.planFinalAt && hoursBetween(w.planFinalAt, w.departureAt) > 72)
    drivers.push({ label: "Plan meer dan 72 uur vooraf compleet.", points: -12 });
  if (chips === "done") drivers.push({ label: "Chips van Rik onder bewaking.", points: -3 });

  const base = 35;
  const score = Math.max(0, Math.min(100, base + drivers.reduce((s, d) => s + d.points, 0)));
  const level: BobRiskIndex["level"] =
    score >= 90 ? "CATASTROPHIC" : score >= 70 ? "SEVERE" : score >= 50 ? "ELEVATED" : score >= 25 ? "MODERATE" : "NEGLIGIBLE";
  const positive = drivers.filter((d) => d.points > 0).sort((a, b) => b.points - a.points);
  const negative = drivers.filter((d) => d.points < 0).sort((a, b) => a.points - b.points);
  const primaryDriver = positive[0]?.label ?? negative[0]?.label ?? "Nog geen planningdata.";
  return { score, level, drivers, primaryDriver, tooltip: "Eén Bob is genoeg." };
}
