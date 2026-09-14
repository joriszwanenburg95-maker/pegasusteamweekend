"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useStore } from "@/store/store";
import type { Weekend } from "@/lib/types";
import {
  bobRiskIndex,
  estimateBzt,
  evaluateReadiness,
  formatDate,
  formatDateTime,
  formatDuration,
  formatHours,
  groupSplitRisk,
  hoursBetween,
  retrospectiveScores,
} from "@/lib/engine";
import {
  Badge,
  Card,
  EmptyState,
  Kpi,
  PageHeader,
  PhaseBadge,
  Progress,
  StatusBadge,
  toneForPercent,
  type Tone,
} from "@/components/ui";

/** Toon voor de BOB lead time-kwalificatie uit de engine. */
function toneForLeadTime(label: string): Tone {
  if (label === "Ruim" || label === "Acceptabel") return "go";
  if (label === "Kort") return "warn";
  if (label === "Extreem kort" || label === "Plan pas definitief ná vertrek") return "nogo";
  return "unknown";
}

/** Eerstvolgend niet-afgerond weekend: vroegste vertrek in de toekomst, anders het eerste open weekend. */
function pickNextWeekend(open: Weekend[], nowIso: string): Weekend | null {
  if (open.length === 0) return null;
  const future = open
    .filter((w) => hoursBetween(nowIso, w.departureAt) >= 0)
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  if (future.length > 0) return future[0];
  return [...open].sort((a, b) => b.departureAt.localeCompare(a.departureAt))[0];
}

