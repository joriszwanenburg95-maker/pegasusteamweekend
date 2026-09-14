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
import {
  Badge,
  Callout,
  Card,
  Checkbox,
  Field,
  NumberInput,
  StatusBadge,
  TextInput,
  toneForStatus,
} from "@/components/ui";

const OUTCOME_FIELDS: { key: keyof OutcomeInput; label: string; hint: string }[] = [
  { key: "gezelligheid", label: "Gezelligheid", hint: "Zwaarste weegfactor in de outcome-score" },
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
  { key: "lastMinuteDecisions", label: "Last-minute decisions", hint: "Besluiten binnen 24u voor vertrek" },
  { key: "unresolvedAtDeparture", label: "Unresolved at departure", hint: "Open gating items bij vertrek" },
  { key: "unnecessaryTravelMin", label: "Unnecessary travel (min)", hint: "Ritten die niet nodig waren", step: 5 },
  { key: "waitingMin", label: "Waiting (min)", hint: "Wachten op elkaar of op informatie", step: 5 },
  { key: "groupSplits", label: "Group splits", hint: "Momenten waarop de groep uiteenviel" },
  { key: "reservationIssues", label: "Reservation issues", hint: "Vol, kwijt, verkeerd aantal" },
  { key: "transportIssues", label: "Transport issues", hint: "Stoel tekort, chauffeur weg, taxi niet" },
  { key: "bztLossMin", label: "BZT loss (min)", hint: "Verloren drinktijd t.o.v. de planning", step: 5 },
  { key: "overrides", label: "Overrides", hint: "Bewust genegeerde controls" },
];

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
        <Callout tone="warn" title="Retrospective nog niet open">
          De retrospective hoort pas ingevuld te worden nadat het weekend op COMPLETED staat
          {hoursSinceDeparture < 0
            ? ` (vertrek over ${Math.round(Math.abs(hoursSinceDeparture))} uur)`
            : ""}
          . Vooraf invullen mag: gebruik het als verwachting en corrigeer achteraf. Scores tellen
          pas mee in de benchmark zodra “Retrospective afgerond” aan staat.
        </Callout>
      )}

      {/* RESULT ---------------------------------------------------------- */}
      <section className="card-navy stripe px-4 sm:px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <div className="erp-label">Weekend outcome</div>
            <div className="erp-mono text-4xl font-semibold leading-none mt-1">
              {out.score.toFixed(1)}
              <span className="text-lg text-white/50"> / 10</span>
            </div>
            <div className="text-[12px] text-white/60 mt-1">Beleving van de groep</div>
          </div>
          <div>
            <div className="erp-label">Operational quality</div>
            <div
              className={`erp-mono text-4xl font-semibold leading-none mt-1 ${
                ops.score >= 70 ? "" : "text-white"
              }`}
            >
              {ops.score}
              <span className="text-lg text-white/50"> / 100</span>
            </div>
            <div className="text-[12px] text-white/60 mt-1">Kwaliteit van het proces</div>
          </div>
        </div>
        <p className="text-[13px] sm:text-sm font-bold tracking-tight mt-3 pt-3 border-t border-white/10">
          “{classification}”
        </p>
        <div className="erp-label mt-1">
          Grondbeginsel: good weekend outcome ≠ good operational planning
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card eyebrow="Outcome" title="Opbouw van de belevingsscore" padded={false}>
          <div className="overflow-x-auto">
            <table className="erp">
              <thead>
                <tr>
                  <th>Onderdeel</th>
                  <th className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {out.parts.map((p) => (
                  <tr key={p.label}>
                    <td>{p.label}</td>
                    <td className="text-right erp-mono font-semibold">{p.value.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card eyebrow="Operational" title="Aftrekposten" padded={false}>
          {ops.deductions.length === 0 ? (
            <div className="px-4 py-5 text-sm text-muted">
              Geen aftrekposten geregistreerd: operational quality staat op {ops.score}/100.
            </div>
          ) : (
            <div className="overflow-x-auto">
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
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* INPUTS ---------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card eyebrow="Outcome input" title="Hoe was het weekend?">
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

        <Card eyebrow="Operational input" title="Hoe liep het proces?">
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
              label="Retrospective afgerond"
            />
          </div>
        </Card>
      </div>

      {/* PLANNING EVIDENCE ------------------------------------------------ */}
      <Card
        eyebrow="Planning-side evidence"
        title="Wat het plan zélf laat zien (read-only)"
        actions={
          <button className="btn btn-sm" onClick={adoptEvidence}>
            Neem over in operational input
          </button>
        }
      >
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Besluiten &lt; 24u</div>
            <div className="erp-mono text-2xl font-semibold text-navy">
              {lastMinuteDecisions.length}
            </div>
            <div className="text-[11px] text-faint">Binnen 24 uur voor vertrek</div>
          </div>
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Overrides</div>
            <div className="erp-mono text-2xl font-semibold text-navy">
              {overrideDecisions.length}
            </div>
            <div className="text-[11px] text-faint">Decision log “OVERRIDE:”</div>
          </div>
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Open bij vertrek</div>
            <div
              className={`erp-mono text-2xl font-semibold ${
                atDeparture.lockBlockers.length > 0 ? "text-nogo" : "text-navy"
              }`}
            >
              {atDeparture.lockBlockers.length}
            </div>
            <div className="text-[11px] text-faint">Gating items op vertrekmoment</div>
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
            <div className="erp-label">Group split risk</div>
            <div className="mt-1">
              <Badge tone={toneForStatus(split.level)}>{split.level}</Badge>
            </div>
            <div className="text-[11px] text-faint mt-1 leading-snug">{split.reason}</div>
          </div>
        </div>

        {atDeparture.lockBlockers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-line">
            <div className="erp-label mb-1.5">Open gating items op vertrekmoment</div>
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
                  <th>Besluit binnen 24u</th>
                  <th className="text-right">Uur voor vertrek</th>
                </tr>
              </thead>
              <tbody>
                {lastMinuteDecisions.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <StatusBadge status={d.topic.toUpperCase()} />
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

      {/* LESSONS --------------------------------------------------------- */}
      <Card eyebrow="Lessons learned" title="Wat nemen we mee naar het volgende weekend">
        {retro.lessonsLearned.length === 0 ? (
          <div className="text-sm text-muted">Nog geen lessons learned vastgelegd.</div>
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
