"use client";

import { Plus, Trash2 } from "lucide-react";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import type {
  DecisionTopic,
  LocalEvent,
  NightlifeDestination,
  NightlifeType,
} from "@/lib/types";
import {
  estimateBzt,
  eveningContext,
  eventViability,
  formatDuration,
  groupSplitRisk,
  nightlifeViability,
  type EveningContext,
  type NightlifeViability,
} from "@/lib/engine";
import {
  Badge,
  Callout,
  Card,
  Checkbox,
  EmptyState,
  Field,
  NumberInput,
  Select,
  TextInput,
  toneForStatus,
} from "@/components/ui";

const TYPE_OPTIONS: { value: NightlifeType; label: string }[] = [
  { value: "pub", label: "PUB" },
  { value: "bar", label: "BAR" },
  { value: "club", label: "CLUB" },
  { value: "restaurantBar", label: "RESTAURANT + BAR" },
  { value: "event", label: "EVENT" },
  { value: "other", label: "OVERIG" },
];

const RETURN_OPTIONS: { value: LocalEvent["returnTransport"]; label: string }[] = [
  { value: "walk", label: "LOPEN" },
  { value: "car", label: "AUTO" },
  { value: "taxi", label: "TAXI" },
  { value: "unknown", label: "ONBEKEND" },
];

const FALLBACK_OPTIONS: { value: LocalEvent["isFallbackFor"]; label: string }[] = [
  { value: "nightlife", label: "AVONDPROGRAMMA" },
  { value: "dinner", label: "DINER" },
  { value: "both", label: "BEIDE" },
];

function blankDestination(isPrimary: boolean): NightlifeDestination {
  return {
    id: newId("n"),
    name: "Nieuwe bestemming",
    type: "pub",
    address: "",
    distanceKm: 0.5,
    walkMin: 8,
    opensAt: "17:00",
    closesAt: "01:00",
    kitchenClosesAt: "",
    suitableLargeGroup: false,
    reservationNeeded: false,
    reservationConfirmed: false,
    groupCapacity: 0,
    entrancePolicy: "",
    transportRequired: false,
    taxiRequired: false,
    taxiArranged: false,
    transfers: 0,
    fallbackAvailable: false,
    isPrimary,
    notes: "",
  };
}

function blankEvent(): LocalEvent {
  return {
    id: newId("e"),
    name: "Nieuw lokaal event",
    kind: "",
    address: "",
    distanceKm: 1,
    walkMin: 15,
    opensAt: "16:00",
    closesAt: "00:00",
    drinksAvailable: true,
    foodAvailable: false,
    suitableLargeGroup: true,
    returnTransport: "unknown",
    isFallbackFor: "nightlife",
    notes: "",
  };
}