export default function ControlRoomPage() {
  const { state, now } = useStore();

  const open = useMemo(
    () => state.weekends.filter((w) => w.phase !== "COMPLETED"),
    [state.weekends],
  );
  const completed = useMemo(
    () => state.weekends.filter((w) => w.phase === "COMPLETED"),
    [state.weekends],
  );
  const next = useMemo(() => pickNextWeekend(open, now), [open, now]);

  const scored = completed
    .filter((w) => w.retrospective.filled)
    .map((w) => ({ weekend: w, ...retrospectiveScores(w.retrospective, w) }));
  const avgOps = scored.length
    ? Math.round(scored.reduce((s, x) => s + x.ops.score, 0) / scored.length)
    : null;
  const avgOutcome = scored.length
    ? Math.round((scored.reduce((s, x) => s + x.out.score, 0) / scored.length) * 10) / 10
    : null;
  const readyCount = open.filter((w) => w.phase === "READY" || w.phase === "LOCKED").length;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Pegasus HS1 · Superdivisie Heren · Seizoen 2026/2027"
        title="Control Room"
        subtitle="Nijmegen · Ark van Oost — readiness gate, BZT-optimizer en Bob Risk Index voor elk teamweekend."
        actions={
          <>
            <Link href="/weekends" className="btn">
              Alle weekends
            </Link>
            <Link href="/glossary" className="btn">
              Glossary
            </Link>
          </>
        }
      />

      {next ? <NextWeekendHero weekend={next} now={now} /> : (
        <EmptyState title="Geen weekend in planning">
          <Link href="/weekends" className="underline">
            Maak een nieuw weekend aan
          </Link>{" "}
          om de readiness gate te activeren.
        </EmptyState>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <Kpi label="In planning" value={open.length} sub="Weekends niet afgerond" />
        <Kpi
          label="Locked / ready"
          value={readyCount}
          tone={readyCount > 0 ? "go" : undefined}
          sub="Fase LOCKED of READY"
        />
        <Kpi label="Completed" value={completed.length} sub="Afgeronde weekends" />
        <Kpi
          label="Avg operational quality"
          value={avgOps ?? "—"}
          unit={avgOps === null ? undefined : "/100"}
          tone={avgOps === null ? undefined : toneForPercent(avgOps)}
          sub="Gemiddelde van ingevulde retrospectives"
        />
        <Kpi
          label="Avg weekend outcome"
          value={avgOutcome ?? "—"}
          unit={avgOutcome === null ? undefined : "/10"}
          sub="Beleving, los van het proces"
        />
      </div>

      <ReadinessBoard weekends={open} now={now} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {next ? <DeadlinesCard weekend={next} now={now} /> : null}
        <HistoricalBenchmark rows={scored} />
      </div>

      <div className="card-navy stripe px-4 py-3 text-center">
        <div className="erp-label">Grondbeginsel</div>
        <div className="text-[13px] sm:text-sm font-bold tracking-tight mt-0.5">
          GOOD WEEKEND OUTCOME ≠ GOOD OPERATIONAL PLANNING
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function NextWeekendHero({ weekend, now }: { weekend: Weekend; now: string }) {
  const readiness = evaluateReadiness(weekend, now);
  const bob = bobRiskIndex(weekend, now);
  const bzt = estimateBzt(weekend);
  const split = groupSplitRisk(weekend);
  const hours = hoursBetween(now, weekend.departureAt);
  const base = `/weekends/${weekend.slug}`;

  return (
    <section className="card-navy stripe px-4 sm:px-5 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="erp-label">Next weekend · {weekend.season} · {weekend.city || "locatie n.t.b."}</div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight mt-0.5">{weekend.name}</h2>
          <div className="erp-mono text-[12px] text-white/65 mt-1">
            Departure {formatDateTime(weekend.departureAt)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PhaseBadge phase={weekend.phase} />
          <StatusBadge status={readiness.gate} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
        <div className="col-span-2 lg:col-span-2 rounded-[6px] bg-white/5 border border-white/10 px-3 py-2.5">
          <div className="erp-label">Readiness</div>
          <div className="erp-mono text-4xl font-semibold leading-none mt-1">
            {readiness.percent}
            <span className="text-base font-medium text-white/50 ml-1">%</span>
          </div>
          <Progress value={readiness.percent} tone={toneForPercent(readiness.percent)} className="mt-2" />
          <div className="text-[11.5px] text-white/60 mt-1.5 erp-mono">
            {readiness.passCount} PASS · {readiness.warningCount} WARN · {readiness.failCount} FAIL ·{" "}
            {readiness.unknownCount} UNKNOWN
          </div>
        </div>

        <HeroStat
          label="Bob risk index"
          value={bob.score}
          unit={`/100 ${bob.level}`}
          title={bob.tooltip}
          note={bob.tooltip}
        />
        <HeroStat
          label="BZT netto"
          value={formatDuration(bzt.netMin)}
          note={bzt.splitPenaltyMin > 0 ? `−${formatDuration(bzt.splitPenaltyMin)} door splitsing` : "Geen splitsingsaftrek"}
        />
        <HeroStat
          label="Countdown"
          value={formatHours(hours)}
          unit={hours < 0 ? "verstreken" : "tot vertrek"}
          note={`Group Split Risk ${split.level}`}
        />
      </div>

      <p className="text-[13px] leading-snug text-white/80 mt-3 border-t border-white/10 pt-3">
        <span className="erp-label mr-2">Risk narrative</span>
        {readiness.riskNarrative}
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        <Link href={base} className="btn btn-primary">
          Open weekend <ArrowRight size={14} />
        </Link>
        <Link href={`${base}/readiness`} className="btn">
          <ShieldCheck size={14} /> Readiness gate
        </Link>
      </div>
    </section>
  );
}

function HeroStat({
  label,
  value,
  unit,
  note,
  title,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: string;
  title?: string;
}) {
  return (
    <div className="rounded-[6px] bg-white/5 border border-white/10 px-3 py-2.5" title={title}>
      <div className="erp-label">{label}</div>
      <div className="erp-mono text-2xl font-semibold leading-tight mt-1">{value}</div>
      {unit && <div className="text-[11px] text-white/55 uppercase tracking-[0.08em] font-semibold">{unit}</div>}
      {note && <div className="text-[11.5px] text-white/60 mt-1 leading-snug">{note}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ReadinessBoard({ weekends, now }: { weekends: Weekend[]; now: string }) {
  const rows = [...weekends].sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  return (
    <Card
      eyebrow="Gate control"
      title="Readiness board"
      padded={false}
      actions={
        <Link href="/weekends" className="btn btn-sm">
          Beheer
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted">Geen openstaande weekends.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th>Weekend</th>
                <th>Vertrek</th>
                <th>Fase</th>
                <th>Gate</th>
                <th className="text-right">Readiness</th>
                <th className="text-right">Fails</th>
                <th className="text-right">Bob</th>
                <th>BOB lead time</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((w) => {
                const r = evaluateReadiness(w, now);
                const bob = bobRiskIndex(w, now);
                return (
                  <tr key={w.id}>
                    <td className="font-semibold text-navy whitespace-nowrap">{w.name}</td>
                    <td className="erp-mono whitespace-nowrap">{formatDate(w.departureAt)}</td>
                    <td><PhaseBadge phase={w.phase} /></td>
                    <td><StatusBadge status={r.gate} /></td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <span className="erp-mono">{r.percent}%</span>
                        <Progress value={r.percent} tone={toneForPercent(r.percent)} className="w-16 hidden sm:block" />
                      </div>
                    </td>
                    <td className="text-right erp-mono">
                      {r.failCount > 0 ? <span className="text-nogo font-semibold">{r.failCount}</span> : 0}
                    </td>
                    <td className="text-right erp-mono" title={bob.tooltip}>
                      {bob.score}
                    </td>
                    <td className="whitespace-nowrap">
                      <Badge tone={toneForLeadTime(r.bobLeadTimeLabel)}>{r.bobLeadTimeLabel}</Badge>
                    </td>
                    <td className="text-right">
                      <Link href={`/weekends/${w.slug}`} className="btn btn-sm">
                        Open
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function DeadlinesCard({ weekend, now }: { weekend: Weekend; now: string }) {
  const r = evaluateReadiness(weekend, now);
  return (
    <Card eyebrow={weekend.name} title="Deadlines" padded={false}>
      <div className="divide-y divide-line">
        {r.deadlines.map((d) => (
          <div key={d.key} className="px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="erp-mono text-sm font-semibold text-navy w-[86px]">{d.key}</span>
              <StatusBadge status={d.status} />
              <span className="erp-mono text-[11.5px] text-faint ml-auto whitespace-nowrap">
                {formatDateTime(d.at)} · {d.passed ? "verstreken" : formatHours(d.hoursUntil)}
              </span>
            </div>
            <div className="text-[12px] text-muted mt-1 leading-snug">
              {d.missing.length === 0 ? (
                <span className="text-go font-semibold">Alle vereiste items PASS.</span>
              ) : (
                <>
                  <span className="erp-label mr-1">Missing</span>
                  {d.missing.join(" · ")}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */

function HistoricalBenchmark({
  rows,
}: {
  rows: { weekend: Weekend; ops: { score: number }; out: { score: number }; classification: string }[];
}) {
  return (
    <Card
      eyebrow="Benchmark"
      title="Historisch"
      actions={
        <Link href="/history" className="btn btn-sm">
          Lessons learned
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="text-sm text-muted">Nog geen afgeronde weekends met retrospective.</div>
      ) : (
        <div className="space-y-3">
          {rows.map(({ weekend, ops, out, classification }) => (
            <div key={weekend.id} className="rounded-[6px] border border-line px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/weekends/${weekend.slug}`} className="font-semibold text-navy text-sm hover:underline">
                  {weekend.name}
                </Link>
                <span className="erp-mono text-[11px] text-faint">{formatDate(weekend.departureAt, { year: "numeric" })}</span>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div>
                  <div className="erp-label">Weekend outcome</div>
                  <div className="erp-mono text-2xl font-semibold leading-tight">
                    {out.score.toFixed(1)}
                    <span className="text-sm text-faint">/10</span>
                  </div>
                </div>
                <div>
                  <div className="erp-label">Operational quality</div>
                  <div className={`erp-mono text-2xl font-semibold leading-tight ${ops.score >= 70 ? "" : "text-nogo"}`}>
                    {ops.score}
                    <span className="text-sm text-faint">/100</span>
                  </div>
                </div>
              </div>
              <div className="text-[12.5px] text-muted mt-2 italic">{classification}</div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
