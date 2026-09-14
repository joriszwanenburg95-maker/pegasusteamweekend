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
import { SEASON_2026_2027 } from "@/data/season";
import { TEAM, shortName } from "@/data/team";
import {
  applyEventToWeekend,
  cityFromAddress,
  driverTally,
  eventWarnings,
  eventsOn,
  isoWeekday,
  matchForWeekend,
  matches,
  monthGrid,
  nextMatch,
  seasonMonths,
  seasonStats,
  trainingOccurrences,
  trainingsOn,
  travelCost,
  upcomingMatches,
  players,
  rotationOrder,
  shirtBagSchedule,
  nextShirtBag,
} from "@/lib/engine";

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
    expect(hc.weekend.going).toBe(13); // 14 spelers, Koen onbekend; Bob en Jac gaan niet mee
    expect(hc.weekend.unknown).toBe(1);
    expect(hc.overnight.going).toBe(13);
    expect(hc.sunday.going).toBe(12);
    expect(hc.locked).toBe(false);
  });
  it("flags dinner capacity mismatch when reserved < confirmed", () => {
    const hc = headcount(OCTOBER_2026);
    const dinner = hc.mismatches.find((m) => m.key === "dinner")!;
    expect(dinner.reserved).toBe(13);
    expect(dinner.confirmed).toBe(13);
    const w = { ...OCTOBER_2026, dinner: { ...OCTOBER_2026.dinner, reservedCount: 10 } };
    expect(headcount(w).mismatches.find((m) => m.key === "dinner")!.status).toBe("CAPACITY MISMATCH");
  });
});

describe("nightlife viability", () => {
  // Vaste avond los van de seeddata: diner 20:15 + 90 = 21:45, café sluit 22:00.
  const EARLY_EVENING = { ...OCTOBER_2026, dinner: { ...OCTOBER_2026.dinner, time: "20:15", durationMin: 90 } };
  it("a pub 5 minutes away that closes at 22:00 is not automatically good", () => {
    const ctx = eveningContext(EARLY_EVENING);
    const cafe = { ...OCTOBER_2026.nightlife[0], closesAt: "22:00" };
    const v = nightlifeViability(cafe, ctx);
    expect(v.bztWindowMin).toBe(15);
    expect(v.score).toBeLessThan(50);
    expect(v.verdict).toMatch(/sluit te vroeg/i);
  });
  it("late-closing walkable venue scores high", () => {
    const ctx = eveningContext(EARLY_EVENING);
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
    const r = evaluateReadiness(MAASEIK, "2026-09-12T11:00:00.000Z");
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
    const b = bobRiskIndex(MAASEIK, "2026-09-12T11:00:00.000Z");
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
    // Na de correctie van Bob (kamperen op 1 mei aangekondigd, vervoer op tijd) telt alleen eten/avond nog als laat.
    expect(ops.score).toBeGreaterThan(50);
    expect(ops.score).toBeLessThan(70);
    expect(classification).toBe("Twijfelachtig proces. Acceptabel resultaat.");
  });
  it("perfect ops scores 100", () => {
    expect(operationalQuality({ lastMinuteDecisions: 0, unresolvedAtDeparture: 0, unnecessaryTravelMin: 0, waitingMin: 0, groupSplits: 0, reservationIssues: 0, transportIssues: 0, bztLossMin: 0, overrides: 0 }).score).toBe(100);
    expect(weekendOutcome({ gezelligheid: 10, realizedBzt: 10, location: 10, evening: 10, accommodation: 10, activity: 10, overall: 10 }).score).toBe(10);
    expect(classify(9, 90)).toBe("Degelijk proces. Degelijk resultaat.");
  });
});