export default function NightlifePage() {
  const { weekend, patch, now } = useCurrentWeekend();
  if (!weekend) return null;

  const ctx = eveningContext(weekend);
  const split = groupSplitRisk(weekend);
  const bzt = estimateBzt(weekend);

  const logDecision = (topic: DecisionTopic, summary: string) =>
    patch((w) => ({
      ...w,
      decisions: [...w.decisions, { id: newId("d"), at: now, topic, summary }],
    }));

  const updateDest = (id: string, changes: Partial<NightlifeDestination>) =>
    patch((w) => ({
      ...w,
      nightlife: w.nightlife.map((n) => (n.id === id ? { ...n, ...changes } : n)),
    }));

  const makePrimary = (dest: NightlifeDestination) => {
    patch((w) => ({
      ...w,
      nightlife: w.nightlife.map((n) => ({ ...n, isPrimary: n.id === dest.id })),
    }));
    logDecision("nightlife", `Primaire avondbestemming gezet op ${dest.name}.`);
  };

  const removeDest = (dest: NightlifeDestination) => {
    if (!window.confirm(`Bestemming “${dest.name}” verwijderen?`)) return;
    patch((w) => {
      const rest = w.nightlife.filter((n) => n.id !== dest.id);
      if (dest.isPrimary && rest.length > 0 && !rest.some((n) => n.isPrimary)) {
        rest[0] = { ...rest[0], isPrimary: true };
      }
      return { ...w, nightlife: rest };
    });
    logDecision("nightlife", `Avondbestemming ${dest.name} verwijderd.`);
  };

  const addDest = () => {
    patch((w) => ({
      ...w,
      nightlife: [...w.nightlife, blankDestination(w.nightlife.length === 0)],
    }));
    logDecision("nightlife", "Nieuwe avondbestemming toegevoegd aan de shortlist.");
  };

  const updateEvent = (id: string, changes: Partial<LocalEvent>) =>
    patch((w) => ({
      ...w,
      localEvents: w.localEvents.map((e) => (e.id === id ? { ...e, ...changes } : e)),
    }));

  const removeEvent = (e: LocalEvent) => {
    if (!window.confirm(`Event “${e.name}” verwijderen?`)) return;
    patch((w) => ({ ...w, localEvents: w.localEvents.filter((x) => x.id !== e.id) }));
  };

  return (
    <div className="space-y-5">
      {/* TOP STRIP ------------------------------------------------------ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card eyebrow="Evening context" title="Startpunt avondprogramma">
          <div className="erp-mono text-3xl font-semibold leading-none text-navy">
            {ctx.arrivalClock}
          </div>
          <div className="text-[12px] text-muted mt-1.5 leading-snug">
            Verwachte aankomst op de avondlocatie
            {weekend.dinner.known
              ? ` (na diner ${weekend.dinner.time || "?"} + ${weekend.dinner.durationMin} min).`
              : " (aanname: diner onbekend)."}
          </div>
          <div className="mt-2 pt-2 border-t border-line flex items-center justify-between">
            <span className="erp-label">Group size</span>
            <span className="erp-mono text-lg font-semibold text-navy">{ctx.groupSize}</span>
          </div>
        </Card>

        <Card navy eyebrow="Group split risk" title="Blijft het team bij elkaar?">
          <Badge
            tone={toneForStatus(split.level)}
            className="text-[13px] px-2.5 py-1"
          >
            {split.level}
          </Badge>
          <p className="text-[13px] leading-snug text-white/85 mt-2">{split.reason}</p>
          <ul className="mt-2 pt-2 border-t border-white/10 space-y-1">
            {split.factors.map((f) => (
              <li key={f} className="text-[12px] text-white/65 leading-snug flex gap-2">
                <span className="text-sky">·</span>
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="erp-label mt-2 pt-2 border-t border-white/10">
            BZT-aftrek {Math.round(split.bztPenaltyFactor * 100)}%
          </div>
        </Card>

        <Card eyebrow="BZT estimate" title="Beschikbare Zuip Tijd">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <div className="erp-label">Bruto</div>
              <div className="erp-mono text-lg font-semibold">{formatDuration(bzt.grossMin)}</div>
            </div>
            <div>
              <div className="erp-label">Aftrek</div>
              <div
                className={`erp-mono text-lg font-semibold ${bzt.splitPenaltyMin > 0 ? "text-nogo" : ""}`}
              >
                {bzt.splitPenaltyMin > 0 ? "−" : ""}
                {formatDuration(bzt.splitPenaltyMin)}
              </div>
            </div>
            <div>
              <div className="erp-label">Netto</div>
              <div className={`erp-mono text-lg font-semibold ${bzt.netMin > 0 ? "text-go" : "text-nogo"}`}>
                {formatDuration(bzt.netMin)}
              </div>
            </div>
          </div>
          <p className="text-[12px] text-muted mt-2 pt-2 border-t border-line leading-snug">
            {bzt.detail}
          </p>
        </Card>
      </div>

      {/* CALLOUT + COMPARISON ------------------------------------------- */}
      <Callout tone="warn" title="Nightlife viability">
        “Kroeg gevonden” is onvoldoende. Een kroeg op 5 minuten afstand die om 22:00 sluit is
        niet automatisch goed.
      </Callout>

      <Card eyebrow="Comparison" title="Alle bestemmingen naast elkaar" padded={false}>
        {weekend.nightlife.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted">Nog geen bestemmingen ingevoerd.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="erp">
              <thead>
                <tr>
                  <th>Bestemming</th>
                  <th>Heen/terug</th>
                  <th>Sluit</th>
                  <th>BZT-window</th>
                  <th>Groep ok</th>
                  <th>Reservering</th>
                  <th className="text-right">Viability</th>
                  <th>Split-risk flags</th>
                </tr>
              </thead>
              <tbody>
                {weekend.nightlife.map((n) => {
                  const v = nightlifeViability(n, ctx);
                  const flags = [
                    n.transportRequired ? "TRANSPORT" : null,
                    n.taxiRequired ? (n.taxiArranged ? "TAXI OK" : "TAXI NIET GEREGELD") : null,
                    n.transfers >= 3 ? `${n.transfers} TRANSFERS` : null,
                    !n.suitableLargeGroup && n.groupCapacity < ctx.groupSize
                      ? "GROEP PAST NIET"
                      : null,
                  ].filter((x): x is string => x !== null);
                  return (
                    <tr key={n.id}>
                      <td className="font-semibold text-navy whitespace-nowrap">
                        {n.name}
                        {n.isPrimary && (
                          <Badge tone="navy" className="ml-2">
                            Primary
                          </Badge>
                        )}
                      </td>
                      <td className="erp-mono whitespace-nowrap">
                        {n.transportRequired
                          ? `${n.distanceKm} km${n.taxiRequired ? " taxi" : " auto"}`
                          : `${n.walkMin} min lopen`}
                      </td>
                      <td className="erp-mono">{n.closesAt || "—"}</td>
                      <td className="erp-mono">{formatDuration(v.bztWindowMin)}</td>
                      <td>
                        <Badge
                          tone={
                            n.suitableLargeGroup && n.groupCapacity >= ctx.groupSize ? "go" : "warn"
                          }
                        >
                          {n.suitableLargeGroup && n.groupCapacity >= ctx.groupSize ? "JA" : "KRAP"}
                        </Badge>
                      </td>
                      <td>
                        {!n.reservationNeeded ? (
                          <span className="text-muted">n.v.t.</span>
                        ) : (
                          <Badge tone={n.reservationConfirmed ? "go" : "nogo"}>
                            {n.reservationConfirmed ? "BEVESTIGD" : "OPEN"}
                          </Badge>
                        )}
                      </td>
                      <td className="text-right">
                        <span className="erp-mono font-semibold">{v.score}</span>
                        <span className="text-faint">/100</span>{" "}
                        <Badge tone={toneForStatus(v.grade)}>{v.grade}</Badge>
                      </td>
                      <td className="text-[11.5px] text-muted">
                        {flags.length === 0 ? "—" : flags.join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* DESTINATIONS ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="erp-label">Destinations</div>
          <h2 className="text-sm font-bold text-navy">Avondbestemmingen · viability assessment</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={addDest}>
          <Plus size={13} /> Nieuwe bestemming
        </button>
      </div>

      {weekend.nightlife.length === 0 ? (
        <EmptyState title="Geen avondbestemming vastgelegd">
          Zonder bestemming is Group Split Risk per definitie CRITICAL: niemand weet waar de groep
          heen gaat, laat staan hoe men terugkomt.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {weekend.nightlife.map((n) => (
            <DestinationCard
              key={n.id}
              dest={n}
              ctx={ctx}
              viability={nightlifeViability(n, ctx)}
              onChange={(changes) => updateDest(n.id, changes)}
              onPrimary={() => makePrimary(n)}
              onRemove={() => removeDest(n)}
            />
          ))}
        </div>
      )}

      {/* LOCAL EVENTS ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
        <div>
          <div className="erp-label">Local event fallback</div>
          <h2 className="text-sm font-bold text-navy">Lokale events als praktisch alternatief</h2>
        </div>
        <button
          className="btn btn-sm"
          onClick={() => patch((w) => ({ ...w, localEvents: [...w.localEvents, blankEvent()] }))}
        >
          <Plus size={13} /> Nieuw event
        </button>
      </div>

      <Callout tone="neutral">
        Geen toeristische aanbevelingen: een event is alleen relevant als praktisch alternatief voor
        het avondprogramma; beoordeeld met dezelfde maatstaf als horeca.
      </Callout>

      {weekend.localEvents.length === 0 ? (
        <div className="card px-4 py-5 text-sm text-muted">
          Geen lokale events geregistreerd. Voeg er alleen een toe als het een reëel alternatief is
          voor de avond of het diner.
        </div>
      ) : (
        <div className="space-y-3">
          {weekend.localEvents.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              viability={eventViability(e, ctx)}
              onChange={(changes) => updateEvent(e.id, changes)}
              onRemove={() => removeEvent(e)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function FactorTable({ viability }: { viability: NightlifeViability }) {
  return (
    <div className="overflow-x-auto">
      <table className="erp">
        <thead>
          <tr>
            <th>Factor</th>
            <th className="text-right">Punten</th>
            <th>Toelichting</th>
          </tr>
        </thead>
        <tbody>
          {viability.factors.map((f, i) => (
            <tr key={`${f.label}-${i}`}>
              <td className="whitespace-nowrap font-semibold text-navy">{f.label}</td>
              <td
                className={`text-right erp-mono font-semibold ${
                  f.points > 0 ? "text-go" : f.points < 0 ? "text-nogo" : "text-faint"
                }`}
              >
                {f.points > 0 ? `+${f.points}` : f.points}
              </td>
              <td className="text-[12px] text-muted">{f.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DestinationCard({
  dest,
  ctx,
  viability,
  onChange,
  onPrimary,
  onRemove,
}: {
  dest: NightlifeDestination;
  ctx: EveningContext;
  viability: NightlifeViability;
  onChange: (changes: Partial<NightlifeDestination>) => void;
  onPrimary: () => void;
  onRemove: () => void;
}) {
  return (
    <section className="card">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3 pb-3 border-b border-line">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-navy">{dest.name || "Naamloos"}</h3>
            <Badge tone="neutral">
              {TYPE_OPTIONS.find((t) => t.value === dest.type)?.label ?? dest.type}
            </Badge>
            {dest.isPrimary && <Badge tone="navy">Primary</Badge>}
          </div>
          <p className="text-[12.5px] text-muted mt-1 leading-snug max-w-2xl">{viability.verdict}</p>
          <div className="erp-label mt-1">
            BZT-window {formatDuration(viability.bztWindowMin)} · groep {ctx.groupSize}
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="erp-mono text-3xl font-semibold leading-none text-navy">
            {viability.score}
            <span className="text-base text-faint">/100</span>
          </div>
          <div className="mt-1">
            <Badge tone={toneForStatus(viability.grade)}>{viability.grade}</Badge>
          </div>
        </div>
      </header>

      <FactorTable viability={viability} />

      <div className="px-4 py-3 border-t border-line grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Naam" className="sm:col-span-2">
          <TextInput value={dest.name} onChange={(v) => onChange({ name: v })} />
        </Field>
        <Field label="Type">
          <Select value={dest.type} onChange={(v) => onChange({ type: v })} options={TYPE_OPTIONS} />
        </Field>
        <Field label="Adres">
          <TextInput value={dest.address} onChange={(v) => onChange({ address: v })} />
        </Field>

        <Field label="Afstand (km)">
          <NumberInput
            value={dest.distanceKm}
            step={0.1}
            onChange={(v) => onChange({ distanceKm: v })}
          />
        </Field>
        <Field label="Looptijd (min)">
          <NumberInput value={dest.walkMin} onChange={(v) => onChange({ walkMin: v })} />
        </Field>
        <Field label="Opent" hint="HH:MM">
          <TextInput value={dest.opensAt} onChange={(v) => onChange({ opensAt: v })} placeholder="17:00" />
        </Field>
        <Field label="Sluit" hint="HH:MM, na middernacht toegestaan">
          <TextInput value={dest.closesAt} onChange={(v) => onChange({ closesAt: v })} placeholder="02:00" />
        </Field>

        <Field label="Keuken sluit" hint="Leeg = geen keuken">
          <TextInput
            value={dest.kitchenClosesAt}
            onChange={(v) => onChange({ kitchenClosesAt: v })}
            placeholder="21:30"
          />
        </Field>
        <Field label="Groepscapaciteit">
          <NumberInput value={dest.groupCapacity} onChange={(v) => onChange({ groupCapacity: v })} />
        </Field>
        <Field label="Entreebeleid" className="sm:col-span-2">
          <TextInput
            value={dest.entrancePolicy}
            onChange={(v) => onChange({ entrancePolicy: v })}
            placeholder="18+, geen sportkleding…"
          />
        </Field>

        <Field label="Transfers" hint="Verplaatsingen heen én terug">
          <NumberInput value={dest.transfers} onChange={(v) => onChange({ transfers: v })} />
        </Field>
        <Field label="Notities" className="sm:col-span-2 lg:col-span-3">
          <TextInput value={dest.notes ?? ""} onChange={(v) => onChange({ notes: v })} />
        </Field>
      </div>

      <div className="px-4 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <Checkbox
          checked={dest.suitableLargeGroup}
          onChange={(v) => onChange({ suitableLargeGroup: v })}
          label="Geschikt voor grote groep"
        />
        <Checkbox
          checked={dest.reservationNeeded}
          onChange={(v) => onChange({ reservationNeeded: v })}
          label="Reservering nodig"
        />
        <Checkbox
          checked={dest.reservationConfirmed}
          onChange={(v) => onChange({ reservationConfirmed: v })}
          label="Reservering bevestigd"
        />
        <Checkbox
          checked={dest.transportRequired}
          onChange={(v) => onChange({ transportRequired: v })}
          label="Vervoer nodig"
        />
        <Checkbox
          checked={dest.taxiRequired}
          onChange={(v) => onChange({ taxiRequired: v })}
          label="Taxi nodig"
        />
        <Checkbox
          checked={dest.taxiArranged}
          onChange={(v) => onChange({ taxiArranged: v })}
          label="Taxi geregeld"
        />
        <Checkbox
          checked={dest.fallbackAvailable}
          onChange={(v) => onChange({ fallbackAvailable: v })}
          label="Fallback aanwezig"
        />
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <button
          className="btn btn-primary btn-sm"
          onClick={onPrimary}
          disabled={dest.isPrimary}
        >
          Maak primair
        </button>
        <button className="btn btn-danger btn-sm" onClick={onRemove}>
          <Trash2 size={13} /> Verwijder
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function EventCard({
  event,
  viability,
  onChange,
  onRemove,
}: {
  event: LocalEvent;
  viability: NightlifeViability;
  onChange: (changes: Partial<LocalEvent>) => void;
  onRemove: () => void;
}) {
  return (
    <section className="card">
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3 pb-3 border-b border-line">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-navy">{event.name || "Naamloos event"}</h3>
            {event.kind && <Badge tone="neutral">{event.kind}</Badge>}
            <Badge tone="neutral">
              Fallback:{" "}
              {FALLBACK_OPTIONS.find((o) => o.value === event.isFallbackFor)?.label ??
                event.isFallbackFor}
            </Badge>
          </div>
          <p className="text-[12.5px] text-muted mt-1 leading-snug max-w-2xl">{viability.verdict}</p>
        </div>
        <div className="text-right shrink-0">
          <div className="erp-mono text-2xl font-semibold leading-none text-navy">
            {viability.score}
            <span className="text-sm text-faint">/100</span>
          </div>
          <div className="mt-1">
            <Badge tone={toneForStatus(viability.grade)}>{viability.grade}</Badge>
          </div>
        </div>
      </header>

      <FactorTable viability={viability} />

      <div className="px-4 py-3 border-t border-line grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Naam" className="sm:col-span-2">
          <TextInput value={event.name} onChange={(v) => onChange({ name: v })} />
        </Field>
        <Field label="Soort" hint="kermis, festival, bierfestival…">
          <TextInput value={event.kind} onChange={(v) => onChange({ kind: v })} />
        </Field>
        <Field label="Adres">
          <TextInput value={event.address} onChange={(v) => onChange({ address: v })} />
        </Field>
        <Field label="Afstand (km)">
          <NumberInput
            value={event.distanceKm}
            step={0.1}
            onChange={(v) => onChange({ distanceKm: v })}
          />
        </Field>
        <Field label="Looptijd (min)">
          <NumberInput value={event.walkMin} onChange={(v) => onChange({ walkMin: v })} />
        </Field>
        <Field label="Opent" hint="HH:MM">
          <TextInput value={event.opensAt} onChange={(v) => onChange({ opensAt: v })} />
        </Field>
        <Field label="Sluit" hint="HH:MM">
          <TextInput value={event.closesAt} onChange={(v) => onChange({ closesAt: v })} />
        </Field>
        <Field label="Terugreis">
          <Select
            value={event.returnTransport}
            onChange={(v) => onChange({ returnTransport: v })}
            options={RETURN_OPTIONS}
          />
        </Field>
        <Field label="Fallback voor">
          <Select
            value={event.isFallbackFor}
            onChange={(v) => onChange({ isFallbackFor: v })}
            options={FALLBACK_OPTIONS}
          />
        </Field>
        <Field label="Notities" className="sm:col-span-2">
          <TextInput value={event.notes ?? ""} onChange={(v) => onChange({ notes: v })} />
        </Field>
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-x-4 gap-y-2">
        <Checkbox
          checked={event.drinksAvailable}
          onChange={(v) => onChange({ drinksAvailable: v })}
          label="Drank beschikbaar"
        />
        <Checkbox
          checked={event.foodAvailable}
          onChange={(v) => onChange({ foodAvailable: v })}
          label="Eten beschikbaar"
        />
        <Checkbox
          checked={event.suitableLargeGroup}
          onChange={(v) => onChange({ suitableLargeGroup: v })}
          label="Geschikt voor grote groep"
        />
      </div>

      <div className="px-4 pb-3 pt-3 border-t border-line">
        <button className="btn btn-danger btn-sm" onClick={onRemove}>
          <Trash2 size={13} /> Verwijder event
        </button>
      </div>
    </section>
  );
}
