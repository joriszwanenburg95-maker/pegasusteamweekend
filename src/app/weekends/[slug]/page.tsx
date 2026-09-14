"use client";

import Link from "next/link";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import type { Attendance, Weekend } from "@/lib/types";
import {
  analyzeCriticalPath,
  assessTransport,
  bobRiskIndex,
  estimateBzt,
  evaluateReadiness,
  formatDateTime,
  formatDuration,
  groupSplitRisk,
  headcount,
  hoursBetween,
  retrospectiveScores,
} from "@/lib/engine";
import {
  Badge,
  Callout,
  Card,
  EmptyState,
  Kpi,
  StatusBadge,
  toneForPercent,
  toneForStatus,
  type Tone,
} from "@/components/ui";
import { CountUp, DotRow, Gauge } from "@/components/viz";
import { nl } from "@/lib/labels";

type AttendanceKey = "match" | "weekend" | "overnight" | "sunday" | "dinner";

const ATTENDANCE_ROWS: { key: AttendanceKey; label: string }[] = [
  { key: "match", label: "Wedstrijd" },
  { key: "weekend", label: "Weekend" },
  { key: "overnight", label: "Overnachting" },
  { key: "sunday", label: "Zondag" },
  { key: "dinner", label: "Diner" },
];

/** Aanwezigheid gegroepeerd weergeven: eerst wie meegaat, dan onbekend, dan afwezig. */
const ORDER: Record<Attendance, number> = { going: 0, unknown: 1, notGoing: 2 };

/** Hoger = risicovoller: de Bob-index draait de kleurschaal om. */
function toneForBob(score: number): Tone {
  if (score >= 70) return "nogo";
  if (score >= 25) return "warn";
  return "go";
}

export default function WeekendOverviewPage() {
  const { weekend, now } = useCurrentWeekend();
  if (!weekend) return <EmptyState title="Weekend niet gevonden" />;
  return <Overview weekend={weekend} now={now} />;
}

