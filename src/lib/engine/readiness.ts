import type { Weekend } from "../types";
import { assessFood, type CheckStatus } from "./food";
import { groupSplitRisk } from "./groupSplit";
import { headcount } from "./headcount";
import { eveningContext, nightlifeViability, primaryNightlife } from "./nightlife";
import { assessTransport, luggageCheck } from "./transport";
import { hoursBetween } from "./time";

export type { CheckStatus };

export interface ReadinessCheck {
  key: string;
  label: string;
  status: CheckStatus;
  detail: string;
  /** Blokkeert LOCKED wanneer FAIL/UNKNOWN. */
  gating: boolean;
}

export type DeadlineKey = "T-7D" | "T-72H" | "T-24H" | "DEPARTURE";

export interface Deadline {
  key: DeadlineKey;
  at: string;
  hoursUntil: number;
  passed: boolean;
  /** Labels van checks die op dit moment minimaal PASS moeten zijn. */
  required: string[];
  missing: string[];
  status: "OK" | "AT RISK" | "MISSED" | "UPCOMING";
}

export interface ReadinessReport {
  checks: ReadinessCheck[];
  percent: number;
  passCount: number;
  failCount: number;
  warningCount: number;
  unknownCount: number;
  canLock: boolean;
  lockBlockers: string[];
  deadlines: Deadline[];
  /** Uren tussen definitief plan en vertrek; null = plan nog niet definitief. */
  bobLeadTimeHours: number | null;
  bobLeadTimeLabel: string;
  /** Risicoboodschap over laat beslissen (geen automatische NO GO). */
  riskNarrative: string;
  /** Status van het weekend zoals de gate het ziet. */
  gate: "GO" | "CONDITIONAL GO" | "NO GO" | "COMPLETED";
}

const POINTS: Record<CheckStatus, number> = { PASS: 1, WARNING: 0.5, FAIL: 0, UNKNOWN: 0 };

