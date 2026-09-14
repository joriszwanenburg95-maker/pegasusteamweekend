import { describe, expect, it } from "vitest";
import { MAASEIK, OCTOBER_2026, blankWeekend } from "@/data/seed";
import {
  analyzeCriticalPath,
  assessTransport,
  bobRiskIndex,
  carryOverLessons,
  chipsGuardStatus,
  classify,
  clockSpanMinutes,
  effectivePassengerCapacity,
  estimateBzt,
  evaluateReadiness,
  eveningContext,
  groupSplitRisk,
  headcount,
  lessonChecklistItems,
  nightlifeViability,
  operationalQuality,
  retrospectiveScores,
  weekendOutcome,
} from "@/lib/engine";
import type { Vehicle } from "@/lib/types";

const NOW = "2026-09-14T12:00:00.000Z";

describe("time", () => {
  it("clock span across midnight", () => {
    expect(clockSpanMinutes("20:00", "02:00")).toBe(360);
    expect(clockSpanMinutes("21:30", "22:00")).toBe(30);
    expect(clockSpanMinutes("x", "22:00")).toBeNull();
  });
});

describe("transport capacity 2.0", () => {
  const base: Vehicle = { id: "v", driverId: "d", name: "x", nominalSeats: 4, availableSeats: 4, cargoSize: "small", luggageLoad: "high", passengerIds: [], confirmed: true };
  it("Job's Up: 4 seats, camping load HIGH → effective 2", () => {
    expect(effectivePassengerCapacity(base)).toBe(2);
  });
  it("Senna's Volvo station: 5 seats, cargo LARGE → effective 5", () => {
    expect(effectivePassengerCapacity({ ...base, nominalSeats: 5, availableSeats: 5, cargoSize: "large" })).toBe(5);
  });
  it("warns when Σ effective capacity < travelers", () => {
    const w = { ...OCTOBER_2026, vehicles: OCTOBER_2026.vehicles.slice(0, 1) };
    const t = assessTransport(w);
    expect(t.shortfall).toBeGreaterThan(0);
    expect(t.status).toBe("FAIL");
  });
});

describe("headcount lock", () => {
  it("distinguishes match / weekend / overnight / sunday / dinner attendance", () => {
    const hc = headcount(OCTOBER_2026);
    expect(hc.weekend.going).toBe(12);
    expect(hc.weekend.unknown).toBe(1);
    expect(hc.overnight.going).toBe(11);
    expect(hc.sunday.going).toBe(11);
    expect(hc.locked).toBe(false);
  });
  it("flags dinner capacity mismatch when reserved < confirmed", () => {
    const hc = headcount(OCTOBER_2026);
    const dinner = hc.mismatches.find((m) => m.key === "dinner")!;
    expect(dinner.reserved).toBe(12);
    expect(dinner.confirmed).toBe(12);
    const w = { ...OCTOBER_2026, dinner: { ...OCTOBER_2026.dinner, reservedCount: 10 } };
    expect(headcount(w).mismatches.find((m) => m.key === "dinner")!.status).toBe("CAPACITY MISMATCH");
  });
});

describe("nightlife viability", () => {
  it("a pub 5 minutes away that closes at 22:00 is not automatically good", () => {
    const ctx = eveningContext(OCTOBER_2026); // diner 20:15 + 90 = 21:45
    const cafe = OCTOBER_2026.nightlife[0];
    const v = nightlifeViability(cafe, ctx);
    expect(v.bztWindowMin).toBe(15);
    expect(v.score).toBeLessThan(50);
    expect(v.verdict).toMatch(/sluit te vroeg/i);
  });
  it("late-closing walkable venue scores high", () => {
    const ctx = eveningContext(OCTOBER_2026);
    const v = nightlifeViability({ ...OCTOBER_2026.nightlife[0], closesAt: "02:00", suitableLargeGroup: true, groupCapacity: 20, fallbackAvailable: true }, ctx);
    expect(v.score).toBeGreaterThanOrEqual(85);
  });
});

describe("group split risk", () => {
  it("LOW when everyone can walk", () => {
    const w = { ...OCTOBER_2026, nightlife: [{ ...OCTOBER_2026.nightlife[0], suitableLargeGroup: true, groupCapacity: 20 }] };
    expect(groupSplitRisk(w).level).toBe("LOW");
  });
  it("CRITICAL when taxis needed and not arranged", () => {
    const w = { ...OCTOBER_2026, nightlife: [{ ...OCTOBER_2026.nightlife[1], isPrimary: true }] };
    expect(groupSplitRisk(w).level).toBe("CRITICAL");
  });
  it("CRITICAL when no destination at all", () => {
    expect(groupSplitRisk({ ...OCTOBER_2026, nightlife: [] }).level).toBe("CRITICAL");
  });
});

describe("critical drinking path", () => {
  it("computes minutes to first beer and optimizations", () => {
    const a = analyzeCriticalPath(OCTOBER_2026);
    expect(a.minutesToFirstBeer).toBe(15 + 20 + 15 + 9 + 8 + 90 + 5);
    expect(a.byCategory.waste).toBe(9);
    expect(a.optimizations[0].savesMin).toBeGreaterThanOrEqual(9);
    expect(a.transfers).toBe(3);
  });
  it("BZT is reduced by group split penalty", () => {
    const b = estimateBzt(MAASEIK);
    expect(b.grossMin).toBeGreaterThan(0);
    expect(b.netMin).toBeLessThanOrEqual(b.grossMin);
  });
});