function Overview({ weekend: w, now }: { weekend: Weekend; now: string }) {
  const readiness = evaluateReadiness(w, now);
  const bob = bobRiskIndex(w, now);
  const bzt = estimateBzt(w);
  const split = groupSplitRisk(w);
  const hc = headcount(w);
  const transport = assessTransport(w);
  const path = analyzeCriticalPath(w);
  const base = `/weekends/${w.slug}`;

  return (
    <div className="space-y-4">
      {w.summary && (
        <Callout tone="neutral" title="Samenvatting">
          {w.summary}
        </Callout>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[auto_auto_1fr] gap-3 items-stretch rise rise-1">
        <Card className="flex flex-col items-center justify-center py-4 px-5">
          <Gauge
            value={readiness.percent}
            size={132}
            suffix="%"
            tone={toneForPercent(readiness.percent)}
            label="Gereedheid"
          />
          <div className="text-[11.5px] text-muted mt-1.5 text-center">
            {readiness.passCount}/{readiness.checks.length} checks {nl("PASS")}
          </div>
        </Card>
        <Card className="flex flex-col items-center justify-center py-4 px-5">
          <Gauge
            value={bob.score}
            size={132}
            tone={toneForBob(bob.score)}
            label="Bob-index"
            sublabel={nl(bob.level)}
          />
          <div className="text-[11.5px] text-muted mt-1.5 text-center max-w-[190px]" title={bob.primaryDriver}>
            {bob.tooltip}
          </div>
        </Card>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Kpi
            label="GO / NO GO"
            value={<StatusBadge status={readiness.gate} />}
            sub={readiness.canLock ? `Mag ${nl("LOCKED")}` : `${readiness.lockBlockers.length} blokkade(s)`}
          />
          <Kpi
            label="BZT netto"
            value={<CountUp value={bzt.netMin} />}
            unit="min"
            sub={bzt.firstBeerClock ? `Eerste bier ${bzt.firstBeerClock}, sluit ${bzt.closesAt}` : "Geen EERSTE BIER op het pad"}
          />
          <Kpi
            label="Groepssplitsingsrisico"
            value={<span className="text-base">{nl(split.level)}</span>}
            tone={toneForStatus(split.level)}
            sub={split.reason}
          />
          <Kpi
            label="Tot eerste bier"
            value={path.minutesToFirstBeer === null ? "—" : <CountUp value={path.minutesToFirstBeer} />}
            unit={path.minutesToFirstBeer === null ? undefined : "min"}
            sub={
              path.minutesToFirstBeer === null
                ? "Kritiek pad bevat geen BZT-stap"
                : `Vanaf ${w.match.hasMatch ? "einde wedstrijd" : "aankomst"} · pad ${formatDuration(path.totalMin)}`
            }
          />
          <Kpi
            label="Deelnemers weekend"
            value={<CountUp value={hc.weekend.going} />}
            unit={`mee · ${hc.weekend.unknown} onbekend`}
            tone={hc.weekend.unknown > 0 ? "warn" : "go"}
            sub={hc.locked ? `Vergrendeld ${formatDateTime(hc.lockedAt ?? now)}` : "Aantal nog niet vergrendeld"}
          />
          <Kpi
            label="Vervoer"
            value={<span className="text-base">{nl(transport.status)}</span>}
            tone={toneForStatus(transport.status)}
            sub={`${transport.totalEffectiveCapacity} effectieve stoelen / ${transport.travelers} passagiers`}
          />
        </div>
      </div>

      <Card
        eyebrow="Poort"
        title="Gereedheidschecks"
        padded={false}
        className="rise rise-2"
        actions={
          <Link href={`${base}/readiness`} className="btn btn-sm">
            Open gereedheid
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
                <th>Toelichting</th>
                <th>Blokkerend</th>
              </tr>
            </thead>
            <tbody>
              {readiness.checks.map((c) => (
                <tr key={c.key}>
                  <td className="font-semibold text-navy whitespace-nowrap">{c.label}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="text-[12px] text-muted">{c.detail}</td>
                  <td className="text-[11px] text-faint whitespace-nowrap">{c.gating ? "JA" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card eyebrow="Context" title="Wedstrijd" className="rise rise-3">
          {!w.match.hasMatch ? (
            <div className="text-sm text-muted">
              Geen wedstrijd — puur teamweekend. Het kritieke pad start bij aankomst, niet bij EINDE WEDSTRIJD.
            </div>
          ) : (
            <dl className="grid grid-cols-[140px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <Detail label="Tegenstander" value={w.match.opponent || "n.t.b."} />
              <Detail label="Locatie" value={w.match.venue || "n.t.b."} />
              <Detail label="Stad" value={w.match.city || "n.t.b."} />
              <Detail label="Start" value={formatDateTime(w.match.matchStart)} mono />
              <Detail label="Einde (schatting)" value={formatDateTime(w.match.matchEnd)} mono />
              <Detail label="Uit / thuis" value={w.match.isAway ? "UIT" : "THUIS"} />
              <Detail label="Reistijd naar slaapplek" value={`${w.accommodation.travelFromVenueMin} min`} mono />
            </dl>
          )}
        </Card>

        <Card eyebrow="Deelname" title="Aanwezigheid" className="rise rise-4">
          <div className="space-y-2.5">
            {ATTENDANCE_ROWS.map((r) => {
              const c = hc[r.key];
              const values = w.participants
                .map((p) => p[r.key])
                .sort((a, b) => ORDER[a] - ORDER[b]);
              return (
                <div key={r.key}>
                  <div className="flex items-baseline gap-2 text-[12px]">
                    <span className="font-semibold text-navy w-[104px] shrink-0">{r.label}</span>
                    <span className="erp-mono text-go font-semibold">{c.going}</span>
                    <span className="text-faint">mee</span>
                    {c.unknown > 0 && (
                      <>
                        <span className="erp-mono text-warn font-semibold">{c.unknown}</span>
                        <span className="text-faint">onbekend</span>
                      </>
                    )}
                    <span className="erp-mono text-faint ml-auto">{c.notGoing} niet</span>
                  </div>
                  <div className="mt-1">
                    <DotRow values={values} size={11} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-3 pt-2.5 border-t border-line text-[11px] text-muted">
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-go inline-block" /> {nl("going")}</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-unknown/40 border border-unknown/60 inline-block" /> {nl("unknown")}</span>
            <span className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-nogo/70 inline-block" /> {nl("notGoing")}</span>
            <span className="ml-auto">{hc.total} spelers · {hc.travelers} in teamvervoer · {hc.drivers} chauffeur(s)</span>
          </div>
        </Card>
      </div>

      <DecisionLog weekend={w} />

      {w.phase === "COMPLETED" && w.retrospective.filled && <RetrospectiveSummary weekend={w} />}
    </div>
  );
}

function Detail({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <>
      <dt className="erp-label self-center">{label}</dt>
      <dd className={mono ? "erp-mono" : ""}>{value}</dd>
    </>
  );
}

function DecisionLog({ weekend: w }: { weekend: Weekend }) {
  const rows = [...w.decisions].sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card eyebrow="Audit trail" title="Besluitenlog" className="rise rise-5">
      {rows.length === 0 ? (
        <div className="py-4 text-sm text-muted">Nog geen besluiten vastgelegd.</div>
      ) : (
        <ol className="relative border-l-2 border-line ml-2 space-y-3">
          {rows.map((d) => {
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
      )}
      <div className="text-[11.5px] text-faint mt-3 pt-2 border-t border-line">
        LAST-MINUTE = besluit binnen 24 uur voor vertrek ({formatDateTime(w.departureAt)}).
      </div>
    </Card>
  );
}

function RetrospectiveSummary({ weekend: w }: { weekend: Weekend }) {
  const { ops, out, classification } = retrospectiveScores(w.retrospective, w);
  return (
    <Card
      eyebrow="Afgerond"
      title="Terugblik"
      className="rise rise-6"
      actions={<Link href={`/weekends/${w.slug}/retrospective`} className="btn btn-sm">Details</Link>}
    >
      <div className="flex flex-wrap items-center gap-5">
        <Gauge
          value={out.score}
          max={10}
          size={104}
          decimals={1}
          tone={out.score >= 7.5 ? "go" : "warn"}
          label="Beleving"
        />
        <Gauge value={ops.score} max={100} size={104} tone={toneForPercent(ops.score)} label="Kwaliteit" />
        <div className="flex-1 min-w-[180px]">
          <div className="text-[13px] text-muted italic">{classification}</div>
          {w.retrospective.lessonsLearned.length > 0 && (
            <ul className="mt-2 space-y-1 text-[12.5px] text-muted list-disc pl-4">
              {w.retrospective.lessonsLearned.slice(0, 3).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          )}
          <Link href="/history" className="text-[12px] text-cobalt font-semibold hover:underline inline-block mt-2">
            Naar Geleerde lessen →
          </Link>
        </div>
      </div>
    </Card>
  );
}
