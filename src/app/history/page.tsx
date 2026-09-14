"use client";

import Link from "next/link";
import { useStore } from "@/store/store";
import type { Weekend } from "@/lib/types";
import {
  bobRiskIndex,
  effectivePassengerCapacity,
  evaluateReadiness,
  formatDate,
  formatDateTime,
  groupSplitRisk,
  hoursBetween,
  retrospectiveScores,
} from "@/lib/engine";
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  PageHeader,
  PhaseBadge,
  toneForPercent,
  toneForStatus,
  type Tone,
} from "@/components/ui";
import { Gauge, SeatGrid, StackedBar, type Segment } from "@/components/viz";
import { nl } from "@/lib/labels";

/** Vaste kleurenreeks voor de aftrekposten; de rest van de 100 punten blijft groen. */
const DEDUCTION_COLORS = [
  "var(--nogo)",
  "var(--warn)",
  "var(--pegasus-cobalt)",
  "var(--pegasus-navy)",
  "var(--pegasus-sky)",
  "var(--pegasus-silver)",
];

export default function HistoryPage() {
  const { state } = useStore();
  const cases = state.weekends
    .filter((w) => w.historical || w.phase === "COMPLETED")
    .sort((a, b) => b.departureAt.localeCompare(a.departureAt));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Archief · Nabeschouwing"
        title="Geleerde lessen"
        subtitle="Afgeronde teamweekenden op twee onafhankelijke assen: beleving en proces."
      />

      <div className="card-navy stripe px-4 sm:px-5 py-4 rise rise-1">
        <div className="erp-label">Kernconclusie</div>
        <p className="text-sm sm:text-base font-bold tracking-tight mt-1">
          EEN GOED WEEKEND ≠ EEN GOED GEORGANISEERD WEEKEND
        </p>
        <p className="text-[13px] text-white/75 mt-1.5 leading-snug">
          Gezellig geworden bewijst dat het team veerkrachtig is, niet dat de planning klopte.
        </p>
      </div>

      <Callout tone="neutral" title="Bronvermelding">
        Alleen vastgelegde kenmerken: notities, samenvatting, besluitenlog en terugblik. Niets aangevuld; ontbrekende
        gegevens blijven leeg.
      </Callout>

      {cases.length === 0 ? (
        <EmptyState title="Nog geen afgeronde weekenden">
          Zodra een weekend op {nl("COMPLETED")} staat verschijnt hier de casus.
        </EmptyState>
      ) : (
        cases.map((w) => <CaseCard key={w.id} weekend={w} />)
      )}
    </div>
  );
}

