"use client";

import {
  bobRiskIndex,
  evaluateReadiness,
  formatDate,
  formatDateTime,
  formatHours,
} from "@/lib/engine";
import { WEEKEND_PHASES, type DecisionTopic, type WeekendPhase } from "@/lib/types";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import {
  Badge,
  Callout,
  Card,
  Kpi,
  Progress,
  StatusBadge,
  toneForPercent,
  toneForStatus,
  type Tone,
} from "@/components/ui";

const DEADLINE_LABEL: Record<string, string> = {
  "T-7D": "T-7 DAYS",
  "T-72H": "T-72 HOURS",
  "T-24H": "T-24 HOURS",
  DEPARTURE: "DEPARTURE",
};

export default function ReadinessPage() {
  const { weekend, patch, set, now } = useCurrentWeekend();
  if (!weekend) return null;

  const readiness = evaluateReadiness(weekend, now);
  const bob = bobRiskIndex(weekend, now);
  const locked = weekend.historical === true;

  const logDecision = (topic: DecisionTopic, summary: string) =>
    patch((w) => ({
      ...w,
      decisions: [...w.decisions, { id: newId("d"), at: now, topic, summary }],
    }));

  /* ---------- Phase control ---------- */
  const phaseIndex = WEEKEND_PHASES.indexOf(weekend.phase);
  const nextPhase: WeekendPhase | null = WEEKEND_PHASES[phaseIndex + 1] ?? null;
  const prevPhase: WeekendPhase | null = phaseIndex > 0 ? WEEKEND_PHASES[phaseIndex - 1] : null;

  const phaseBlocker = (target: WeekendPhase): string | null => {
    if (target === "READY" && readiness.percent < 60)
      return `READY vereist readiness ≥ 60% — nu ${readiness.percent}%.`;
    if (target === "LOCKED" && !readiness.canLock)
      return readiness.lockBlockers.length
        ? `LOCK geblokkeerd: ${readiness.lockBlockers.join(" · ")}.`
        : `LOCK geblokkeerd: readiness ${readiness.percent}% < 80%.`;
    return null;
  };

  const movePhase = (target: WeekendPhase) => {
    set("phase", target);
    logDecision("other", `Fase ${weekend.phase} → ${target}.`);
  };

  const overrideLock = () => {
    set("phase", "LOCKED");
    logDecision(
      "other",
      `OVERRIDE: fase ${weekend.phase} → LOCKED geforceerd (governance exception). Open gating items: ${
        readiness.lockBlockers.join(", ") || `readiness ${readiness.percent}%`
      }.`,
    );
  };

  const nextBlocker = nextPhase ? phaseBlocker(nextPhase) : null;

  /* ---------- BOB lead time ---------- */
  const leadTone: Tone =
    readiness.bobLeadTimeHours === null
      ? "unknown"
      : readiness.bobLeadTimeHours < 24
        ? "nogo"
        : readiness.bobLeadTimeHours < 72
          ? "warn"
          : "go";

  const narrativeTone: Tone =
    readiness.gate === "GO" ? "go" : readiness.gate === "NO GO" ? "nogo" : readiness.gate === "COMPLETED" ? "neutral" : "warn";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="erp-label">Module R-01 · Pre-flight</div>
          <h2 className="text-base font-bold tracking-tight text-navy">READINESS GATE</h2>
        </div>
        <div className="erp-mono text-[11.5px] text-faint">
          {readiness.passCount} PASS · {readiness.warningCount} WARNING · {readiness.failCount} FAIL ·{" "}
          {readiness.unknownCount} UNKNOWN
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------------- Terminal readout ---------------- */}
        <Card navy title="TEAMWEEKEND READINESS" eyebrow="Gate evaluation" className="lg:col-span-2">
          <div className="flex flex-wrap items-end justify-between gap-3 pb-3">
            <div>
              <div className="erp-label">Readiness</div>
              <div className="erp-mono text-3xl font-semibold leading-none">{readiness.percent}%</div>
            </div>
            <div className="flex items-center gap-2">
              <span className="erp-label">Gate</span>
              <StatusBadge status={readiness.gate} />
            </div>
          </div>
          <Progress value={readiness.percent} tone={toneForPercent(readiness.percent)} className="mb-3" />

          <div className="rounded-[6px] border border-white/10 bg-black/20 px-3 py-1">
            {readiness.checks.map((c) => (
              <div key={c.key} className="border-b border-white/10 py-2 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[13px] font-semibold">
                    {c.label}
                    {!c.gating && <span className="erp-label ml-2 align-middle">non-gating</span>}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="erp-mono mt-0.5 text-[11.5px] leading-snug text-white/60">{c.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-3 erp-mono text-[12px] leading-snug text-white/80">
            {readiness.canLock ? (
              <span className="text-go">Weekend may be LOCKED.</span>
            ) : (
              <>
                <span className="text-warn">{formatDate(weekend.departureAt)} may not be locked.</span>
                <ul className="mt-1 list-disc pl-5 text-white/70">
                  {readiness.lockBlockers.length ? (
                    readiness.lockBlockers.map((b) => <li key={b}>{b}</li>)
                  ) : (
                    <li>Readiness {readiness.percent}% &lt; 80% vereist.</li>
                  )}
                </ul>
              </>
            )}
          </div>
        </Card>

        {/* ---------------- Bob Risk Index ---------------- */}
        <Card title="BOB RISK INDEX" eyebrow="Secundaire KPI" actions={<StatusBadge status={bob.level} />}>
          <div className="flex items-end gap-3" title={bob.tooltip}>
            <div className={`erp-mono text-3xl font-semibold leading-none ${toneForStatus(bob.level) === "nogo" ? "text-nogo" : toneForStatus(bob.level) === "warn" ? "text-warn" : "text-go"}`}>
              {bob.score}
            </div>
            <div className="text-[11.5px] text-muted">/ 100 · &ldquo;{bob.tooltip}&rdquo;</div>
          </div>
          <div className="mt-2 text-[12px] text-muted">
            <span className="erp-label">Primary driver</span>
            <div className="erp-mono text-[11.5px] leading-snug text-fg">{bob.primaryDriver}</div>
          </div>
          <div className="mt-3 space-y-1">
            {bob.drivers.map((d, i) => (
              <div key={`${d.label}-${i}`} className="flex items-start justify-between gap-2 border-b border-line pb-1 last:border-0">
                <span className="text-[11.5px] leading-snug text-muted">{d.label}</span>
                <span className={`erp-mono text-[11.5px] font-semibold ${d.points > 0 ? "text-nogo" : "text-go"}`}>
                  {d.points > 0 ? `+${d.points}` : d.points}
                </span>
              </div>
            ))}
            {bob.drivers.length === 0 && <div className="text-[12px] text-faint">Geen planningdata.</div>}
          </div>
          <div className="mt-3">
            <Callout tone="unknown" title="Ludieke KPI">
              Telt niet mee in GO/NO GO. Uitsluitend afgeleid van echte planningdata.
            </Callout>
          </div>
        </Card>
      </div>

      <Callout tone={narrativeTone} title="Risk narrative">
        {readiness.riskNarrative}
      </Callout>

      {/* ---------------- Deadlines ---------------- */}
      <Card title="DEADLINES" eyebrow="Timeline" padded={false}>
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th>Deadline</th>
                <th>Moment</th>
                <th>T-minus</th>
                <th>Status</th>
                <th>Required</th>
                <th>Missing</th>
              </tr>
            </thead>
            <tbody>
              {readiness.deadlines.map((d) => (
                <tr key={d.key}>
                  <td className="erp-mono font-semibold whitespace-nowrap text-navy">{DEADLINE_LABEL[d.key] ?? d.key}</td>
                  <td className="erp-mono whitespace-nowrap text-[11.5px]">{formatDateTime(d.at)}</td>
                  <td className={`erp-mono whitespace-nowrap text-[11.5px] ${d.hoursUntil <= 0 ? "text-faint" : ""}`}>
                    {d.hoursUntil <= 0 ? "verstreken" : formatHours(d.hoursUntil)}
                  </td>
                  <td><StatusBadge status={d.status} /></td>
                  <td className="erp-mono text-[11px] text-muted">{d.required.join(" · ")}</td>
                  <td className="erp-mono text-[11px]">
                    {d.missing.length ? <span className="text-nogo">{d.missing.join(" · ")}</span> : <span className="text-go">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ---------------- BOB lead time + phase control ---------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3">
          <Kpi
            label="BOB LEAD TIME"
            value={readiness.bobLeadTimeHours === null ? "—" : formatHours(readiness.bobLeadTimeHours)}
            sub={readiness.bobLeadTimeLabel}
            tone={leadTone}
          />
          <Card title="PLAN DEFINITIEF" eyebrow="Lead time control">
            <p className="text-[12px] leading-snug text-muted">
              Aantal uren tussen definitief plan en vertrek. Korter = hoger organisatorisch risico.
            </p>
            <div className="erp-mono mt-2 text-[11.5px] text-muted">
              planFinalAt: {weekend.planFinalAt ? formatDateTime(weekend.planFinalAt) : "null"}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  set("planFinalAt", now);
                  logDecision("other", `Plan gemarkeerd als definitief op ${formatDateTime(now)}.`);
                }}
              >
                Markeer plan als definitief (nu)
              </button>
              <button
                className="btn btn-sm"
                disabled={!weekend.planFinalAt}
                onClick={() => {
                  set("planFinalAt", null);
                  logDecision("other", "Plan heropend: planFinalAt teruggezet naar null.");
                }}
              >
                Plan heropenen
              </button>
            </div>
          </Card>
        </div>

        <Card title="PHASE CONTROL" eyebrow="Governance" className="lg:col-span-2">
          <div className="flex flex-wrap items-center gap-1">
            {WEEKEND_PHASES.map((p, i) => {
              const current = p === weekend.phase;
              const past = i < phaseIndex;
              return (
                <div key={p} className="flex items-center gap-1">
                  <span
                    className={`erp-mono rounded-[4px] border px-2 py-1 text-[11px] font-bold tracking-[0.08em] ${
                      current
                        ? "border-navy bg-navy text-white"
                        : past
                          ? "border-line-strong bg-sunken text-muted"
                          : "border-line bg-elev text-faint"
                    }`}
                  >
                    {p}
                  </span>
                  {i < WEEKEND_PHASES.length - 1 && <span className="text-faint">›</span>}
                </div>
              );
            })}
          </div>

          {locked ? (
            <div className="mt-3">
              <Callout tone="unknown" title="Historisch weekend">
                Dit weekend is een historische case. Fasering staat vast en is niet aanpasbaar.
              </Callout>
              <div className="mt-2 flex flex-wrap gap-2">
                <button className="btn btn-sm" disabled>Vorige fase</button>
                <button className="btn btn-sm btn-primary" disabled>Volgende fase</button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-sm" disabled={!prevPhase} onClick={() => prevPhase && movePhase(prevPhase)}>
                  ‹ {prevPhase ?? "—"}
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!nextPhase || nextBlocker !== null}
                  title={nextBlocker ?? undefined}
                  onClick={() => nextPhase && movePhase(nextPhase)}
                >
                  {nextPhase ?? "EINDE"} ›
                </button>
                {nextPhase === "LOCKED" && nextBlocker !== null && (
                  <button className="btn btn-sm btn-danger" onClick={overrideLock}>
                    Override lock (governance exception)
                  </button>
                )}
              </div>
              {nextBlocker && (
                <Callout tone="nogo" title="Faseovergang geblokkeerd">
                  {nextBlocker}
                  {nextPhase === "LOCKED" && " Override legt een OVERRIDE-regel vast in het decision log."}
                </Callout>
              )}
              <div className="erp-mono text-[11px] text-faint">
                Regels: READY ≥ 60% readiness · LOCKED vereist alle gating checks PASS (canLock) · LIVE en COMPLETED altijd
                toegestaan.
              </div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="erp-label">Huidige fase</span>
            <Badge tone={weekend.phase === "LOCKED" ? "navy" : "neutral"}>{weekend.phase}</Badge>
            <span className="erp-label">Decision log</span>
            <Badge tone="neutral">{weekend.decisions.length} entries</Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