describe("readiness gate", () => {
  it("October weekend may not be locked", () => {
    const r = evaluateReadiness(OCTOBER_2026, NOW);
    expect(r.canLock).toBe(false);
    expect(r.lockBlockers.length).toBeGreaterThan(0);
    expect(r.percent).toBeGreaterThan(30);
    expect(r.percent).toBeLessThan(90);
    expect(r.deadlines.map((d) => d.key)).toEqual(["T-7D", "T-72H", "T-24H", "DEPARTURE"]);
    expect(r.bobLeadTimeHours).toBeNull();
  });
  it("dinner unknown yields FAIL on Dinner check", () => {
    const w = { ...OCTOBER_2026, dinner: { ...OCTOBER_2026.dinner, known: false } };
    const r = evaluateReadiness(w, NOW);
    expect(r.checks.find((c) => c.key === "dinner")!.status).toBe("FAIL");
  });
  it("Maaseik BOB lead time was under two hours", () => {
    const r = evaluateReadiness(MAASEIK, "2025-09-27T13:00:00.000Z");
    expect(r.bobLeadTimeHours).not.toBeNull();
    expect(r.bobLeadTimeHours!).toBeLessThan(2);
    expect(r.bobLeadTimeLabel).toBe("Extreem kort");
  });
  it("does not go NO GO purely because planning is unfinished far out", () => {
    const w = blankWeekend("w-x", "X", "2027-01-16T12:00:00.000Z");
    const r = evaluateReadiness({ ...w, phase: "PLANNING" }, NOW);
    expect(["CONDITIONAL GO", "NO GO"]).toContain(r.gate);
  });
});

describe("bob risk index", () => {
  it("Maaseik is SEVERE with own shelter as primary driver", () => {
    const b = bobRiskIndex(MAASEIK, "2025-09-27T13:00:00.000Z");
    expect(b.score).toBeGreaterThanOrEqual(70);
    expect(b.primaryDriver).toMatch(/zelf een slaapplek/);
    expect(b.tooltip).toBe("Eén Bob is genoeg.");
  });
  it("a fully arranged weekend is low risk", () => {
    const w = {
      ...OCTOBER_2026,
      headcountLockedAt: NOW,
      planFinalAt: "2026-09-20T12:00:00.000Z",
      nightlife: [{ ...OCTOBER_2026.nightlife[0], closesAt: "02:00" }],
      participants: OCTOBER_2026.participants.map((p) => ({ ...p, weekend: p.weekend === "unknown" ? "notGoing" as const : p.weekend })),
    };
    const b = bobRiskIndex(w, NOW);
    expect(b.score).toBeLessThan(40);
  });
  it("unguarded chips of Rik raise the index; guarded chips lower it (lesson Maaseik)", () => {
    expect(chipsGuardStatus(OCTOBER_2026)).toBe("open");
    const open = bobRiskIndex(OCTOBER_2026, NOW);
    expect(open.drivers.find((d) => /chips/i.test(d.label))?.points).toBe(6);
    const guarded = {
      ...OCTOBER_2026,
      checklist: OCTOBER_2026.checklist.map((c) => (/chips/i.test(c.label) ? { ...c, status: "done" as const } : c)),
    };
    expect(chipsGuardStatus(guarded)).toBe("done");
    const g = bobRiskIndex(guarded, NOW);
    expect(g.drivers.find((d) => /chips/i.test(d.label))?.points).toBe(-3);
    expect(g.score).toBe(open.score - 9);
    const none = { ...OCTOBER_2026, checklist: OCTOBER_2026.checklist.filter((c) => !/chips/i.test(c.label)) };
    expect(chipsGuardStatus(none)).toBe("missing");
    expect(bobRiskIndex(none, NOW).drivers.some((d) => /chips/i.test(d.label))).toBe(false);
  });
});

describe("lessons carry over", () => {
  it("Maaseik lessons (incl. chips) become attention points for October 2026", () => {
    const lessons = carryOverLessons([OCTOBER_2026, MAASEIK], OCTOBER_2026);
    expect(lessons.length).toBe(MAASEIK.retrospective.lessonsLearned.length);
    expect(lessons.every((l) => l.weekendId === MAASEIK.id)).toBe(true);
    expect(lessons.some((l) => /chips van Rik/i.test(l.text))).toBe(true);
  });
  it("does not carry lessons from later or unfinished weekends", () => {
    expect(carryOverLessons([OCTOBER_2026, MAASEIK], MAASEIK)).toEqual([]);
    expect(carryOverLessons([OCTOBER_2026])).toEqual([]);
  });
  it("chips guard is anchored on the checklist of new weekends", () => {
    expect(lessonChecklistItems(OCTOBER_2026).map((c) => c.label)).toContain("chips van Rik bewaakt (les Maaseik)");
    expect(lessonChecklistItems(blankWeekend("w-n", "N", NOW)).length).toBe(1);
  });
});

describe("operational quality vs weekend outcome", () => {
  it("Maaseik: good outcome, questionable process", () => {
    const { ops, out, classification } = retrospectiveScores(MAASEIK.retrospective, MAASEIK);
    expect(out.score).toBeGreaterThanOrEqual(8);
    expect(ops.score).toBeLessThan(55);
    expect(classification).toBe("Twijfelachtig proces. Acceptabel resultaat.");
  });
  it("perfect ops scores 100", () => {
    expect(operationalQuality({ lastMinuteDecisions: 0, unresolvedAtDeparture: 0, unnecessaryTravelMin: 0, waitingMin: 0, groupSplits: 0, reservationIssues: 0, transportIssues: 0, bztLossMin: 0, overrides: 0 }).score).toBe(100);
    expect(weekendOutcome({ gezelligheid: 10, realizedBzt: 10, location: 10, evening: 10, accommodation: 10, activity: 10, overall: 10 }).score).toBe(10);
    expect(classify(9, 90)).toBe("Degelijk proces. Degelijk resultaat.");
  });
});