export function evaluateReadiness(w: Weekend, nowIso: string): ReadinessReport {
  const hc = headcount(w);
  const food = assessFood(w);
  const transport = assessTransport(w);
  const luggage = luggageCheck(w);
  const primary = primaryNightlife(w);
  const split = groupSplitRisk(w);
  const checks: ReadinessCheck[] = [];

  // Deelnemersaantal
  {
    const unknown = hc.weekend.unknown;
    checks.push({
      key: "attendance",
      label: "Deelnemers",
      status: hc.locked ? "PASS" : unknown === 0 ? "WARNING" : unknown <= 2 ? "WARNING" : "FAIL",
      detail: hc.locked
        ? `Headcount locked: ${hc.weekend.going} weekendgangers.`
        : unknown === 0
          ? `${hc.weekend.going} going, niemand onbekend, maar headcount nog niet gelocked.`
          : `${unknown} deelnemer(s) nog 'unknown'. Groepsgrootte onduidelijk.`,
      gating: true,
    });
  }
  // Slaapplaats
  checks.push({
    key: "accommodation",
    label: "Slaapplaats",
    status:
      w.accommodation.type === "unknown" || !w.accommodation.name
        ? "UNKNOWN"
        : w.accommodation.confirmed
          ? "PASS"
          : "WARNING",
    detail: !w.accommodation.name
      ? "Geen accommodatie."
      : `${w.accommodation.name} (${w.accommodation.type}) ${w.accommodation.confirmed ? "bevestigd" : "niet bevestigd"}.`,
    gating: true,
  });
  // Daadwerkelijk bed
  {
    const beds = hc.mismatches.find((m) => m.key === "beds");
    checks.push({
      key: "beds",
      label: "Bedden",
      status: w.accommodation.ownShelterRequired
        ? "FAIL"
        : beds?.status === "OK"
          ? "PASS"
          : beds?.status === "CAPACITY MISMATCH"
            ? "FAIL"
            : "UNKNOWN",
      detail: w.accommodation.ownShelterRequired
        ? "Deelnemers moeten zelf een slaapplek (tent) regelen. Geen bed = geen PASS."
        : beds?.detail ?? "Onbekend.",
      gating: true,
    });
  }
  // Avondlocatie
  {
    let status: CheckStatus = "UNKNOWN";
    let detail = "Geen avondbestemming vastgelegd.";
    if (primary) {
      const v = nightlifeViability(primary, eveningContext(w));
      status = v.score >= 70 ? "PASS" : v.score >= 50 ? "WARNING" : "FAIL";
      detail = `${primary.name}: viability ${v.score}/100 (${v.grade}). ${v.verdict} Group Split Risk ${split.level}.`;
      if (split.level === "CRITICAL" && status === "PASS") status = "WARNING";
    }
    checks.push({ key: "nightlife", label: "Avondlocatie", status, detail, gating: true });
  }
  // Eten
  checks.push({ key: "dinner", label: "Eten", status: food.status, detail: food.headline + (food.issues[0] ? ` — ${food.issues[0]}` : ""), gating: true });
  // Reserveringen
  {
    const mm = hc.mismatches.filter((m) => m.status === "CAPACITY MISMATCH");
    const unk = hc.mismatches.filter((m) => m.status === "UNKNOWN" && m.key !== "beds");
    checks.push({
      key: "reservations",
      label: "Reserveringen",
      status: mm.length ? "FAIL" : unk.length ? "WARNING" : "PASS",
      detail: mm.length
        ? mm.map((m) => `${m.label}: ${m.detail}`).join(" ")
        : unk.length
          ? unk.map((m) => `${m.label}: ${m.detail}`).join(" ")
          : "Reserveringen sluiten aan op attendance.",
      gating: true,
    });
  }
  // Transport
  checks.push({ key: "transport", label: "Vervoer", status: transport.status, detail: transport.detail, gating: true });
  // Chauffeurs
  checks.push({
    key: "drivers",
    label: "Chauffeurs",
    status: w.vehicles.length === 0 ? "UNKNOWN" : transport.driversConfirmed ? "PASS" : "FAIL",
    detail: w.vehicles.length === 0
      ? "Geen auto's ingevoerd."
      : transport.driversConfirmed
        ? `${w.vehicles.length} chauffeur(s) bevestigd en gaan mee.`
        : "Niet elke auto heeft een chauffeur die mee gaat.",
    gating: true,
  });
  // Stoelcapaciteit
  checks.push({
    key: "seats",
    label: "Stoelcapaciteit",
    status: transport.status === "UNKNOWN" ? "UNKNOWN" : transport.shortfall > 0 ? "FAIL" : "PASS",
    detail: `${transport.totalEffectiveCapacity} effectieve stoelen voor ${transport.travelers} passagiers.`,
    gating: true,
  });
  // Bagagecapaciteit
  checks.push({
    key: "luggage",
    label: "Bagagecapaciteit",
    status: w.vehicles.length === 0 ? "UNKNOWN" : luggage.ok ? "PASS" : "WARNING",
    detail: luggage.detail,
    gating: false,
  });
  // Toegangsinformatie
  {
    const a = w.accommodation;
    const has = a.contact.trim() && a.checkInFrom.trim();
    const code = a.accessCode.trim();
    checks.push({
      key: "access",
      label: "Toegangsinformatie",
      status: has && code ? "PASS" : has ? "WARNING" : "UNKNOWN",
      detail: has
        ? `Check-in ${a.checkInFrom}–${a.checkInUntil}, contact ${a.contact}${code ? ", toegangscode bekend" : ", geen toegangscode/instructie"}.`
        : "Geen contact of check-in informatie.",
      gating: true,
    });
  }
  // Zondagprogramma indien relevant
  if (w.sunday.relevant) {
    checks.push({
      key: "sunday",
      label: "Zondagprogramma",
      status: w.sunday.confirmed ? (w.sunday.travelFromAccommodationMin > 45 ? "WARNING" : "PASS") : "WARNING",
      detail: w.sunday.confirmed
        ? `${w.sunday.name} om ${w.sunday.startTime}, ${w.sunday.travelFromAccommodationMin} min vanaf accommodatie.`
        : `${w.sunday.name || "Activiteit"} nog niet bevestigd.`,
      gating: false,
    });
  }

  const passCount = checks.filter((c) => c.status === "PASS").length;
  const failCount = checks.filter((c) => c.status === "FAIL").length;
  const warningCount = checks.filter((c) => c.status === "WARNING").length;
  const unknownCount = checks.filter((c) => c.status === "UNKNOWN").length;
  const percent = Math.round(
    (checks.reduce((s, c) => s + POINTS[c.status], 0) / checks.length) * 100,
  );

  const lockBlockers = checks
    .filter((c) => c.gating && (c.status === "FAIL" || c.status === "UNKNOWN"))
    .map((c) => `${c.label}: ${c.status === "FAIL" ? "FOUT" : "ONBEKEND"}`);
  if (lockBlockers.length === 0 && percent < 80) {
    const warnings = checks.filter((c) => c.status === "WARNING").map((c) => c.label);
    lockBlockers.push(`Gereedheid ${percent}% < 80% (let op: ${warnings.join(", ")})`);
  }
  const canLock = lockBlockers.length === 0;

  // Deadlines
  const dep = new Date(w.departureAt).getTime();
  const H = 3_600_000;
  const requiredAt: Record<DeadlineKey, string[]> = {
    "T-7D": ["attendance", "accommodation"],
    "T-72H": ["attendance", "accommodation", "beds", "dinner", "nightlife", "drivers"],
    "T-24H": ["attendance", "accommodation", "beds", "dinner", "nightlife", "reservations", "transport", "drivers", "seats"],
    DEPARTURE: checks.filter((c) => c.gating).map((c) => c.key),
  };
  const offsets: Record<DeadlineKey, number> = { "T-7D": 7 * 24, "T-72H": 72, "T-24H": 24, DEPARTURE: 0 };
  const byKey = new Map(checks.map((c) => [c.key, c]));
  const deadlines: Deadline[] = (Object.keys(offsets) as DeadlineKey[]).map((key) => {
    const at = new Date(dep - offsets[key] * H).toISOString();
    const hoursUntil = hoursBetween(nowIso, at);
    const passed = hoursUntil <= 0;
    const missing = requiredAt[key].filter((k) => byKey.get(k)?.status !== "PASS").map((k) => byKey.get(k)?.label ?? k);
    let status: Deadline["status"] = "UPCOMING";
    if (passed && missing.length) status = "MISSED";
    else if (passed) status = "OK";
    else if (missing.length && hoursUntil < 48) status = "AT RISK";
    return {
      key,
      at,
      hoursUntil,
      passed,
      required: requiredAt[key].map((k) => byKey.get(k)?.label ?? k),
      missing,
      status,
    };
  });

  // BOB lead time
  const bobLeadTimeHours = w.planFinalAt ? hoursBetween(w.planFinalAt, w.departureAt) : null;
  const bobLeadTimeLabel =
    bobLeadTimeHours === null
      ? "Plan nog niet definitief"
      : bobLeadTimeHours < 0
        ? "Plan pas definitief ná vertrek"
        : bobLeadTimeHours < 24
          ? "Extreem kort"
          : bobLeadTimeHours < 72
            ? "Kort"
            : bobLeadTimeHours < 168
              ? "Acceptabel"
              : "Ruim";

  const hoursToDeparture = hoursBetween(nowIso, w.departureAt);
  let riskNarrative: string;
  if (w.phase === "COMPLETED") riskNarrative = "Weekend afgerond. Zie de terugblik.";
  else if (canLock) riskNarrative = "Alle blokkerende checks in orde. Het weekend mag VERGRENDELD worden.";
  else if (hoursToDeparture < 24)
    riskNarrative = `Minder dan 24 uur tot vertrek met ${lockBlockers.length} open blokkerend(e) punt(en). Elke beslissing die nu valt is per definitie last-minute; verwacht BZT-verlies en groepssplitsing.`;
  else if (hoursToDeparture < 72)
    riskNarrative = `Binnen 72 uur van vertrek met ${lockBlockers.length} open blokkerend(e) punt(en). Reserveringen worden nu al riskant (restaurants vol, taxi's niet beschikbaar).`;
  else if (hoursToDeparture < 168)
    riskNarrative = `${Math.round(hoursToDeparture / 24)} dagen tot vertrek. ${lockBlockers.length} blokkerend(e) punt(en) open; nog te repareren zonder BZT-schade als er deze week besloten wordt.`;
  else riskNarrative = `${Math.round(hoursToDeparture / 24)} dagen tot vertrek. Geen acute druk, maar ${lockBlockers.length} blokkerend(e) punt(en) open.`;

  const gate: ReadinessReport["gate"] =
    w.phase === "COMPLETED"
      ? "COMPLETED"
      : canLock
        ? "GO"
        : failCount >= 3 || (hoursToDeparture < 24 && lockBlockers.length > 0)
          ? "NO GO"
          : "CONDITIONAL GO";

  return {
    checks,
    percent,
    passCount,
    failCount,
    warningCount,
    unknownCount,
    canLock,
    lockBlockers,
    deadlines,
    bobLeadTimeHours,
    bobLeadTimeLabel,
    riskNarrative,
    gate,
  };
}
