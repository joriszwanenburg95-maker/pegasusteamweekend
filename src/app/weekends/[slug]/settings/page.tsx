"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { newId, useStore } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import { WEEKEND_PHASES, type DecisionTopic, type WeekendPhase } from "@/lib/types";
import { evaluateReadiness, formatDateTime, hoursBetween } from "@/lib/engine";
import {
  Badge,
  Callout,
  Card,
  Checkbox,
  DateTimeInput,
  Field,
  PhaseBadge,
  Select,
  TextInput,
} from "@/components/ui";

const TOPIC_OPTIONS: { value: DecisionTopic; label: string }[] = [
  { value: "attendance", label: "ATTENDANCE" },
  { value: "accommodation", label: "ACCOMMODATION" },
  { value: "dinner", label: "DINNER" },
  { value: "nightlife", label: "NIGHTLIFE" },
  { value: "transport", label: "TRANSPORT" },
  { value: "activity", label: "ACTIVITY" },
  { value: "other", label: "OTHER" },
];

const PHASE_OPTIONS: { value: WeekendPhase; label: string }[] = WEEKEND_PHASES.map((p) => ({
  value: p,
  label: p,
}));

export default function SettingsPage() {
  const { weekend, patch, set, now } = useCurrentWeekend();
  const { dispatch } = useStore();
  const router = useRouter();
  const [topic, setTopic] = useState<DecisionTopic>("other");
  const [summary, setSummary] = useState("");

  if (!weekend) return null;

  const readiness = evaluateReadiness(weekend, now);

  const logDecision = (t: DecisionTopic, s: string) =>
    patch((w) => ({
      ...w,
      decisions: [...w.decisions, { id: newId("d"), at: now, topic: t, summary: s }],
    }));

  const changePhase = (phase: WeekendPhase) => {
    if (phase === weekend.phase) return;
    set("phase", phase);
    if (phase === "LOCKED" && !readiness.canLock) {
      logDecision("other", `OVERRIDE: phase set to ${phase} zonder groen licht van de readiness gate.`);
    } else {
      logDecision("other", `Fase gewijzigd van ${weekend.phase} naar ${phase}.`);
    }
  };

  const addDecision = () => {
    const text = summary.trim();
    if (!text) return;
    logDecision(topic, text);
    setSummary("");
  };

  const removeDecision = (id: string) => {
    if (!window.confirm("Deze regel uit het decision log verwijderen?")) return;
    patch((w) => ({ ...w, decisions: w.decisions.filter((d) => d.id !== id) }));
  };

  const deleteWeekend = () => {
    if (
      !window.confirm(
        `Weekend “${weekend.name}” definitief verwijderen? Alle deelnemers, reserveringen en het decision log gaan verloren.`,
      )
    )
      return;
    dispatch({ type: "deleteWeekend", id: weekend.id });
    router.push("/weekends");
  };

  const decisions = [...weekend.decisions].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-5">
      {weekend.historical && (
        <Callout tone="neutral" title="Historische case">
          Dit weekend is opgenomen als historische case. Wijzigen mag, maar de waarde zit in de
          vastgelegde feiten en de lessons learned: pas het alleen aan als de registratie feitelijk
          onjuist is.
        </Callout>
      )}

      {/* MASTER DATA ----------------------------------------------------- */}
      <Card eyebrow="Master data" title="Weekend">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Field label="Naam" className="sm:col-span-2">
            <TextInput value={weekend.name} onChange={(v) => set("name", v)} />
          </Field>
          <Field label="Seizoen">
            <TextInput value={weekend.season} onChange={(v) => set("season", v)} placeholder="2026/2027" />
          </Field>
          <Field label="Stad">
            <TextInput value={weekend.city} onChange={(v) => set("city", v)} />
          </Field>
          <Field label="Departure" hint="Vertrek uit Nijmegen" className="sm:col-span-2">
            <DateTimeInput value={weekend.departureAt} onChange={(iso) => set("departureAt", iso)} />
          </Field>
          <Field label="Return" className="sm:col-span-2">
            <DateTimeInput value={weekend.returnAt} onChange={(iso) => set("returnAt", iso)} />
          </Field>
        </div>
        <Field label="Samenvatting" className="mt-3">
          <textarea
            className="input"
            rows={3}
            value={weekend.summary ?? ""}
            onChange={(e) => set("summary", e.target.value)}
            placeholder="Korte omschrijving van opzet, doel en bijzonderheden."
          />
        </Field>
      </Card>

      {/* MATCH CONTEXT --------------------------------------------------- */}
      <Card eyebrow="Match context" title="Wedstrijd">
        <Checkbox
          checked={weekend.match.hasMatch}
          onChange={(v) => patch((w) => ({ ...w, match: { ...w.match, hasMatch: v } }))}
          label="Er wordt een wedstrijd gespeeld (critical path start bij MATCH END)"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Field label="Tegenstander">
            <TextInput
              value={weekend.match.opponent}
              onChange={(v) => patch((w) => ({ ...w, match: { ...w.match, opponent: v } }))}
            />
          </Field>
          <Field label="Sporthal / venue">
            <TextInput
              value={weekend.match.venue}
              onChange={(v) => patch((w) => ({ ...w, match: { ...w.match, venue: v } }))}
            />
          </Field>
          <Field label="Stad">
            <TextInput
              value={weekend.match.city}
              onChange={(v) => patch((w) => ({ ...w, match: { ...w.match, city: v } }))}
            />
          </Field>
          <div className="flex items-end pb-1.5">
            <Checkbox
              checked={weekend.match.isAway}
              onChange={(v) => patch((w) => ({ ...w, match: { ...w.match, isAway: v } }))}
              label="Uitwedstrijd"
            />
          </div>
          <Field label="Match start" className="sm:col-span-2">
            <DateTimeInput
              value={weekend.match.matchStart}
              onChange={(iso) => patch((w) => ({ ...w, match: { ...w.match, matchStart: iso } }))}
            />
          </Field>
          <Field label="Match end" hint="Incl. netjes uitspelen; startpunt critical path" className="sm:col-span-2">
            <DateTimeInput
              value={weekend.match.matchEnd}
              onChange={(iso) => patch((w) => ({ ...w, match: { ...w.match, matchEnd: iso } }))}
            />
          </Field>
        </div>
      </Card>

      {/* PHASE ----------------------------------------------------------- */}
      <Card eyebrow="Phase control" title="Fase en vastlegging">
        <Callout tone="warn" title="Raw override">
          De readiness-pagina bewaakt de gate: LOCKED hoort alleen te kunnen als alle gating checks
          PASS zijn. Deze select is een rauwe override en wordt als
          {" "}<span className="erp-mono">OVERRIDE: phase set to X</span> in het decision log
          gezet zodra je naar LOCKED gaat zonder groen licht. Gate staat nu op{" "}
          <span className="erp-mono font-semibold">{readiness.gate}</span> ({readiness.percent}%,{" "}
          {readiness.lockBlockers.length} blocker(s)).
        </Callout>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Field label="Fase">
            <Select value={weekend.phase} onChange={changePhase} options={PHASE_OPTIONS} />
          </Field>
          <div>
            <div className="erp-label mb-1">Huidige fase</div>
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={weekend.phase} />
              <Badge tone={readiness.canLock ? "go" : "nogo"}>
                {readiness.canLock ? "Lock toegestaan" : "Lock geblokkeerd"}
              </Badge>
            </div>
          </div>
          <div>
            <div className="erp-label mb-1">Lock blockers</div>
            <div className="text-[12px] text-muted leading-snug">
              {readiness.lockBlockers.length === 0
                ? "Geen open gating items."
                : readiness.lockBlockers.join(" · ")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-line">
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Headcount locked at</div>
            <div className="erp-mono text-[13px] mt-0.5">
              {weekend.headcountLockedAt ? formatDateTime(weekend.headcountLockedAt) : "—"}
            </div>
            <button
              className="btn btn-sm mt-2"
              disabled={!weekend.headcountLockedAt}
              onClick={() => {
                set("headcountLockedAt", null);
                logDecision("attendance", "Headcount lock opgeheven.");
              }}
            >
              Lock opheffen
            </button>
          </div>
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Plan final at</div>
            <div className="erp-mono text-[13px] mt-0.5">
              {weekend.planFinalAt ? formatDateTime(weekend.planFinalAt) : "—"}
            </div>
            <div className="text-[11px] text-faint mt-0.5">
              BOB lead time: {readiness.bobLeadTimeLabel}
            </div>
            <button
              className="btn btn-sm mt-2"
              disabled={!weekend.planFinalAt}
              onClick={() => {
                set("planFinalAt", null);
                logDecision("other", "Plan-definitief markering verwijderd.");
              }}
            >
              Markering wissen
            </button>
          </div>
        </div>
      </Card>

      {/* DECISION LOG ---------------------------------------------------- */}
      <Card eyebrow="Decision log" title={`Besluiten (${decisions.length})`} padded={false}>
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th className="whitespace-nowrap">Tijdstip</th>
                <th>Topic</th>
                <th>Besluit</th>
                <th className="w-[60px]" />
              </tr>
            </thead>
            <tbody>
              {decisions.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-muted">
                    Nog geen besluiten vastgelegd.
                  </td>
                </tr>
              )}
              {decisions.map((d) => {
                const h = hoursBetween(d.at, weekend.departureAt);
                const lastMinute = h >= 0 && h < 24;
                return (
                  <tr key={d.id}>
                    <td className="erp-mono whitespace-nowrap text-[12px]">
                      {formatDateTime(d.at)}
                    </td>
                    <td>
                      <Badge tone="neutral">{d.topic.toUpperCase()}</Badge>
                    </td>
                    <td className="text-[12.5px]">
                      {d.summary}
                      {lastMinute && (
                        <Badge tone="nogo" className="ml-2">
                          Last-minute
                        </Badge>
                      )}
                      {d.summary.startsWith("OVERRIDE:") && (
                        <Badge tone="warn" className="ml-2">
                          Override
                        </Badge>
                      )}
                    </td>
                    <td className="text-right">
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeDecision(d.id)}
                        aria-label="Besluit verwijderen"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-line grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 items-end">
          <Field label="Topic">
            <Select value={topic} onChange={setTopic} options={TOPIC_OPTIONS} />
          </Field>
          <Field label="Besluit">
            <TextInput
              value={summary}
              onChange={setSummary}
              placeholder="Kort en feitelijk, bijv. “Taxi’s gereserveerd voor 01:30”"
            />
          </Field>
          <button className="btn btn-primary btn-sm" onClick={addDecision}>
            <Plus size={13} /> Vastleggen
          </button>
        </div>
      </Card>

      {/* DANGER ZONE ----------------------------------------------------- */}
      <Card eyebrow="Danger zone" title="Onomkeerbare acties">
        <p className="text-[13px] text-muted leading-snug">
          Het weekend wordt uit de lokale opslag verwijderd, inclusief deelnemers, reserveringen,
          critical path, decision log en retrospective. Dit kan niet ongedaan gemaakt worden.
        </p>
        <button className="btn btn-danger btn-sm mt-3" onClick={deleteWeekend}>
          <Trash2 size={13} /> Verwijder weekend
        </button>
      </Card>
    </div>
  );
}