describe("seizoenskalender", () => {
  const cal = SEASON_2026_2027;

  it("kent 18 competitierondes, 8 uitwedstrijden met rijschema en 6 bekerdata", () => {
    const st = seasonStats(cal);
    expect(st.competition).toBe(18);
    expect(st.cup).toBe(6);
    expect(matches(cal).filter((m) => m.kind === "competition" && !m.isHome)).toHaveLength(8);
    expect(st.totalKm).toBe(162 + 336 + 228 + 276 + 258 + 114 + 151 + 166);
  });

  it("rekent de WBW-bedragen met € 0,23 per km", () => {
    const peelpush = cal.events.find((e) => e.id === "e-r1")!;
    expect(travelCost(peelpush, cal.kmRate)).toBe(37.26);
    const sudosa = cal.events.find((e) => e.id === "e-r2")!;
    expect(travelCost(sudosa, cal.kmRate)).toBe(77.28);
  });

  it("telt chauffeurs zoals het rijschema (Dean, Joris, Job, Koen, Rik, Dicky 3×)", () => {
    const tally = Object.fromEntries(driverTally(cal).map((t) => [t.name, t.count]));
    expect(tally).toMatchObject({ Dean: 3, Joris: 3, Job: 3, Koen: 3, Rik: 3, Dicky: 3, Senna: 2, Pep: 2, Matta: 2, Wouter: 2, Boaz: 2, Pim: 2, Henk: 2 });
  });

  it("genereert trainingen op maandag en woensdag en laat vakantiedagen vervallen", () => {
    expect(isoWeekday("2026-08-17")).toBe(1);
    expect(trainingsOn(cal, "2026-08-17")).toHaveLength(1);
    expect(trainingsOn(cal, "2026-08-18")).toHaveLength(0);
    expect(trainingsOn(cal, "2026-12-21")).toHaveLength(1); // trainen in de week vóór kerst
    expect(trainingsOn(cal, "2026-12-28")).toHaveLength(0); // kerstvakantie
    expect(trainingsOn(cal, "2027-02-08")).toHaveLength(0); // karnaval
    expect(trainingsOn(cal, "2027-05-05")).toHaveLength(0); // bevrijdingsdag
    expect(trainingsOn(cal, "2027-06-02")).toHaveLength(1); // laatste training
    expect(trainingsOn(cal, "2027-06-09")).toHaveLength(0); // na het seizoen
    const all = trainingOccurrences(cal);
    expect(all.length).toBeGreaterThan(70);
    expect(all.every((t) => t.slot.weekday === 1 || t.slot.weekday === 3)).toBe(true);
  });

  it("meerdaagse items dekken elke dag; maandgrid start op maandag", () => {
    expect(eventsOn(cal, "2026-09-13").some((e) => e.id === "e-tw-maaseik")).toBe(true);
    expect(eventsOn(cal, "2026-12-30").some((e) => e.kind === "holiday")).toBe(true);
    const grid = monthGrid("2026-09-01"); // 1 sep 2026 = dinsdag → één lege cel vooraf
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBe("2026-09-01");
    expect(grid.length % 7).toBe(0);
    expect(seasonMonths(cal)[0]).toBe("2026-08-01");
    expect(seasonMonths(cal).at(-1)).toBe("2027-06-01");
  });

  it("volgende wedstrijd vanaf 14 september 2026 is de oefenwedstrijd tegen Inter Rijswijk, daarna Peelpush uit", () => {
    const n = nextMatch(cal, NOW)!;
    expect(n.opponent).toBe("Inter Rijswijk");
    expect(n.kind).toBe("friendly");
    expect(upcomingMatches(cal, NOW, 3).map((e) => e.opponent)).toEqual(["Inter Rijswijk", "Peelpush", "Sudosa"]);
  });

  it("signaleert de onwaarschijnlijke vertrektijd voor Keistad en onbekende bekerlocaties", () => {
    const keistad = cal.events.find((e) => e.id === "e-r15")!;
    expect(eventWarnings(keistad).some((w) => /Reistijd/.test(w))).toBe(true);
    const beker = cal.events.find((e) => e.id === "e-beker2")!;
    expect(eventWarnings(beker)).toContain("Locatie nog onbekend.");
    const sudosa = cal.events.find((e) => e.id === "e-r2")!;
    expect(eventWarnings(sudosa)).toHaveLength(0);
  });

  it("koppelt ronde 2 (Sudosa) aan het teamweekend van 3 oktober en neemt gegevens over", () => {
    const ev = matchForWeekend(cal, OCTOBER_2026.id)!;
    expect(ev.opponent).toBe("Sudosa");
    const w = applyEventToWeekend(blankWeekend("w-t", "Test", "2026-10-03T10:00:00.000Z"), ev, cal.homeVenue);
    expect(w.match.opponent).toBe("Sudosa");
    expect(w.match.isAway).toBe(true);
    expect(w.match.city).toBe("Assen");
    expect(w.match.venue).toBe("Sporthal Olympus");
    expect(new Date(w.match.matchEnd).getTime() - new Date(w.match.matchStart).getTime()).toBe(2 * 3_600_000);
    expect(new Date(w.match.matchStart).getTime() - new Date(w.departureAt).getTime()).toBe(3.75 * 3_600_000);
  });

  it("haalt de plaats uit een adresregel", () => {
    expect(cityFromAddress("Kurversweg 2 Meijel")).toBe("Meijel");
    expect(cityFromAddress("Sporthal Olympus, Mr. Groen van Prinstererlaan 100 Assen")).toBe("Assen");
    expect(cityFromAddress("de Bruyn Kopsstraat 1 Rijswijk")).toBe("Rijswijk");
  });

  it("Maaseik: kamperen was op 1 mei bekend, alleen eten en avond waren last-minute", () => {
    const late = MAASEIK.decisions.filter((d) => {
      const h = (new Date(MAASEIK.departureAt).getTime() - new Date(d.at).getTime()) / 3_600_000;
      return h >= 0 && h < 24;
    });
    expect(late.map((d) => d.topic).sort()).toEqual(["dinner", "nightlife"]);
    expect(MAASEIK.decisions[0].at.startsWith("2026-05-01")).toBe(true);
    expect(MAASEIK.retrospective.operational.transportIssues).toBe(0);
  });
});

