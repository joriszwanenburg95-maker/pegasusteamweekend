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
  toneForStatus,
  type Tone,
} from "@/components/ui";

const CARGO_LABEL: Record<string, string> = {
  small: "Klein",
  medium: "Middel",
  large: "Groot",
};
const LOAD_LABEL: Record<string, string> = {
  low: "Laag",
  medium: "Gemiddeld",
  high: "Hoog",
};

export default function HistoryPage() {
  const { state } = useStore();
  const cases = state.weekends
    .filter((w) => w.historical || w.phase === "COMPLETED")
    .sort((a, b) => b.departureAt.localeCompare(a.departureAt));

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Archief · Post-mortem"
        title="Lessons Learned"
        subtitle="Afgeronde teamweekenden, beoordeeld op twee onafhankelijke assen: beleving en proces."
      />

      <div className="card-navy stripe px-4 sm:px-5 py-4">
        <div className="erp-label">Kernconclusie</div>
        <p className="text-sm sm:text-base font-bold tracking-tight mt-1">
          GOOD WEEKEND OUTCOME ≠ GOOD OPERATIONAL PLANNING
        </p>
        <p className="text-[13px] text-white/75 mt-1.5 leading-snug">
          Een chaotisch georganiseerd weekend kan alsnog gezellig zijn. Dat is geen bewijs dat de planning klopte —
          het is bewijs dat het team veerkrachtig is. De readiness gate meet het proces, niet de gezelligheid.
        </p>
      </div>

      <Callout tone="neutral" title="Bronvermelding">
        Uitsluitend gedocumenteerde kenmerken zijn gebruikt: accommodatienotities, samenvatting, decision log en de
        vastgelegde lessons learned. Alles wat hier staat komt uit die records of is er rechtstreeks uit berekend.
        Er is niets aangevuld of als feit aangenomen dat niet is vastgelegd; ontbrekende gegevens blijven leeg.
      </Callout>

      {cases.length === 0 ? (
        <EmptyState title="Nog geen afgeronde weekends">
          Zodra een weekend op COMPLETED staat verschijnt hier de case.
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

  return (
    <Card padded={false} className="overflow-hidden">
      <header className="px-4 py-3 border-b border-line flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <div className="erp-label">Case · {w.season} · {w.city}</div>
          <h2 className="text-base font-extrabold tracking-tight text-navy">{w.name}</h2>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <PhaseBadge phase={w.phase} />
          {w.historical && <Badge tone="neutral">HISTORISCHE CASE</Badge>}
          <span className="erp-mono text-[11.5px] text-faint">{formatDate(w.departureAt, { year: "numeric" })}</span>
        </div>
      </header>

      {scores && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-line border-b border-line">
          <div className="bg-elev px-4 py-4">
            <div className="erp-label">Weekend outcome</div>
            <div className="erp-mono text-5xl font-semibold leading-none mt-1 text-navy">
              {scores.out.score.toFixed(1)}
              <span className="text-lg text-faint">/10</span>
            </div>
            <div className="text-[11.5px] text-muted mt-1">Beleving van het team.</div>
          </div>
          <div className="bg-elev px-4 py-4">
            <div className="erp-label">Operational quality</div>
            <div
              className={`erp-mono text-5xl font-semibold leading-none mt-1 ${scores.ops.score >= 70 ? "text-navy" : "text-nogo"}`}
            >
              {scores.ops.score}
              <span className="text-lg text-faint">/100</span>
            </div>
            <div className="text-[11.5px] text-muted mt-1">Kwaliteit van de voorbereiding.</div>
          </div>
          <div className="bg-elev px-4 py-4 flex items-center">
            <div>
              <div className="erp-label">Classificatie</div>
              <div className="text-sm font-bold text-navy mt-1 leading-snug">{scores.classification}</div>
            </div>
          </div>
        </div>
      )}

      <div className="px-4 py-4 space-y-4">
        {w.summary && (
          <section>
            <div className="erp-label mb-1">Gedocumenteerde samenvatting</div>
            <p className="text-[13px] text-muted leading-snug">{w.summary}</p>
          </section>
        )}

        {w.accommodation.notes && (
          <section>
            <div className="erp-label mb-1">Accommodatie — vastgelegde kenmerken</div>
            <p className="text-[13px] text-muted leading-snug">
              <span className="font-semibold text-navy">{w.accommodation.name}</span> ({w.accommodation.type}) —{" "}
              {w.accommodation.notes}
            </p>
          </section>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat
            label="BOB lead time"
            value={
              readiness.bobLeadTimeHours === null
                ? "—"
                : `${Math.round(readiness.bobLeadTimeHours)}u`
            }
            note={readiness.bobLeadTimeLabel}
          />
          <MiniStat
            label="Bob risk index @ departure"
            value={`${bob.score}`}
            note={bob.level}
            tone={toneForStatus(bob.level)}
            title={bob.tooltip}
          />
          <MiniStat label="Group split risk" value={split.level} note={split.reason} tone={toneForStatus(split.level)} />
          <MiniStat
            label="Readiness @ departure"
            value={`${readiness.percent}%`}
            note={`${readiness.failCount} FAIL · ${readiness.unknownCount} UNKNOWN`}
          />
        </div>

        {scores && scores.ops.deductions.length > 0 && (
          <section>
            <div className="erp-label mb-1.5">Operationele aftrekposten</div>
            <div className="overflow-x-auto">
              <table className="erp">
                <thead>
                  <tr>
                    <th>Deduction</th>
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
                  <tr>
                    <td className="font-semibold text-navy">Totaal</td>
                    <td className="text-right erp-mono font-semibold">
                      100 − {scores.ops.deductions.reduce((s, d) => s + d.points, 0)} = {scores.ops.score}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        )}

        {scores && (
          <section>
            <div className="erp-label mb-1.5">Outcome-onderdelen</div>
            <div className="flex flex-wrap gap-2">
              {scores.out.parts.map((p) => (
                <span key={p.label} className="rounded-[4px] border border-line bg-sunken px-2 py-1 text-[12px]">
                  {p.label} <span className="erp-mono font-semibold">{p.value}</span>
                  <span className="text-faint">/10</span>
                </span>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="erp-label mb-1.5">Transportcapaciteit</div>
          <div className="overflow-x-auto">
            <table className="erp">
              <thead>
                <tr>
                  <th>Voertuig</th>
                  <th className="text-right">Stoelen</th>
                  <th>Cargo</th>
                  <th>Bagage</th>
                  <th className="text-right">Effectief</th>
                </tr>
              </thead>
              <tbody>
                {w.vehicles.map((v) => {
                  const eff = effectivePassengerCapacity(v);
                  const seats = Math.min(v.availableSeats, v.nominalSeats);
                  return (
                    <tr key={v.id}>
                      <td className="font-semibold text-navy whitespace-nowrap">{v.name}</td>
                      <td className="text-right erp-mono">{seats}</td>
                      <td>{CARGO_LABEL[v.cargoSize] ?? v.cargoSize}</td>
                      <td>{LOAD_LABEL[v.luggageLoad] ?? v.luggageLoad}</td>
                      <td className="text-right erp-mono font-semibold">
                        {eff < seats ? <span className="text-nogo">{eff}</span> : eff}
                      </td>
                    </tr>
                  );
                })}
                {w.vehicles.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-muted">Geen voertuigen vastgelegd.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11.5px] text-faint mt-1.5">
            Effectieve capaciteit = min(beschikbare, nominale) stoelen − bagagepenalty. Kampeerspullen in een kleine
            auto kosten twee stoelen.
          </p>
        </section>

        {w.decisions.length > 0 && (
          <section>
            <div className="erp-label mb-1.5">
              Decision log · {lastMinute.length} van {w.decisions.length} binnen 24u voor vertrek
            </div>
            <div className="divide-y divide-line border border-line rounded-[6px]">
              {[...w.decisions]
                .sort((a, b) => a.at.localeCompare(b.at))
                .map((d) => (
                  <div key={d.id} className="px-3 py-2 flex flex-wrap items-start gap-2">
                    <span className="erp-mono text-[11.5px] text-faint w-[132px] shrink-0">{formatDateTime(d.at)}</span>
                    <Badge tone="neutral">{d.topic}</Badge>
                    {hoursBetween(d.at, w.departureAt) < 24 && <Badge tone="nogo">LAST-MINUTE</Badge>}
                    <span className="text-[13px] flex-1 min-w-[200px]">{d.summary}</span>
                  </div>
                ))}
            </div>
          </section>
        )}

        {w.retrospective.lessonsLearned.length > 0 && (
          <section>
            <div className="erp-label mb-1.5">Lessons learned</div>
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
          <Link href={`/weekends/${w.slug}/retrospective`} className="btn btn-sm">Retrospective</Link>
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
