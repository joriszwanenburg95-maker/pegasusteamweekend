"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import type { OperationalInput, OutcomeInput } from "@/lib/types";
import {
  estimateBzt,
  evaluateReadiness,
  formatDuration,
  groupSplitRisk,
  hoursBetween,
  retrospectiveScores,
} from "@/lib/engine";
import { nl } from "@/lib/labels";
import {
  Badge,
  Callout,
  Card,
  Checkbox,
  Field,
  NumberInput,
  TextInput,
  toneForStatus,
  type Tone,
} from "@/components/ui";
import { CountUp, Gauge, ScoreScale, StackedBar, toneColor } from "@/components/viz";

const OUTCOME_FIELDS: { key: keyof OutcomeInput; label: string; hint: string }[] = [
  { key: "gezelligheid", label: "Gezelligheid", hint: "Zwaarste weegfactor in de belevingsscore" },
  { key: "realizedBzt", label: "Gerealiseerde BZT", hint: "Hoe de avond feitelijk uitpakte" },
  { key: "location", label: "Locatie", hint: "Stad en omgeving" },
  { key: "evening", label: "Avond", hint: "Avondprogramma als geheel" },
  { key: "accommodation", label: "Accommodatie", hint: "Slapen, sanitair, ligging" },
  { key: "activity", label: "Activiteit", hint: "Zondagprogramma of teamactiviteit" },
  { key: "overall", label: "Algemeen", hint: "Totaaloordeel van de groep" },
];

const OPERATIONAL_FIELDS: {
  key: keyof OperationalInput;
  label: string;
  hint: string;
  step?: number;
}[] = [
  { key: "lastMinuteDecisions", label: "Last-minute besluiten", hint: "Besluiten binnen 24 uur voor vertrek" },
  { key: "unresolvedAtDeparture", label: "Open bij vertrek", hint: "Blokkerende punten bij vertrek" },
  { key: "unnecessaryTravelMin", label: "Onnodige reistijd (min)", hint: "Ritten die niet nodig waren", step: 5 },
  { key: "waitingMin", label: "Wachttijd (min)", hint: "Wachten op elkaar of op informatie", step: 5 },
  { key: "groupSplits", label: "Groepssplitsingen", hint: "Momenten waarop de groep uiteenviel" },
  { key: "reservationIssues", label: "Reserveringsproblemen", hint: "Vol, kwijt, verkeerd aantal" },
  { key: "transportIssues", label: "Vervoersproblemen", hint: "Stoel tekort, chauffeur weg, taxi niet" },
  { key: "bztLossMin", label: "BZT-verlies (min)", hint: "Verloren drinktijd t.o.v. de planning", step: 5 },
  { key: "overrides", label: "Bewust genegeerde controles", hint: "Overrides in het besluitenlog" },
];

function toneForOutcome(v: number): Tone {
  return v >= 7.5 ? "go" : v >= 5.5 ? "warn" : "nogo";
}