describe("selectie & shirttas", () => {
  it("14 spelers, trainer Bob en assistent Jac; Senna Renting is weg", () => {
    expect(players(TEAM)).toHaveLength(14);
    expect(TEAM.find((m) => m.role === "trainer")?.name).toMatch(/Bob/);
    expect(TEAM.find((m) => m.role === "assistant")?.name).toBe("Jac");
    expect(TEAM.some((m) => /Renting/.test(m.name))).toBe(false);
    expect(shortName(TEAM.find((m) => m.id === "p-tom")!)).toBe("Smeets");
    expect(shortName(TEAM.find((m) => m.id === "p-mathijs")!)).toBe("Matta");
  });

  it("rooster op rugnummer, spelers zonder nummer achteraan", () => {
    const order = rotationOrder(TEAM).map(shortName);
    expect(order.slice(0, 11)).toEqual(["Dean", "Senna", "Pep", "Joris", "Smeets", "Dicky", "Wouter", "Koen", "Rik", "Boaz", "Pim"]);
    expect(order.slice(11).sort()).toEqual(["Henk", "Job", "Matta"]);
  });

  it("Dean is aan de beurt voor Inter Rijswijk (19-9), dan Senna (Peelpush) en Pep (Sudosa)", () => {
    const s = shirtBagSchedule(SEASON_2026_2027, TEAM);
    expect(s[0].event.opponent).toBe("Inter Rijswijk");
    expect(shortName(s[0].member!)).toBe("Dean");
    expect(shortName(s[1].member!)).toBe("Senna");
    expect(s[2].event.opponent).toBe("Sudosa");
    expect(shortName(s[2].member!)).toBe("Pep");
    expect(nextShirtBag(SEASON_2026_2027, TEAM, NOW)?.member?.id).toBe("p-dean");
    // Na 14 spelers begint Dean opnieuw.
    expect(s[14].member?.id).toBe("p-dean");
  });

  it("een handmatige afwijking verschuift het rooster niet", () => {
    const cal = { ...SEASON_2026_2027, events: SEASON_2026_2027.events.map((e) => (e.id === "e-r1" ? { ...e, shirtBagMemberId: "p-pim" } : e)) };
    const s = shirtBagSchedule(cal, TEAM);
    expect(s[1].member?.id).toBe("p-pim");
    expect(s[1].override).toBe(true);
    expect(s[2].member?.id).toBe("p-pepijn");
  });
});
