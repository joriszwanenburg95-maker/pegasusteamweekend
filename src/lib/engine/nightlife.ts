import type { LocalEvent, NightlifeDestination, Weekend } from "../types";
import { clockSpanMinutes, parseClock } from "./time";

export interface ViabilityFactor {
  label: string;
  /** Bijdrage aan score (kan negatief). */
  points: number;
  detail: string;
}

export interface NightlifeViability {
  score: number; // 0-100
  grade: "EXCELLENT" | "GOOD" | "MARGINAL" | "POOR" | "UNVIABLE";
  /** BZT-window in minuten: van geschatte aankomst tot sluiting. */
  bztWindowMin: number;
  factors: ViabilityFactor[];
  verdict: string;
}

export interface EveningContext {
  /** Verwachte starttijd van het avondprogramma ("HH:MM"). */
  arrivalClock: string;
  groupSize: number;
}

export function eveningContext(w: Weekend): EveningContext {
  const d = w.dinner;
  const groupSize = w.participants.filter((p) => p.weekend === "going").length;
  const dinnerStart = parseClock(d.time);
  if (d.known && dinnerStart !== null) {
    const end = dinnerStart + (d.durationMin || 90);
    const h = Math.floor(end / 60) % 24;
    const m = end % 60;
    return {
      arrivalClock: `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`,
      groupSize,
    };
  }
  return { arrivalClock: "21:30", groupSize };
}

export function gradeFor(score: number): NightlifeViability["grade"] {
  if (score >= 85) return "EXCELLENT";
  if (score >= 70) return "GOOD";
  if (score >= 50) return "MARGINAL";
  if (score >= 30) return "POOR";
  return "UNVIABLE";
}

