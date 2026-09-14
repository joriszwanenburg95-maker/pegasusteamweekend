"use client";

import {
  bobRiskIndex,
  evaluateReadiness,
  formatDate,
  formatDateTime,
  formatHours,
} from "@/lib/engine";
import { WEEKEND_PHASES, type DecisionTopic, type WeekendPhase } from "@/lib/types";
import { nl } from "@/lib/labels";
import { BOB_COPY, BobGauge } from "@/components/bob";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import {
  Badge,
  Callout,
  Card,
  Kpi,
  StatusBadge,
  toneForPercent,
  toneForStatus,
  type Tone,
} from "@/components/ui";
import { CountUp, Gauge, PhaseStepper, ScoreScale, StackedBar } from "@/components/viz";

/** Uren vóór vertrek waarop elke deadline valt (venster van de tijdlijn = 168 uur). */
const DEADLINE_OFFSET_H: Record<string, number> = {
  "T-7D": 168,
  "T-72H": 72,
  "T-24H": 24,
  DEPARTURE: 0,
};
const WINDOW_H = 168;

/** Positie op de tijdlijn (0% = T-7 dagen, 100% = vertrek). */
function railPos(hoursBeforeDeparture: number): number {
  return Math.max(0, Math.min(100, ((WINDOW_H - hoursBeforeDeparture) / WINDOW_H) * 100));
}

