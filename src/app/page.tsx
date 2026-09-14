"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { useStore } from "@/store/store";
import type { Weekend } from "@/lib/types";
import {
  analyzeCriticalPath,
  bobRiskIndex,
  estimateBzt,
  evaluateReadiness,
  formatDate,
  formatDateTime,
  formatDuration,
  formatHours,
  groupSplitRisk,
  hoursBetween,
  parseClock,
  primaryNightlife,
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
import { CountUp, Gauge, StackedBar, TimeWindowBar, type Segment, type TimeSpan } from "@/components/viz";
import { nl } from "@/lib/labels";

/** Toon voor de Bob-aanlooptijd-kwalificatie uit de engine. */
function toneForLeadTime(label: string): Tone {
  if (label === "Ruim" || label === "Acceptabel") return "go";
  if (label === "Kort") return "warn";
  if (label === "Extreem kort" || label === "Plan pas definitief ná vertrek") return "nogo";
  return "unknown";
}

/** Hoger = risicovoller: de Bob-index draait de kleurschaal om. */
function toneForBob(level: string): Tone {
  if (level === "NEGLIGIBLE") return "go";
  if (level === "MODERATE" || level === "ELEVATED") return "warn";
  return "nogo";
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

/** Gestapelde balk met de statusverdeling van de gereedheidschecks. */
function checkSegments(r: { passCount: number; warningCount: number; failCount: number; unknownCount: number }): Segment[] {
  return [
    { label: nl("PASS"), value: r.passCount, tone: "go" },
    { label: nl("WARNING"), value: r.warningCount, tone: "warn" },
    { label: nl("FAIL"), value: r.failCount, tone: "nogo" },
    { label: nl("UNKNOWN"), value: r.unknownCount, tone: "unknown" },
  ];
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
        title="Controlekamer"
        subtitle="Nijmegen · Ark van Oost — gereedheidspoort, BZT-optimalisatie en Bob-risico-index voor elk teamweekend."
        actions={
          <>
            <Link href="/intro" className="btn btn-primary">
              Waarom dit systeem?
            </Link>
            <Link href="/weekends" className="btn">
              Alle weekenden
            </Link>
            <Link href="/glossary" className="btn">
              Begrippen
            </Link>
          </>
        }
      />

      {next ? <NextWeekendHero weekend={next} now={now} /> : (
        <EmptyState title="Geen weekend in planning">
          <Link href="/weekends" className="underline">
            Maak een nieuw weekend aan
          </Link>{" "}
          om de gereedheidspoort te activeren.
        </EmptyState>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-5 gap-3 rise rise-2">
        <Kpi label="In planning" value={<CountUp value={open.length} />} sub="Nog niet afgerond" />
        <Kpi
          label="Gereed / vergrendeld"
          value={<CountUp value={readyCount} />}
          tone={readyCount > 0 ? "go" : undefined}
          sub="Fase GEREED of VERGRENDELD"
        />
        <Kpi label="Afgerond" value={<CountUp value={completed.length} />} sub="Met terugblik in het archief" />
        <Kpi
          label="Gem. operationele kwaliteit"
          value={avgOps === null ? "—" : <CountUp value={avgOps} />}
          unit={avgOps === null ? undefined : "/100"}
          tone={avgOps === null ? undefined : toneForPercent(avgOps)}
          sub="Gemiddelde van ingevulde terugblikken"
        />
        <Kpi
          label="Gem. weekendbeleving"
          value={avgOutcome === null ? "—" : <CountUp value={avgOutcome} decimals={1} />}
          unit={avgOutcome === null ? undefined : "/10"}
          sub="Beleving, los van het proces"
        />
      </div>

      <ReadinessBoard weekends={open} now={now} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {next ? <DeadlinesCard weekend={next} now={now} /> : null}
        <HistoricalBenchmark rows={scored} />
      </div>

      <div className="card-navy stripe px-4 py-3 text-center rise rise-6">
        <div className="erp-label">Grondbeginsel</div>
        <div className="text-[13px] sm:text-sm font-bold tracking-tight mt-0.5">
          EEN GOED WEEKEND ≠ EEN GOED GEORGANISEERD WEEKEND
        </div>
        <div className="text-[11.5px] text-white/55 mt-1">HUP BLAUW. Operationele excellentie sinds 1998.</div>
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
  const days = Math.abs(hours) / 24;
  const base = `/weekends/${weekend.slug}`;

  return (
    <section className="card-navy stripe px-4 sm:px-5 py-4 rise rise-1">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="erp-label">Eerstvolgend · {weekend.season} · {weekend.city || "locatie n.t.b."}</div>
          <h2 className="text-lg sm:text-xl font-extrabold tracking-tight mt-0.5">{weekend.name}</h2>
          <div className="erp-mono text-[12px] text-white/65 mt-1">
            Vertrek {formatDateTime(weekend.departureAt)}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PhaseBadge phase={weekend.phase} />
          <StatusBadge status={readiness.gate} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        <HeroTile label="Gereedheid" note={`${readiness.passCount}/${readiness.checks.length} checks ${nl("PASS")}`}>
          <Gauge
            value={readiness.percent}
            size={104}
            tone={toneForPercent(readiness.percent)}
            suffix="%"
            track="rgba(255,255,255,0.14)"
            textColor="#fff"
          />
        </HeroTile>
        <HeroTile label="Bob-risico-index" note={`${nl(bob.level)} · ${bob.tooltip}`} title={bob.primaryDriver}>
          <Gauge
            value={bob.score}
            size={104}
            tone={toneForBob(bob.level)}
            track="rgba(255,255,255,0.14)"
            textColor="#fff"
          />
        </HeroTile>
        <HeroTile
          label={hours < 0 ? "Verstreken" : "Tot vertrek"}
          note={`${formatHours(Math.abs(hours))} · groepssplitsingsrisico ${nl(split.level)}`}
        >
          <div className="text-center leading-none py-3">
            <div className="erp-mono text-5xl font-semibold">
              <CountUp value={days} decimals={days < 2 ? 1 : 0} />
            </div>
            <div className="erp-label mt-1.5">dagen</div>
          </div>
        </HeroTile>
        <HeroTile
          label="BZT netto"
          note={bzt.splitPenaltyMin > 0 ? `−${formatDuration(bzt.splitPenaltyMin)} door splitsing` : "Geen splitsingsaftrek"}
        >
          <div className="text-center leading-none py-3">
            <div className="erp-mono text-5xl font-semibold">
              <CountUp value={bzt.netMin / 60} decimals={1} />
            </div>
            <div className="erp-label mt-1.5">uur bier</div>
          </div>
        </HeroTile>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mt-3">
        <div className="rounded-[6px] bg-elev text-fg px-3 py-2.5">
          <div className="text-[0.68rem] tracking-[0.12em] uppercase font-semibold text-faint mb-1.5">Avondvenster</div>
          <EveningBar weekend={weekend} />
        </div>
        <div className="rounded-[6px] bg-elev text-fg px-3 py-2.5 flex flex-col justify-center">
          <div className="text-[0.68rem] tracking-[0.12em] uppercase font-semibold text-faint mb-1.5">Status van de {readiness.checks.length} checks</div>
          <StackedBar segments={checkSegments(readiness)} height={16} />
        </div>
      </div>

      <p className="text-[13px] leading-snug text-white/80 mt-3 border-t border-white/10 pt-3">
        <span className="erp-label mr-2">Risico</span>
        {readiness.riskNarrative}
      </p>

      <div className="flex flex-wrap gap-2 mt-3">
        <Link href={base} className="btn btn-primary">
          Open weekend <ArrowRight size={14} />
        </Link>
        <Link href={`${base}/readiness`} className="btn">
          <ShieldCheck size={14} /> Gereedheidspoort
        </Link>
      </div>
    </section>
  );
}

function HeroTile({
  label,
  note,
  title,
  children,
}: {
  label: string;
  note?: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[6px] bg-white/5 border border-white/10 px-3 py-2.5 flex flex-col items-center text-center" title={title}>
      <div className="erp-label">{label}</div>
      <div className="my-1">{children}</div>
      {note && <div className="text-[11px] text-white/60 leading-snug">{note}</div>}
    </div>
  );
}

/** Tijdbalk van diner via EERSTE BIER tot sluiting van de primaire avondlocatie. */
function EveningBar({ weekend }: { weekend: Weekend }) {
  const path = analyzeCriticalPath(weekend);
  const night = primaryNightlife(weekend);
  const bzt = estimateBzt(weekend);
  const firstBeer = bzt.firstBeerClock ? parseClock(bzt.firstBeerClock) : null;
  const closesRaw = night ? parseClock(night.closesAt) : null;

  if (firstBeer === null || closesRaw === null) {
    return (
      <div className="text-[12px] text-muted leading-snug">
        Geen EERSTE BIER op het kritieke pad of geen sluitingstijd bekend.
      </div>
    );
  }

  const closes = closesRaw <= firstBeer ? closesRaw + 24 * 60 : closesRaw;
  const dinnerStart = weekend.dinner.known ? parseClock(weekend.dinner.time) : null;
  const spans: TimeSpan[] = [];
  if (dinnerStart !== null) {
    spans.push({
      label: "Diner",
      fromMin: dinnerStart,
      toMin: dinnerStart + (weekend.dinner.durationMin || 90),
      tone: "navy",
    });
  }
  const netEnd = firstBeer + Math.max(0, bzt.netMin);
  spans.push({ label: formatDuration(bzt.netMin), fromMin: firstBeer, toMin: netEnd, tone: "go" });
  if (bzt.splitPenaltyMin > 0) {
    spans.push({ label: "verlies", fromMin: netEnd, toMin: netEnd + bzt.splitPenaltyMin, tone: "warn", hatched: true });
  }

  const earliest = dinnerStart !== null ? Math.min(dinnerStart, firstBeer) : firstBeer;
  const startMin = Math.floor(earliest / 60) * 60 - 60;
  const endMin = Math.ceil(closes / 60) * 60 + 60;

  return (
    <>
      <TimeWindowBar
        spans={spans}
        startMin={startMin}
        endMin={endMin}
        markers={[
          { atMin: firstBeer, label: "EERSTE BIER", tone: "go" },
          { atMin: closes, label: "SLUITING", tone: "nogo" },
        ]}
      />
      <div className="text-[11px] text-muted mt-1 leading-snug">
        {night?.name} sluit {night?.closesAt}
        {path.minutesToFirstBeer !== null && ` · ${formatDuration(path.minutesToFirstBeer)} van ${weekend.match.hasMatch ? "einde wedstrijd" : "aankomst"} tot eerste bier`}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function ReadinessBoard({ weekends, now }: { weekends: Weekend[]; now: string }) {
  const rows = [...weekends].sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  return (
    <Card
      eyebrow="Poortbewaking"
      title="Gereedheidsbord"
      padded={false}
      className="rise rise-3"
      actions={
        <Link href="/weekends" className="btn btn-sm">
          Beheer
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted">Geen openstaande weekenden.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th>Weekend</th>
                <th>Vertrek</th>
                <th>Fase</th>
                <th>GO / NO GO</th>
                <th className="text-right">Gereedheid</th>
                <th className="text-right">Fouten</th>
                <th className="text-right">Bob</th>
                <th>Bob-aanlooptijd</th>
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
    <Card eyebrow={weekend.name} title="Deadlines" padded={false} className="rise rise-4">
      <div className="divide-y divide-line">
        {r.deadlines.map((d) => (
          <div key={d.key} className="px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="erp-mono text-sm font-semibold text-navy w-[96px]">{nl(d.key)}</span>
              <StatusBadge status={d.status} />
              <span className="erp-mono text-[11.5px] text-faint ml-auto whitespace-nowrap">
                {formatDateTime(d.at)} · {d.passed ? "verstreken" : formatHours(d.hoursUntil)}
              </span>
            </div>
            <div className="text-[12px] text-muted mt-1 leading-snug">
              {d.missing.length === 0 ? (
                <span className="text-go font-semibold">Alles op {nl("PASS")}.</span>
              ) : (
                <>
                  <span className="erp-label mr-1">Ontbreekt</span>
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
      title="Historie"
      className="rise rise-5"
      actions={
        <Link href="/history" className="btn btn-sm">
          Geleerde lessen
        </Link>
      }
    >
      {rows.length === 0 ? (
        <div className="text-sm text-muted">Nog geen afgeronde weekenden met terugblik.</div>
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
              <div className="flex flex-wrap items-center gap-4 mt-2">
                <Gauge
                  value={out.score}
                  max={10}
                  size={88}
                  decimals={1}
                  tone={out.score >= 7.5 ? "go" : "warn"}
                  label="Beleving"
                />
                <Gauge
                  value={ops.score}
                  max={100}
                  size={88}
                  tone={toneForPercent(ops.score)}
                  label="Kwaliteit"
                />
                <p className="text-[12.5px] text-muted italic flex-1 min-w-[160px]">{classification}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
