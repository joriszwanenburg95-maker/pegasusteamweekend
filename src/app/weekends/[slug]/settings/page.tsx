"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { newId, useStore } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import { WEEKEND_PHASES, type DecisionTopic, type WeekendPhase } from "@/lib/types";
import { evaluateReadiness, formatDateTime, hoursBetween } from "@/lib/engine";
import { nl } from "@/lib/labels";
import {
  Badge,
  Callout,
  Card,
  Checkbox,
  DateTimeInput,
  Field,
  PhaseBadge,
  Select,
  StatusBadge,
  TextInput,
} from "@/components/ui";
import { PhaseStepper } from "@/components/viz";

const TOPIC_OPTIONS: { value: DecisionTopic; label: string }[] = (
  ["attendance", "accommodation", "dinner", "nightlife", "transport", "activity", "other"] as DecisionTopic[]
).map((v) => ({ value: v, label: v === "other" ? "Overig" : nl(v) }));

const PHASE_OPTIONS: { value: WeekendPhase; label: string }[] = WEEKEND_PHASES.map((p) => ({
  value: p,
  label: nl(p),
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
      logDecision(
        "other",
        `OVERRIDE: fase op ${nl(phase)} gezet zonder groen licht van de gereedheidspoort.`,
      );
    } else {
      logDecision("other", `Fase gewijzigd van ${nl(weekend.phase)} naar ${nl(phase)}.`);
    }
  };

  const addDecision = () => {
    const text = summary.trim();
    if (!text) return;
    logDecision(topic, text);
    setSummary("");
  };

  const removeDecision = (id: string) => {
    if (!window.confirm("Deze regel uit het besluitenlog verwijderen?")) return;
    patch((w) => ({ ...w, decisions: w.decisions.filter((d) => d.id !== id) }));
  };

  const deleteWeekend = () => {
    if (
      !window.confirm(
        `Weekend “${weekend.name}” definitief verwijderen? Alle deelnemers, reserveringen en het besluitenlog gaan verloren.`,
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
          Dit weekend is vastgelegd als historische case: pas het alleen aan als de registratie
          feitelijk onjuist is.
        </Callout>
      )}

      {/* BASISGEGEVENS ---------------------------------------------------- */}
      <Card eyebrow="Basisgegevens" title="Weekend" className="rise rise-1">
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
          <Field label="Vertrek" hint="Vertrek uit Nijmegen" className="sm:col-span-2">
            <DateTimeInput value={weekend.departureAt} onChange={(iso) => set("departureAt", iso)} />
          </Field>
          <Field label="Terugkomst" className="sm:col-span-2">
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

      {/* WEDSTRIJD -------------------------------------------------------- */}
      <Card eyebrow="Wedstrijdcontext" title="Wedstrijd" className="rise rise-2">
        <Checkbox
          checked={weekend.match.hasMatch}
          onChange={(v) => patch((w) => ({ ...w, match: { ...w.match, hasMatch: v } }))}
          label="Er wordt een wedstrijd gespeeld (kritiek pad start bij EINDE WEDSTRIJD)"
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
          <Field label="Tegenstander">
            <TextInput
              value={weekend.match.opponent}
              onChange={(v) => patch((w) => ({ ...w, match: { ...w.match, opponent: v } }))}
            />
          </Field>
          <Field label="Sporthal">
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
          <Field label="Aanvang wedstrijd" className="sm:col-span-2">
            <DateTimeInput
              value={weekend.match.matchStart}
              onChange={(iso) => patch((w) => ({ ...w, match: { ...w.match, matchStart: iso } }))}
            />
          </Field>
          <Field
            label="Einde wedstrijd"
            hint="Incl. netjes uitspelen; startpunt kritiek pad"
            className="sm:col-span-2"
          >
            <DateTimeInput
              value={weekend.match.matchEnd}
              onChange={(iso) => patch((w) => ({ ...w, match: { ...w.match, matchEnd: iso } }))}
            />
          </Field>
        </div>
      </Card>

      {/* FASE ------------------------------------------------------------- */}
      <Card eyebrow="Fasebeheer" title="Fase en vastlegging" className="rise rise-3">
        <div className="pt-1 pb-3">
          <PhaseStepper phases={WEEKEND_PHASES} current={weekend.phase} labels={nl} />
        </div>

        <Callout tone="warn" title="Directe override">
          De gereedheidspagina bewaakt de poort: {nl("LOCKED")} hoort alleen te kunnen als alle
          blokkerende checks {nl("PASS")} zijn. Deze keuzelijst omzeilt dat en legt het vast als{" "}
          <span className="erp-mono">OVERRIDE: fase op … gezet</span> in het besluitenlog.
        </Callout>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <Field label="Fase">
            <Select value={weekend.phase} onChange={changePhase} options={PHASE_OPTIONS} />
          </Field>
          <div>
            <div className="erp-label mb-1">Huidige stand</div>
            <div className="flex flex-wrap items-center gap-2">
              <PhaseBadge phase={weekend.phase} />
              <StatusBadge status={readiness.gate} />
              <Badge tone={readiness.canLock ? "go" : "nogo"}>
                {readiness.canLock ? "Vergrendelen mag" : "Vergrendelen geblokkeerd"}
              </Badge>
              <span className="erp-mono text-[12px] text-muted">{readiness.percent}%</span>
            </div>
          </div>
          <div>
            <div className="erp-label mb-1">Blokkerende punten</div>
            <div className="text-[12px] text-muted leading-snug">
              {readiness.lockBlockers.length === 0
                ? "Geen open blokkerende punten."
                : readiness.lockBlockers.join(" · ")}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-line">
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Deelnemersaantal vastgezet op</div>
            <div className="erp-mono text-[13px] mt-0.5">
              {weekend.headcountLockedAt ? formatDateTime(weekend.headcountLockedAt) : "—"}
            </div>
            <button
              className="btn btn-sm mt-2"
              disabled={!weekend.headcountLockedAt}
              onClick={() => {
                set("headcountLockedAt", null);
                logDecision("attendance", "Vastzetting van het deelnemersaantal opgeheven.");
              }}
            >
              Vastzetting opheffen
            </button>
          </div>
          <div className="rounded-[6px] border border-line px-3 py-2">
            <div className="erp-label">Plan definitief op</div>
            <div className="erp-mono text-[13px] mt-0.5">
              {weekend.planFinalAt ? formatDateTime(weekend.planFinalAt) : "—"}
            </div>
            <div className="text-[11px] text-faint mt-0.5">
              Voorbereidingstijd voor de BOB: {readiness.bobLeadTimeLabel}
            </div>
            <button
              className="btn btn-sm mt-2"
              disabled={!weekend.planFinalAt}
              onClick={() => {
                set("planFinalAt", null);
                logDecision("other", "Markering ‘plan definitief’ verwijderd.");
              }}
            >
              Markering wissen
            </button>
          </div>
        </div>
      </Card>

      {/* BESLUITENLOG ------------------------------------------------------ */}
      <Card
        eyebrow="Besluitenlog"
        title={`Besluiten (${decisions.length})`}
        className="rise rise-4"
      >
        {decisions.length === 0 ? (
          <div className="text-sm text-muted">Nog geen besluiten vastgelegd.</div>
        ) : (
          <ol className="relative pl-6">
            <span className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-line" aria-hidden />
            {decisions.map((d) => {
              const h = hoursBetween(d.at, weekend.departureAt);
              const lastMinute = h >= 0 && h < 24;
              const override = d.summary.startsWith("OVERRIDE:");
              return (
                <li key={d.id} className="relative pb-2.5 group">
                  <span
                    className={`absolute -left-6 top-[6px] w-2.5 h-2.5 rounded-full viz-pop ${
                      override ? "bg-warn" : lastMinute ? "bg-nogo" : "bg-cobalt"
                    }`}
                    aria-hidden
                  />
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="erp-mono text-[11px] text-faint whitespace-nowrap">
                      {formatDateTime(d.at)}
                    </span>
                    <Badge tone="neutral">{d.topic === "other" ? "Overig" : nl(d.topic)}</Badge>
                    {lastMinute && <Badge tone="nogo">Last-minute</Badge>}
                    {override && <Badge tone="warn">Override</Badge>}
                    <button
                      className="btn btn-sm btn-danger ml-auto shrink-0"
                      onClick={() => removeDecision(d.id)}
                      aria-label="Besluit verwijderen"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <div className="text-[12.5px] leading-snug mt-0.5">{d.summary}</div>
                </li>
              );
            })}
          </ol>
        )}

        <div className="mt-3 pt-3 border-t border-line grid grid-cols-1 sm:grid-cols-[180px_1fr_auto] gap-2 items-end">
          <Field label="Onderwerp">
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

      {/* GEVARENZONE ------------------------------------------------------- */}
      <Card eyebrow="Gevarenzone" title="Onomkeerbare acties" className="rise rise-5">
        <p className="text-[13px] text-muted leading-snug">
          Het weekend verdwijnt uit de lokale opslag, inclusief deelnemers, reserveringen, kritiek
          pad, besluitenlog en terugblik. Dit kan niet ongedaan gemaakt worden.
        </p>
        <button className="btn btn-danger btn-sm mt-3" onClick={deleteWeekend}>
          <Trash2 size={13} /> Weekend verwijderen
        </button>
      </Card>
    </div>
  );
}