export default function ReadinessPage() {
  const { weekend, patch, set, now } = useCurrentWeekend();
  if (!weekend) return null;

  const readiness = evaluateReadiness(weekend, now);
  const bob = bobRiskIndex(weekend, now);
  const historical = weekend.historical === true;

  const logDecision = (topic: DecisionTopic, summary: string) =>
    patch((w) => ({
      ...w,
      decisions: [...w.decisions, { id: newId("d"), at: now, topic, summary }],
    }));

  /* ---------- Fasebesturing ---------- */
  const phaseIndex = WEEKEND_PHASES.indexOf(weekend.phase);
  const nextPhase: WeekendPhase | null = WEEKEND_PHASES[phaseIndex + 1] ?? null;
  const prevPhase: WeekendPhase | null = phaseIndex > 0 ? WEEKEND_PHASES[phaseIndex - 1] : null;

  const phaseBlocker = (target: WeekendPhase): string | null => {
    if (target === "READY" && readiness.percent < 60)
      return `${nl("READY")} vereist gereedheid ≥ 60% — nu ${readiness.percent}%.`;
    if (target === "LOCKED" && !readiness.canLock)
      return readiness.lockBlockers.length
        ? `Vergrendelen geblokkeerd: ${readiness.lockBlockers.join(" · ")}.`
        : `Vergrendelen geblokkeerd: gereedheid ${readiness.percent}% < 80%.`;
    return null;
  };

  const movePhase = (target: WeekendPhase) => {
    set("phase", target);
    logDecision("other", `Fase ${nl(weekend.phase)} → ${nl(target)}.`);
  };

  const overrideLock = () => {
    set("phase", "LOCKED");
    logDecision(
      "other",
      `OVERRIDE: fase ${nl(weekend.phase)} → ${nl("LOCKED")} geforceerd (governance-uitzondering). Open blokkerende punten: ${
        readiness.lockBlockers.join(", ") || `gereedheid ${readiness.percent}%`
      }.`,
    );
  };

  const nextBlocker = nextPhase ? phaseBlocker(nextPhase) : null;

  /* ---------- Bob-aanlooptijd ---------- */
  const leadTone: Tone =
    readiness.bobLeadTimeHours === null
      ? "unknown"
      : readiness.bobLeadTimeHours < 24
        ? "nogo"
        : readiness.bobLeadTimeHours < 72
          ? "warn"
          : "go";

  const narrativeTone: Tone =
    readiness.gate === "GO"
      ? "go"
      : readiness.gate === "NO GO"
        ? "nogo"
        : readiness.gate === "COMPLETED"
          ? "neutral"
          : "warn";

  const statusSegments = [
    { label: nl("PASS"), value: readiness.passCount, tone: "go" as Tone },
    { label: nl("WARNING"), value: readiness.warningCount, tone: "warn" as Tone },
    { label: nl("FAIL"), value: readiness.failCount, tone: "nogo" as Tone },
    { label: nl("UNKNOWN"), value: readiness.unknownCount, tone: "unknown" as Tone },
  ].filter((s) => s.value > 0);

  const bobPlus = bob.drivers.filter((d) => d.points > 0).reduce((s, d) => s + d.points, 0);
  const bobMinus = Math.abs(bob.drivers.filter((d) => d.points < 0).reduce((s, d) => s + d.points, 0));

  const hoursToDeparture = readiness.deadlines.find((d) => d.key === "DEPARTURE")?.hoursUntil ?? 0;
  const nowPos = railPos(Math.max(0, hoursToDeparture));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="erp-label">Module R-01 · Pre-flight check</div>
          <h2 className="text-base font-bold tracking-tight text-navy">GEREEDHEIDSPOORT</h2>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone="go">{readiness.passCount} {nl("PASS")}</Badge>
          <Badge tone="warn">{readiness.warningCount} {nl("WARNING")}</Badge>
          <Badge tone="nogo">{readiness.failCount} {nl("FAIL")}</Badge>
          <Badge tone="unknown">{readiness.unknownCount} {nl("UNKNOWN")}</Badge>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------------- Gereedheid ---------------- */}
        <Card navy title="GEREEDHEID TEAMWEEKEND" eyebrow="Poortevaluatie" className="lg:col-span-2 rise rise-1">
          <div className="flex flex-wrap items-center gap-4 pb-3">
            <Gauge
              value={readiness.percent}
              size={118}
              stroke={11}
              tone={toneForPercent(readiness.percent)}
              suffix="%"
              label={<span className="text-white/60">Gereed</span>}
              track="rgba(255,255,255,0.14)"
              textColor="#fff"
            />
            <div className="min-w-[180px] flex-1">
              <div className="mb-2 flex items-center gap-2">
                <span className="erp-label">Poort</span>
                <StatusBadge status={readiness.gate} />
              </div>
              <StackedBar segments={statusSegments} height={12} />
              <div className="erp-mono mt-2 text-[11.5px] text-white/60">
                {readiness.checks.length} checks · {readiness.checks.filter((c) => c.gating).length} blokkerend
              </div>
            </div>
          </div>

          <div className="rounded-[6px] border border-white/10 bg-black/20 px-3 py-1">
            {readiness.checks.map((c) => (
              <div key={c.key} className="border-b border-white/10 py-1.5 last:border-0">
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[13px] font-semibold">
                    {c.label}
                    {!c.gating && <span className="erp-label ml-2 align-middle">niet blokkerend</span>}
                  </span>
                  <StatusBadge status={c.status} />
                </div>
                <div className="erp-mono mt-0.5 text-[11.5px] leading-snug text-white/60">{c.detail}</div>
              </div>
            ))}
          </div>

          <div className="erp-mono mt-3 text-[12px] leading-snug text-white/80">
            {readiness.canLock ? (
              <span className="text-go">Weekend mag VERGRENDELD worden.</span>
            ) : (
              <>
                <span className="text-warn">{formatDate(weekend.departureAt)} mag niet vergrendeld worden.</span>
                <ul className="mt-1 list-disc pl-5 text-white/70">
                  {readiness.lockBlockers.length ? (
                    readiness.lockBlockers.map((b) => <li key={b}>{b}</li>)
                  ) : (
                    <li>Gereedheid {readiness.percent}% &lt; 80% vereist.</li>
                  )}
                </ul>
              </>
            )}
          </div>
        </Card>

        {/* ---------------- Bob-risico-index ---------------- */}
        <Card
          title="BOB-RISICO-INDEX"
          eyebrow="Secundaire KPI"
          actions={<StatusBadge status={bob.level} />}
          className="rise rise-2"
        >
          <div className="flex items-center gap-3" title={bob.tooltip}>
            <BobGauge bob={bob} size={96} stroke={8} showLevel={false} />
            <div className="min-w-0 flex-1">
              <div className="text-[12.5px] font-semibold text-navy leading-snug mb-1.5">{BOB_COPY[bob.level].headline}</div>
              <div className="erp-label">Zwaarste factor</div>
              <div className="erp-mono text-[11.5px] leading-snug text-fg">{bob.primaryDriver}</div>
              <div className="mt-2 text-[11px] text-faint">&ldquo;{bob.tooltip}&rdquo;</div>
            </div>
          </div>

          <div className="mt-3">
            <div className="erp-label mb-1">Verhogend vs. verlagend</div>
            <StackedBar
              segments={[
                { label: "Verhoogt", value: bobPlus, tone: "nogo" },
                { label: "Verlaagt", value: bobMinus, tone: "go" },
              ]}
              height={12}
              formatValue={(v) => `${v} ptn`}
            />
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
              Telt niet mee in GO / NO GO. Alleen afgeleid van echte planningdata.
            </Callout>
          </div>
        </Card>
      </div>

      <div className="rise rise-3">
        <Callout tone={narrativeTone} title="Risicobeeld">
          {readiness.riskNarrative}
        </Callout>
      </div>

      {/* ---------------- Deadlines als tijdlijn ---------------- */}
      <Card title="DEADLINES" eyebrow="Tijdlijn naar vertrek" className="rise rise-4">
        <div className="relative mt-1 mb-2 h-9">
          <div className="absolute left-0 right-0 top-4 h-1.5 rounded-full bg-sunken" />
          <div
            className="viz-grow-x absolute left-0 top-4 h-1.5 rounded-full bg-cobalt"
            style={{ width: `${nowPos}%` }}
          />
          {readiness.deadlines.map((d) => {
            const tone = toneForStatus(d.status);
            return (
              <div
                key={d.key}
                className="absolute top-2 -translate-x-1/2"
                style={{ left: `${railPos(DEADLINE_OFFSET_H[d.key] ?? 0)}%` }}
                title={`${nl(d.key)} · ${nl(d.status)}`}
              >
                <span
                  className={`viz-pop block h-5 w-5 rounded-full border-2 border-white ${
                    tone === "go" ? "bg-go" : tone === "warn" ? "bg-warn" : tone === "nogo" ? "bg-nogo" : "bg-unknown"
                  }`}
                />
              </div>
            );
          })}
          <div
            className="absolute -top-1 bottom-0 -translate-x-1/2"
            style={{ left: `${nowPos}%` }}
            title="Nu"
          >
            <div className="mx-auto h-full w-0.5 bg-navy" />
            <span className="erp-mono absolute -top-1 left-1 text-[9.5px] font-bold text-navy">nu</span>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {readiness.deadlines.map((d) => (
            <div key={d.key} className="rounded-[6px] border border-line bg-sunken px-2.5 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="erp-mono text-[11.5px] font-bold text-navy">{nl(d.key)}</span>
                <StatusBadge status={d.status} />
              </div>
              <div className="erp-mono mt-1 text-[11px] text-muted">{formatDateTime(d.at)}</div>
              <div className={`erp-mono text-[11px] ${d.hoursUntil <= 0 ? "text-faint" : "text-fg"}`}>
                {d.hoursUntil <= 0 ? "verstreken" : `over ${formatHours(d.hoursUntil)}`}
              </div>
              <div className="mt-1.5">
                <ScoreScale
                  value={d.required.length - d.missing.length}
                  max={Math.max(1, d.required.length)}
                  tone={d.missing.length === 0 ? "go" : toneForStatus(d.status)}
                  ticks={Math.min(6, Math.max(1, d.required.length))}
                  height={6}
                />
                <div className="erp-mono mt-1 text-[10.5px] leading-snug">
                  {d.missing.length ? (
                    <span className="text-nogo">Open: {d.missing.join(" · ")}</span>
                  ) : (
                    <span className="text-go">Alles op orde ({d.required.length})</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* ---------------- Bob-aanlooptijd + fasebesturing ---------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 rise rise-5">
          <Kpi
            label="BOB-AANLOOPTIJD"
            value={readiness.bobLeadTimeHours === null ? "—" : formatHours(readiness.bobLeadTimeHours)}
            sub={readiness.bobLeadTimeLabel}
            tone={leadTone}
          />
          <Card title="PLAN DEFINITIEF" eyebrow="Aanlooptijd">
            <p className="text-[12px] leading-snug text-muted">
              Uren tussen definitief plan en vertrek. Korter = hoger risico.
            </p>
            <div className="erp-mono mt-2 text-[11.5px] text-muted">
              Definitief op: {weekend.planFinalAt ? formatDateTime(weekend.planFinalAt) : "nog niet"}
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
                  logDecision("other", "Plan heropend: definitief moment teruggezet.");
                }}
              >
                Plan heropenen
              </button>
            </div>
          </Card>
        </div>

        <Card title="FASEBESTURING" eyebrow="Governance" className="lg:col-span-2 rise rise-6">
          <PhaseStepper phases={WEEKEND_PHASES} current={weekend.phase} labels={nl} />

          {historical ? (
            <div className="mt-3">
              <Callout tone="unknown" title="Historisch weekend">
                Dit weekend is een historische case. De fasering staat vast en is niet aanpasbaar.
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
                  ‹ {prevPhase ? nl(prevPhase) : "—"}
                </button>
                <button
                  className="btn btn-sm btn-primary"
                  disabled={!nextPhase || nextBlocker !== null}
                  title={nextBlocker ?? undefined}
                  onClick={() => nextPhase && movePhase(nextPhase)}
                >
                  {nextPhase ? nl(nextPhase) : "EINDE"} ›
                </button>
                {nextPhase === "LOCKED" && nextBlocker !== null && (
                  <button className="btn btn-sm btn-danger" onClick={overrideLock}>
                    Override (governance-uitzondering)
                  </button>
                )}
              </div>
              {nextBlocker && (
                <Callout tone="nogo" title="Faseovergang geblokkeerd">
                  {nextBlocker}
                  {nextPhase === "LOCKED" && " Een override legt een OVERRIDE-regel vast in het besluitenlogboek."}
                </Callout>
              )}
              <div className="erp-mono text-[11px] leading-snug text-faint">
                Regels: {nl("READY")} ≥ 60% gereedheid · {nl("LOCKED")} vereist alle blokkerende checks op {nl("PASS")} ·{" "}
                {nl("LIVE")} en {nl("COMPLETED")} altijd toegestaan.
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="erp-label">Huidige fase</span>
            <Badge tone={weekend.phase === "LOCKED" ? "navy" : "neutral"}>{nl(weekend.phase)}</Badge>
            <span className="erp-label">Besluitenlogboek</span>
            <Badge tone="neutral">
              <CountUp value={weekend.decisions.length} /> regels
            </Badge>
          </div>
        </Card>
      </div>
    </div>
  );
}