export function nightlifeViability(
  n: NightlifeDestination,
  ctx: EveningContext,
): NightlifeViability {
  const factors: ViabilityFactor[] = [];
  let score = 0;

  // 1. BZT-window (max 30)
  const window = clockSpanMinutes(ctx.arrivalClock, n.closesAt) ?? 0;
  const bztWindowMin = window > 14 * 60 ? 0 : window; // sluit vóór aankomst → 0
  let wPts = 0;
  if (bztWindowMin >= 240) wPts = 30;
  else if (bztWindowMin >= 180) wPts = 24;
  else if (bztWindowMin >= 120) wPts = 16;
  else if (bztWindowMin >= 60) wPts = 8;
  score += wPts;
  factors.push({
    label: "BZT-venster",
    points: wPts,
    detail:
      bztWindowMin === 0
        ? `Sluit (${n.closesAt}) vóór of rond aankomst (${ctx.arrivalClock}).`
        : `${Math.round(bztWindowMin / 60 * 10) / 10} uur tussen aankomst ${ctx.arrivalClock} en sluiting ${n.closesAt}.`,
  });

  // 2. Afstand (max 20)
  let dPts = 0;
  if (n.walkMin <= 10 && !n.transportRequired) dPts = 20;
  else if (n.walkMin <= 20 && !n.transportRequired) dPts = 15;
  else if (!n.transportRequired) dPts = 10;
  else if (!n.taxiRequired) dPts = 6;
  else dPts = 2;
  score += dPts;
  factors.push({
    label: "Afstand",
    points: dPts,
    detail: n.transportRequired
      ? `${n.distanceKm} km, vervoer nodig${n.taxiRequired ? " (taxi)" : ""}.`
      : `${n.walkMin} min lopen.`,
  });

  // 3. Transfers (max 10, aftrek per transfer)
  const tPts = Math.max(0, 10 - n.transfers * 4);
  score += tPts;
  factors.push({
    label: "Transfers",
    points: tPts,
    detail: `${n.transfers} verplaatsing(en) heen en terug.`,
  });

  // 4. Sluitingstijd absoluut (max 10)
  const close = parseClock(n.closesAt);
  let cPts = 0;
  if (close !== null) {
    // Na middernacht (00:00-05:00) = laat open
    if (close <= 5 * 60) cPts = 10;
    else if (close >= 23 * 60) cPts = 6;
    else if (close >= 22 * 60) cPts = 3;
  }
  score += cPts;
  factors.push({ label: "Sluitingstijd", points: cPts, detail: `Sluit om ${n.closesAt || "?"}.` });

  // 5. Groep bij elkaar (max 15)
  let gPts = 0;
  if (n.suitableLargeGroup && n.groupCapacity >= ctx.groupSize) gPts = 15;
  else if (n.suitableLargeGroup) gPts = 9;
  else if (n.groupCapacity >= ctx.groupSize) gPts = 7;
  score += gPts;
  factors.push({
    label: "Groep samen",
    points: gPts,
    detail: `Capaciteit ${n.groupCapacity} voor groep van ${ctx.groupSize}${n.suitableLargeGroup ? ", geschikt voor grote groep" : ", niet expliciet groepsgeschikt"}.${n.entrancePolicy ? ` Entree: ${n.entrancePolicy}.` : ""}`,
  });

  // 6. Reservering (max 10, kan negatief)
  let rPts = 0;
  if (!n.reservationNeeded) rPts = 8;
  else if (n.reservationConfirmed) rPts = 10;
  else rPts = -10;
  score += rPts;
  factors.push({
    label: "Reservering",
    points: rPts,
    detail: !n.reservationNeeded
      ? "Geen reservering nodig."
      : n.reservationConfirmed
        ? "Reservering bevestigd."
        : "Reservering nodig maar NIET bevestigd.",
  });

  // 7. Fallback (max 5)
  const fPts = n.fallbackAvailable ? 5 : 0;
  score += fPts;
  factors.push({
    label: "Alternatief",
    points: fPts,
    detail: n.fallbackAvailable ? "Fallback aanwezig." : "Geen fallback.",
  });

  // 8. Taxi niet geregeld → extra aftrek
  if (n.taxiRequired && !n.taxiArranged) {
    score -= 10;
    factors.push({ label: "Taxi", points: -10, detail: "Taxi nodig maar niet vooraf geregeld." });
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  const grade = gradeFor(score);
  const verdict =
    bztWindowMin > 0 && bztWindowMin < 90 && n.walkMin <= 10
      ? "Dichtbij, maar sluit te vroeg. Nabijheid maakt een korte avond niet goed."
      : grade === "EXCELLENT" || grade === "GOOD"
        ? "Werkbaar avondprogramma voor de hele groep."
        : grade === "MARGINAL"
          ? "Kan, maar met duidelijke risico's op BZT-verlies of groepssplitsing."
          : "Niet geschikt als primair avondprogramma zonder aanpassingen.";
  return { score, grade, bztWindowMin, factors, verdict };
}

/** Local event beoordeeld met dezelfde maatstaf als horeca. */
export function eventViability(e: LocalEvent, ctx: EveningContext): NightlifeViability {
  const pseudo: NightlifeDestination = {
    id: e.id,
    name: e.name,
    type: "event",
    address: e.address,
    distanceKm: e.distanceKm,
    walkMin: e.walkMin,
    opensAt: e.opensAt,
    closesAt: e.closesAt,
    kitchenClosesAt: "",
    suitableLargeGroup: e.suitableLargeGroup,
    reservationNeeded: false,
    reservationConfirmed: false,
    groupCapacity: e.suitableLargeGroup ? 999 : 0,
    entrancePolicy: "",
    transportRequired: e.returnTransport !== "walk",
    taxiRequired: e.returnTransport === "taxi",
    taxiArranged: false,
    transfers: e.returnTransport === "walk" ? 0 : 2,
    fallbackAvailable: false,
    isPrimary: false,
  };
  const v = nightlifeViability(pseudo, ctx);
  const extra: ViabilityFactor[] = [];
  let score = v.score;
  if (!e.drinksAvailable) {
    score -= 15;
    extra.push({ label: "Drinken", points: -15, detail: "Geen drank beschikbaar." });
  }
  if (!e.foodAvailable && (e.isFallbackFor === "dinner" || e.isFallbackFor === "both")) {
    score -= 10;
    extra.push({ label: "Eten", points: -10, detail: "Geen eten terwijl het als dinerfallback dient." });
  }
  if (e.returnTransport === "unknown") {
    score -= 15;
    extra.push({ label: "Terugreis", points: -15, detail: "Niemand weet hoe men terugkomt." });
  }
  score = Math.max(0, Math.min(100, score));
  return { ...v, score, grade: gradeFor(score), factors: [...v.factors, ...extra] };
}

export function primaryNightlife(w: Weekend) {
  return w.nightlife.find((n) => n.isPrimary) ?? w.nightlife[0] ?? null;
}
