import type { ChecklistItem, Weekend } from "../types";

/**
 * Geleerde lessen dragen over: elke les uit een afgerond weekend is een
 * aandachtspunt voor de weekenden die erna komen (bijv. de chips van Rik, Maaseik).
 */
export interface CarryOverLesson {
  text: string;
  weekendId: string;
  weekendName: string;
  weekendSlug: string;
  season: string;
  departureAt: string;
}

/** Lessen uit afgeronde weekenden, nieuwste casus eerst. Met `target` alleen casussen vóór dat weekend. */
export function carryOverLessons(all: Weekend[], target?: Weekend): CarryOverLesson[] {
  return all
    .filter(
      (w) =>
        w.phase === "COMPLETED" &&
        w.retrospective.filled &&
        (!target || (w.id !== target.id && w.departureAt < target.departureAt)),
    )
    .sort((a, b) => b.departureAt.localeCompare(a.departureAt))
    .flatMap((w) =>
      w.retrospective.lessonsLearned.map((text) => ({
        text,
        weekendId: w.id,
        weekendName: w.name,
        weekendSlug: w.slug,
        season: w.season,
        departureAt: w.departureAt,
      })),
    );
}

/** Checklistpunten die uit een eerdere les voortkomen: label eindigt op "(les <casus>)". */
export function lessonChecklistItems(w: Weekend): ChecklistItem[] {
  return w.checklist.filter((c) => /\(les [^)]+\)/i.test(c.label));
}

/** Het chips-punt uit Maaseik: aanwezig, en al afgehandeld? */
export function chipsGuardStatus(w: Weekend): "missing" | "open" | "done" {
  const item = w.checklist.find((c) => /chips/i.test(c.label));
  if (!item) return "missing";
  return item.status === "done" || item.status === "na" ? "done" : "open";
}
