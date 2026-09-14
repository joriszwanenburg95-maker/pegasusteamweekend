"use client";

import Link from "next/link";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import type { Weekend } from "@/lib/types";
import {
  analyzeCriticalPath,
  assessTransport,
  bobRiskIndex,
  estimateBzt,
  evaluateReadiness,
  formatDateTime,
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
} from "@/components/ui";

const ATTENDANCE_ROWS: {
  key: keyof Pick<Weekend["participants"][number], "match" | "weekend" | "overnight" | "sunday" | "dinner">;
  label: string;
}[] = [
  { key: "match", label: "Wedstrijd" },
  { key: "weekend", label: "Weekend" },
  { key: "overnight", label: "Overnachting" },
  { key: "sunday", label: "Zondag" },
  { key: "dinner", label: "Diner" },
];

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
        <Callout tone="neutral" title="Summary">
          {w.summary}
        </Callout>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi
          label="Readiness"
          value={readiness.percent}
          unit="%"
          tone={toneForPercent(readiness.percent)}
          sub={`${readiness.passCount}/${readiness.checks.length} checks PASS`}
        />
        <Kpi label="Gate" value={<StatusBadge status={readiness.gate} />} sub={readiness.canLock ? "Mag LOCKED" : `${readiness.lockBlockers.length} blocker(s)`} />
        <Kpi
          label="Bob risk index"
          value={bob.score}
          unit={`/100 · ${bob.level}`}
          sub={bob.tooltip}
        />
        <Kpi
          label="BZT netto"
          value={bzt.netMin}
          unit="min"
          sub={bzt.firstBeerClock ? `First beer ${bzt.firstBeerClock}, sluit ${bzt.closesAt}` : "Geen FIRST BEER op het pad"}
        />
        <Kpi
          label="Group split risk"
          value={<span className="text-base">{split.level}</span>}
          tone={toneForStatus(split.level)}
          sub={split.reason}
        />
        <Kpi
          label="Minutes to first beer"
          value={path.minutesToFirstBeer === null ? "—" : path.minutesToFirstBeer}
          unit={path.minutesToFirstBeer === null ? undefined : "min"}
          sub={path.minutesToFirstBeer === null ? "Critical path bevat geen BZT-stap" : `Vanaf ${w.match.hasMatch ? "match end" : "aankomst"}`}
        />
        <Kpi
          label="Headcount weekend"
          value={hc.weekend.going}
          unit={`going · ${hc.weekend.unknown} unknown`}
          sub={hc.locked ? `Locked ${formatDateTime(hc.lockedAt ?? now)}` : "Headcount niet gelocked"}
        />
        <Kpi
          label="Transport"
          value={<span className="text-base">{transport.status}</span>}
          tone={toneForStatus(transport.status)}
          sub={`${transport.totalEffectiveCapacity} effectieve stoelen / ${transport.travelers} passagiers`}
        />
      </div>

      <Card
        eyebrow="Gate"
        title="Readiness checklist"
        padded={false}
        actions={
          <Link href={`${base}/readiness`} className="btn btn-sm">
            Open readiness
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th>Check</th>
                <th>Status</th>
                <th>Detail</th>
                <th>Gating</th>
              </tr>
            </thead>
            <tbody>
              {readiness.checks.map((c) => (
                <tr key={c.key}>
                  <td className="font-semibold text-navy whitespace-nowrap">{c.label}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="text-[12px] text-muted">{c.detail}</td>
                  <td className="text-[11px] text-faint whitespace-nowrap">{c.gating ? "GATING" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card eyebrow="Context" title="Match context">
          {!w.match.hasMatch ? (
            <div className="text-sm text-muted">
              Geen wedstrijd — puur teamweekend. Het critical path start bij aankomst, niet bij match end.
            </div>
          ) : (
            <dl className="grid grid-cols-[130px_1fr] gap-x-3 gap-y-1.5 text-[13px]">
              <Detail label="Tegenstander" value={w.match.opponent || "n.t.b."} />
              <Detail label="Locatie" value={w.match.venue || "n.t.b."} />
              <Detail label="Stad" value={w.match.city || "n.t.b."} />
              <Detail label="Start" value={formatDateTime(w.match.matchStart)} mono />
              <Detail label="Einde (schatting)" value={formatDateTime(w.match.matchEnd)} mono />
              <Detail label="Uit / thuis" value={w.match.isAway ? "UIT" : "THUIS"} />
              <Detail
                label="Reistijd venue → slaapplek"
                value={`${w.accommodation.travelFromVenueMin} min`}
                mono
              />
            </dl>
          )}
        </Card>

        <Card eyebrow="Deelname" title="Attendance" padded={false}>
          <div className="overflow-x-auto">
            <table className="erp">
              <thead>
                <tr>
                  <th>Onderdeel</th>
                  <th className="text-right">Going</th>
                  <th className="text-right">Not going</th>
                  <th className="text-right">Unknown</th>
                </tr>
              </thead>
              <tbody>
                {ATTENDANCE_ROWS.map((r) => {
                  const c = hc[r.key];
                  return (
                    <tr key={r.key}>
                      <td className="font-semibold text-navy">{r.label}</td>
                      <td className="text-right erp-mono">{c.going}</td>
                      <td className="text-right erp-mono text-faint">{c.notGoing}</td>
                      <td className="text-right erp-mono">
                        {c.unknown > 0 ? <span className="text-warn font-semibold">{c.unknown}</span> : 0}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 text-[11.5px] text-faint border-t border-line">
            {hc.total} spelers in de roster · {hc.travelers} reizen mee in teamvervoer · {hc.drivers} chauffeur(s).
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
    <Card eyebrow="Audit trail" title="Decision log" padded={false}>
      {rows.length === 0 ? (
        <div className="px-4 py-6 text-sm text-muted">Nog geen besluiten vastgelegd.</div>
      ) : (
        <div className="divide-y divide-line">
          {rows.map((d) => {
            const lastMinute = hoursBetween(d.at, w.departureAt) < 24;
            return (
              <div key={d.id} className="px-4 py-2.5 flex flex-wrap items-start gap-2">
                <span className="erp-mono text-[11.5px] text-faint w-[132px] shrink-0">{formatDateTime(d.at)}</span>
                <Badge tone="neutral">{d.topic}</Badge>
                {lastMinute && <Badge tone="nogo">LAST-MINUTE</Badge>}
                <span className="text-[13px] text-fg flex-1 min-w-[200px]">{d.summary}</span>
              </div>
            );
          })}
        </div>
      )}
      <div className="px-4 py-2 text-[11.5px] text-faint border-t border-line">
        LAST-MINUTE = besluit binnen 24 uur voor vertrek ({formatDateTime(w.departureAt)}).
      </div>
    </Card>
  );
}

function RetrospectiveSummary({ weekend: w }: { weekend: Weekend }) {
  const { ops, out, classification } = retrospectiveScores(w.retrospective, w);
  return (
    <Card eyebrow="Afgerond" title="Retrospective" actions={<Link href={`/weekends/${w.slug}/retrospective`} className="btn btn-sm">Details</Link>}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <div>
          <div className="erp-label">Weekend outcome</div>
          <div className="erp-mono text-3xl font-semibold leading-none mt-1">
            {out.score.toFixed(1)}
            <span className="text-base text-faint">/10</span>
          </div>
        </div>
        <div>
          <div className="erp-label">Operational quality</div>
          <div className={`erp-mono text-3xl font-semibold leading-none mt-1 ${ops.score >= 70 ? "" : "text-nogo"}`}>
            {ops.score}
            <span className="text-base text-faint">/100</span>
          </div>
        </div>
        <div className="text-[13px] text-muted italic">{classification}</div>
      </div>
      {w.retrospective.lessonsLearned.length > 0 && (
        <ul className="mt-3 space-y-1 text-[13px] text-muted list-disc pl-5">
          {w.retrospective.lessonsLearned.slice(0, 3).map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      )}
      <div className="mt-3">
        <Link href="/history" className="text-[12px] text-cobalt font-semibold hover:underline">
          Naar Lessons Learned →
        </Link>
      </div>
    </Card>
  );
}