export default function RetrospectivePage() {
  const { weekend, patch, now } = useCurrentWeekend();
  const [newLesson, setNewLesson] = useState("");

  if (!weekend) return null;

  const retro = weekend.retrospective;
  const { ops, out, classification } = retrospectiveScores(retro, weekend);
  const bzt = estimateBzt(weekend);
  const split = groupSplitRisk(weekend);
  const atDeparture = evaluateReadiness(weekend, weekend.departureAt);

  const lastMinuteDecisions = weekend.decisions.filter((d) => {
    const h = hoursBetween(d.at, weekend.departureAt);
    return h >= 0 && h < 24;
  });
  const overrideDecisions = weekend.decisions.filter((d) => d.summary.startsWith("OVERRIDE:"));
  const deductionTotal = ops.deductions.reduce((s, d) => s + d.points, 0);

  const setOutcome = (key: keyof OutcomeInput, value: number) =>
    patch((w) => ({
      ...w,
      retrospective: { ...w.retrospective, outcome: { ...w.retrospective.outcome, [key]: value } },
    }));

  const setOperational = (key: keyof OperationalInput, value: number) =>
    patch((w) => ({
      ...w,
      retrospective: {
        ...w.retrospective,
        operational: { ...w.retrospective.operational, [key]: value },
      },
    }));

  const adoptEvidence = () =>
    patch((w) => ({
      ...w,
      retrospective: {
        ...w.retrospective,
        operational: {
          ...w.retrospective.operational,
          lastMinuteDecisions: lastMinuteDecisions.length,
          overrides: overrideDecisions.length,
          unresolvedAtDeparture: atDeparture.lockBlockers.length,
        },
      },
    }));

  const addLesson = () => {
    const text = newLesson.trim();
    if (!text) return;
    patch((w) => ({
      ...w,
      retrospective: { ...w.retrospective, lessonsLearned: [...w.retrospective.lessonsLearned, text] },
    }));
    setNewLesson("");
  };

  const removeLesson = (index: number) =>
    patch((w) => ({
      ...w,
      retrospective: {
        ...w.retrospective,
        lessonsLearned: w.retrospective.lessonsLearned.filter((_, i) => i !== index),
      },
    }));

  const updateLesson = (index: number, value: string) =>
    patch((w) => ({
      ...w,
      retrospective: {
        ...w.retrospective,
        lessonsLearned: w.retrospective.lessonsLearned.map((l, i) => (i === index ? value : l)),
      },
    }));

  const hoursSinceDeparture = hoursBetween(weekend.departureAt, now);

  return (
    <div className="space-y-5">
      {weekend.phase !== "COMPLETED" && !retro.filled && (
        <Callout tone="warn" title="Terugblik nog niet open">
          Vul de terugblik pas in als het weekend op {nl("COMPLETED")} staat
          {hoursSinceDeparture < 0
            ? ` (vertrek over ${Math.round(Math.abs(hoursSinceDeparture))} uur)`
            : ""}
          . Eerder invullen mag als verwachting; scores tellen pas mee zodra “Terugblik afgerond”
          aan staat.
        </Callout>
      )}

      {/* UITKOMST --------------------------------------------------------- */}
      <section className="card-navy stripe px-4 sm:px-5 py-4 rise rise-1">
        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-5 sm:gap-8">
          <div className="text-center">
            <Gauge
              value={out.score}
              max={10}
              decimals={1}
              size={118}
              stroke={11}
              tone={toneForOutcome(out.score)}
              track="rgba(255,255,255,0.16)"
              textColor="#ffffff"
              label={<span className="text-white/60">van 10</span>}
            />
            <div className="erp-label mt-1.5">Weekendbeleving</div>
          </div>
          <div className="text-center">
            <Gauge
              value={ops.score}
              max={100}
              size={118}
              stroke={11}
              tone={ops.score >= 70 ? "go" : ops.score >= 45 ? "warn" : "nogo"}
              track="rgba(255,255,255,0.16)"
              textColor="#ffffff"
              label={<span className="text-white/60">van 100</span>}
            />
            <div className="erp-label mt-1.5">Operationele kwaliteit</div>
          </div>
          <div className="min-w-[200px] flex-1">
            <div className="erp-label">Classificatie</div>
            <p className="text-[13px] sm:text-sm font-bold tracking-tight mt-1">
              “{classification}”
            </p>
            <div className="erp-label mt-2 pt-2 border-t border-white/10 leading-relaxed normal-case tracking-normal">
              Grondbeginsel: een goede weekendbeleving is nog geen goede operationele planning.
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card eyebrow="Beleving" title="Opbouw van de belevingsscore" className="rise rise-2">
          <ul className="space-y-2">
            {out.parts.map((p) => (
              <li key={p.label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="erp-label">{p.label}</span>
                  <span className="erp-mono text-[12.5px] font-semibold text-navy">
                    {p.value.toFixed(1)}
                    <span className="text-faint text-[11px]">/10</span>
                  </span>
                </div>
                <ScoreScale value={p.value} max={10} ticks={5} tone={toneForOutcome(p.value)} />
              </li>
            ))}
          </ul>
        </Card>

        <Card eyebrow="Proces" title="Aftrekposten" className="rise rise-3">
          {ops.deductions.length === 0 ? (
            <div className="text-sm text-muted">
              Geen aftrekposten geregistreerd: operationele kwaliteit staat op {ops.score}/100.
            </div>
          ) : (
            <>
              <StackedBar
                height={16}
                segments={[
                  ...ops.deductions.map((d, i) => ({
                    label: d.label,
                    value: d.points,
                    color: i % 2 === 0 ? toneColor("nogo") : toneColor("warn"),
                  })),
                  { label: "Behouden", value: Math.max(0, 100 - deductionTotal), tone: "go" as Tone },
                ]}
                showLegend={false}
              />
              <div className="overflow-x-auto mt-3 -mx-4">
                <table className="erp">
                  <thead>
                    <tr>
                      <th>Aftrekpost</th>
                      <th className="text-right">Punten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ops.deductions.map((d) => (
                      <tr key={d.label}>
                        <td>{d.label}</td>
                        <td className="text-right erp-mono font-semibold text-nogo">−{d.points}</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="font-semibold text-navy">Totaal</td>
                      <td className="text-right erp-mono font-semibold text-nogo">
                        −{deductionTotal}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card>
      </div>

      {/* INVOER ----------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card eyebrow="Belevingsinvoer" title="Hoe was het weekend?" className="rise rise-4">
          <div className="space-y-3">
            {OUTCOME_FIELDS.map((f) => (
              <div key={f.key}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="erp-label">{f.label}</span>
                  <span className="erp-mono text-sm font-semibold text-navy">
                    {retro.outcome[f.key].toFixed(1)}
                    <span className="text-faint text-[11px]">/10</span>
                  </span>
                </div>
                <input
                  type="range"
                  className="w-full accent-cobalt"
                  min={0}
                  max={10}
                  step={0.5}
                  value={retro.outcome[f.key]}
                  aria-label={f.label}
                  onChange={(e) => setOutcome(f.key, Number(e.target.value))}
                />
                <div className="text-[11px] text-faint -mt-0.5">{f.hint}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card eyebrow="Procesinvoer" title="Hoe liep het proces?" className="rise rise-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {OPERATIONAL_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint}>
                <NumberInput
                  value={retro.operational[f.key]}
                  step={f.step ?? 1}
                  onChange={(v) => setOperational(f.key, v)}
                />
              </Field>
            ))}
          </div>
          <div className="mt-3 pt-3 border-t border-line">
            <Checkbox
              checked={retro.filled}
              onChange={(v) =>
                patch((w) => ({ ...w, retrospective: { ...w.retrospective, filled: v } }))
              }
              label="Terugblik afgerond"
            />
          </div>
        </Card>
      </div>

      {/* BEWIJS UIT DE PLANNING ------------------------------------------- */}
      <Card
        eyebrow="Bewijs uit de planning"
        title="Wat het plan zelf laat zien (alleen lezen)"
        className="rise rise-6"
        actions={
          <button className="btn btn-sm" onClick={adoptEvidence}>
            Overnemen in procesinvoer
          </button>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Besluiten &lt; 24u</div>
            <div className="erp-mono text-2xl font-semibold text-navy">
              <CountUp value={lastMinuteDecisions.length} />
            </div>
            <div className="text-[11px] text-faint">Binnen 24 uur voor vertrek</div>
          </div>
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Overrides</div>
            <div className="erp-mono text-2xl font-semibold text-navy">
              <CountUp value={overrideDecisions.length} />
            </div>
            <div className="text-[11px] text-faint">Besluitenlog “OVERRIDE:”</div>
          </div>
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Open bij vertrek</div>
            <div
              className={`erp-mono text-2xl font-semibold ${
                atDeparture.lockBlockers.length > 0 ? "text-nogo" : "text-navy"
              }`}
            >
              <CountUp value={atDeparture.lockBlockers.length} />
            </div>
            <div className="text-[11px] text-faint">Blokkerende punten bij vertrek</div>
          </div>
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Geplande BZT netto</div>
            <div className="erp-mono text-2xl font-semibold text-navy">
              {formatDuration(bzt.netMin)}
            </div>
            <div className="text-[11px] text-faint">
              Bruto {formatDuration(bzt.grossMin)} − {formatDuration(bzt.splitPenaltyMin)}
            </div>
          </div>
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Groepssplitsingsrisico</div>
            <div className="mt-1">
              <Badge tone={toneForStatus(split.level)}>{nl(split.level)}</Badge>
            </div>
            <div className="text-[11px] text-faint mt-1 leading-snug">{split.reason}</div>
          </div>
        </div>

        {atDeparture.lockBlockers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line">
            <div className="erp-label mb-1.5">Blokkerende punten op het vertrekmoment</div>
            <div className="flex flex-wrap gap-1.5">
              {atDeparture.lockBlockers.map((b) => (
                <Badge key={b} tone="nogo">
                  {b}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {lastMinuteDecisions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line overflow-x-auto">
            <table className="erp">
              <thead>
                <tr>
                  <th>Onderwerp</th>
                  <th>Besluit binnen 24 uur</th>
                  <th className="text-right">Uur voor vertrek</th>
                </tr>
              </thead>
              <tbody>
                {lastMinuteDecisions.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Badge tone="neutral">{nl(d.topic)}</Badge>
                    </td>
                    <td className="text-[12.5px]">{d.summary}</td>
                    <td className="text-right erp-mono">
                      {Math.round(hoursBetween(d.at, weekend.departureAt))}u
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* GELEERDE LESSEN --------------------------------------------------- */}
      <Card
        eyebrow="Geleerde lessen"
        title="Wat nemen we mee naar het volgende weekend"
        className="rise rise-6"
      >
        {retro.lessonsLearned.length === 0 ? (
          <div className="text-sm text-muted">Nog geen lessen vastgelegd.</div>
        ) : (
          <ul className="space-y-2">
            {retro.lessonsLearned.map((l, i) => (
              <li key={`${i}-${l.slice(0, 12)}`} className="flex items-center gap-2">
                <span className="erp-mono text-[11px] text-faint w-5 shrink-0">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1 min-w-0">
                  <TextInput value={l} onChange={(v) => updateLesson(i, v)} />
                </div>
                <button
                  className="btn btn-sm btn-danger shrink-0"
                  onClick={() => removeLesson(i)}
                  aria-label="Les verwijderen"
                >
                  <Trash2 size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-2 mt-3 pt-3 border-t border-line">
          <div className="flex-1 min-w-0">
            <TextInput
              value={newLesson}
              onChange={setNewLesson}
              placeholder="Nieuwe les, bijv. “reserveer eten vóór vertrek”"
            />
          </div>
          <button className="btn btn-primary btn-sm shrink-0" onClick={addLesson}>
            <Plus size={13} /> Toevoegen
          </button>
        </div>
      </Card>
    </div>
  );
}