function CaseCard({ weekend: w }: { weekend: Weekend }) {
  const readiness = evaluateReadiness(w, w.departureAt);
  const bob = bobRiskIndex(w, w.departureAt);
  const split = groupSplitRisk(w);
  const scores = w.retrospective.filled ? retrospectiveScores(w.retrospective, w) : null;
  const lastMinute = w.decisions.filter((d) => hoursBetween(d.at, w.departureAt) < 24);

  const deductionSegments: Segment[] = scores
    ? [
        ...scores.ops.deductions.map((d, i) => ({
          label: d.label,
          value: d.points,
          color: DEDUCTION_COLORS[i % DEDUCTION_COLORS.length],
        })),
        { label: "Resterend", value: scores.ops.score, tone: "go" as const },
      ]
    : [];

  return (
    <Card padded={false} className="overflow-hidden rise rise-2">
      <header className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <div className="erp-label">Casus · {w.season} · {w.city}</div>
          <h2 className="text-base font-extrabold tracking-tight text-navy">{w.name}</h2>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PhaseBadge phase={w.phase} />
          {w.historical && <Badge tone="neutral">HISTORISCHE CASUS</Badge>}
          <span className="erp-mono text-[11.5px] text-faint">{formatDate(w.departureAt, { year: "numeric" })}</span>
        </div>
      </header>

      {scores && (
        <div className="px-4 py-4 border-b border-line flex flex-wrap items-center gap-6">
          <Gauge
            value={scores.out.score}
            max={10}
            size={124}
            decimals={1}
            tone={scores.out.score >= 7.5 ? "go" : "warn"}
            label="Weekendbeleving"
            sublabel="/ 10"
          />
          <Gauge
            value={scores.ops.score}
            max={100}
            size={124}
            tone={toneForPercent(scores.ops.score)}
            label="Operationele kwaliteit"
            sublabel="/ 100"
          />
          <div className="flex-1 min-w-[200px]">
            <div className="erp-label">Classificatie</div>
            <div className="text-sm font-bold text-navy mt-1 leading-snug">{scores.classification}</div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {scores.out.parts.map((p) => (
                <span key={p.label} className="rounded-[4px] border border-line bg-sunken px-1.5 py-0.5 text-[11px]">
                  {p.label} <span className="erp-mono font-semibold">{p.value}</span>
                  <span className="text-faint">/10</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat
            label="Bob-aanlooptijd"
            value={readiness.bobLeadTimeHours === null ? "—" : `${Math.round(readiness.bobLeadTimeHours)}u`}
            note={readiness.bobLeadTimeLabel}
          />
          <MiniStat
            label="Bob-index bij vertrek"
            value={`${bob.score}`}
            note={nl(bob.level)}
            tone={toneForStatus(bob.level)}
            title={bob.tooltip}
          />
          <MiniStat
            label="Groepssplitsingsrisico"
            value={nl(split.level)}
            note={split.reason}
            tone={toneForStatus(split.level)}
          />
          <MiniStat
            label="Gereedheid bij vertrek"
            value={`${readiness.percent}%`}
            note={`${readiness.failCount}× ${nl("FAIL")} · ${readiness.unknownCount}× ${nl("UNKNOWN")}`}
            tone={toneForPercent(readiness.percent)}
          />
        </div>

        {w.summary && (
          <section>
            <div className="erp-label mb-1">Vastgelegde samenvatting</div>
            <p className="text-[13px] text-muted leading-snug">{w.summary}</p>
          </section>
        )}

        {w.accommodation.notes && (
          <section>
            <div className="erp-label mb-1">Accommodatie</div>
            <p className="text-[13px] text-muted leading-snug">
              <span className="font-semibold text-navy">{w.accommodation.name}</span> ({nl(w.accommodation.type)}) —{" "}
              {w.accommodation.notes}
            </p>
          </section>
        )}

        {scores && scores.ops.deductions.length > 0 && (
          <section>
            <div className="erp-label mb-1.5">Aftrekposten · 100 − {100 - scores.ops.score} = {scores.ops.score}</div>
            <StackedBar segments={deductionSegments} height={18} formatValue={(v) => `${v} pt`} />
            <div className="overflow-x-auto mt-2.5">
              <table className="erp">
                <thead>
                  <tr>
                    <th>Aftrekpost</th>
                    <th className="text-right">Punten</th>
                  </tr>
                </thead>
                <tbody>
                  {scores.ops.deductions.map((d) => (
                    <tr key={d.label}>
                      <td>{d.label}</td>
                      <td className="text-right erp-mono text-nogo font-semibold">−{d.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        <section>
          <div className="erp-label mb-1.5">Vervoerscapaciteit</div>
          {w.vehicles.length === 0 ? (
            <p className="text-[13px] text-muted">Geen voertuigen vastgelegd.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {w.vehicles.map((v) => {
                const eff = effectivePassengerCapacity(v);
                const lost = Math.max(0, v.nominalSeats - eff);
                const filled = v.passengerIds.filter((id) => id !== v.driverId).length;
                return (
                  <div key={v.id} className="rounded-[6px] border border-line bg-sunken px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-navy text-[13px] truncate">{v.name}</span>
                      <span className="erp-mono text-[11px] text-faint ml-auto whitespace-nowrap">
                        {filled}/{eff}
                      </span>
                    </div>
                    <div className="mt-2">
                      <SeatGrid seats={v.nominalSeats} filled={filled} lost={lost} />
                    </div>
                    <div className="text-[11px] text-muted mt-1.5">
                      Bagage {nl(v.cargoSize)} · lading {nl(v.luggageLoad)}
                      {lost > 0 && <span className="text-nogo font-semibold"> · −{lost} stoel(en)</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[11.5px] text-faint mt-1.5">
            Blauw = ingedeeld, gearceerd = door bagage verloren, leeg = vrij. Kampeerspullen in een kleine auto kosten
            twee stoelen.
          </p>
        </section>

        {w.decisions.length > 0 && (
          <section>
            <div className="erp-label mb-2">
              Besluitenlog · {lastMinute.length} van {w.decisions.length} binnen 24u voor vertrek
            </div>
            <ol className="relative border-l-2 border-line ml-2 space-y-3">
              {[...w.decisions]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map((d) => {
                  const late = hoursBetween(d.at, w.departureAt) < 24;
                  return (
                    <li key={d.id} className="pl-4 relative">
                      <span
                        className={`absolute -left-[7px] top-1.5 w-3 h-3 rounded-full border-2 border-elev ${late ? "bg-nogo" : "bg-cobalt"}`}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="erp-mono text-[11.5px] text-faint">{formatDateTime(d.at)}</span>
                        <Badge tone="neutral">{nl(d.topic)}</Badge>
                        {late && <Badge tone="nogo">LAST-MINUTE</Badge>}
                      </div>
                      <p className="text-[13px] mt-0.5 leading-snug">{d.summary}</p>
                    </li>
                  );
                })}
            </ol>
          </section>
        )}

        {w.retrospective.lessonsLearned.length > 0 && (
          <section>
            <div className="erp-label mb-1.5">Geleerde lessen</div>
            <ol className="space-y-1.5 text-[13px] text-fg">
              {w.retrospective.lessonsLearned.map((l, i) => (
                <li key={i} className="flex gap-2">
                  <span className="erp-mono text-faint shrink-0">{String(i + 1).padStart(2, "0")}</span>
                  <span>{l}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="flex flex-wrap gap-2 pt-1">
          <Link href={`/weekends/${w.slug}`} className="btn btn-sm">Open weekenddossier</Link>
          <Link href={`/weekends/${w.slug}/retrospective`} className="btn btn-sm">Terugblik</Link>
          <Link href="/glossary" className="btn btn-sm">Begrippen</Link>
        </div>
      </div>
    </Card>
  );
}

function MiniStat({
  label,
  value,
  note,
  tone,
  title,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: Tone;
  title?: string;
}) {
  const color = tone === "go" ? "text-go" : tone === "warn" ? "text-warn" : tone === "nogo" ? "text-nogo" : "text-navy";
  return (
    <div className="rounded-[6px] border border-line bg-sunken px-3 py-2" title={title}>
      <div className="erp-label">{label}</div>
      <div className={`erp-mono text-xl font-semibold leading-tight mt-0.5 ${color}`}>{value}</div>
      {note && <div className="text-[11.5px] text-muted leading-snug mt-1">{note}</div>}
    </div>
  );
}
