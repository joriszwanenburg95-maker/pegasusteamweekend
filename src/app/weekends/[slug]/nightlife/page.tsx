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
  parseClock,
  type EveningContext,
  type NightlifeViability,
} from "@/lib/engine";
import { nl } from "@/lib/labels";
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
import { CountUp, Gauge, StackedBar, TimeWindowBar, toneColor, type TimeSpan } from "@/components/viz";

const TYPE_OPTIONS: { value: NightlifeType; label: string }[] = (
  ["pub", "bar", "club", "restaurantBar", "event", "other"] as NightlifeType[]
).map((v) => ({ value: v, label: nl(v) }));

const RETURN_OPTIONS: { value: LocalEvent["returnTransport"]; label: string }[] = (
  ["walk", "car", "taxi", "unknown"] as LocalEvent["returnTransport"][]
).map((v) => ({ value: v, label: nl(v) }));

function fallbackLabel(v: LocalEvent["isFallbackFor"]): string {
  return v === "both" ? `${nl("nightlife")} + ${nl("dinner")}` : nl(v);
}

const FALLBACK_OPTIONS: { value: LocalEvent["isFallbackFor"]; label: string }[] = (
  ["nightlife", "dinner", "both"] as LocalEvent["isFallbackFor"][]
).map((v) => ({ value: v, label: fallbackLabel(v) }));

const SPLIT_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

/** Klokwaarden vóór 12:00 horen bij de nacht ná de avond: schuif ze een dag door. */
function eveningMinutes(clock: string): number | null {
  const m = parseClock(clock);
  if (m === null) return null;
  return m < 12 * 60 ? m + 1440 : m;
}

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
    name: "Nieuw lokaal evenement",
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
    if (!window.confirm(`Evenement “${e.name}” verwijderen?`)) return;
    patch((w) => ({ ...w, localEvents: w.localEvents.filter((x) => x.id !== e.id) }));
  };

  return (
    <div className="space-y-5">
      {/* BOVENSTE STROOK ------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Card eyebrow="Avondcontext" title="Start avondprogramma" className="rise rise-1">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="erp-mono text-3xl font-semibold leading-none text-navy">
                {ctx.arrivalClock}
              </div>
              <div className="erp-label mt-1.5">Aankomst avondlocatie</div>
            </div>
            <div className="text-right">
              <div className="erp-mono text-3xl font-semibold leading-none text-navy">
                <CountUp value={ctx.groupSize} />
              </div>
              <div className="erp-label mt-1.5">Groepsgrootte</div>
            </div>
          </div>
          <div className="mt-2 pt-2 border-t border-line text-[12px] text-muted leading-snug">
            {weekend.dinner.known
              ? `Na eten om ${weekend.dinner.time || "?"} plus ${weekend.dinner.durationMin} min.`
              : "Aanname: eten nog onbekend."}
          </div>
        </Card>

        <Card navy eyebrow="Groepssplitsingsrisico" title="Blijft het team bij elkaar?" className="rise rise-2">
          <SplitMeter level={split.level} />
          <p className="text-[13px] leading-snug text-white/85 mt-2.5">{split.reason}</p>
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

        <Card eyebrow="BZT-raming" title="Bier Zuip Tijd" className="rise rise-3">
          <div className="flex items-center gap-3">
            <Gauge
              value={bzt.netMin}
              max={Math.max(bzt.grossMin, 1)}
              size={86}
              stroke={9}
              tone={bzt.netMin > 0 ? "go" : "nogo"}
              label="netto min"
            />
            <div className="min-w-0 flex-1">
              <StackedBar
                segments={[
                  { label: "Netto", value: bzt.netMin, tone: "go" },
                  { label: "Aftrek", value: bzt.splitPenaltyMin, tone: "nogo" },
                ]}
                formatValue={(v) => formatDuration(v)}
              />
              <div className="erp-mono text-[12px] text-muted mt-2">
                Bruto {formatDuration(bzt.grossMin)}
              </div>
            </div>
          </div>
          <p className="text-[12px] text-muted mt-2 pt-2 border-t border-line leading-snug">
            {bzt.detail}
          </p>
        </Card>
      </div>

      {/* CALLOUT + VERGELIJKING ------------------------------------------ */}
      <Callout tone="warn" title="Haalbaarheid avondlocatie">
        Een kroeg op vijf minuten lopen die om 22:00 sluit is niet automatisch goed.
      </Callout>

      <Card eyebrow="Vergelijking" title="Alle bestemmingen naast elkaar" padded={false} className="rise rise-4">
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
                  <th>BZT-venster</th>
                  <th>Groep</th>
                  <th>Reservering</th>
                  <th className="text-right">Score</th>
                  <th>Signalen</th>
                </tr>
              </thead>
              <tbody>
                {weekend.nightlife.map((n) => {
                  const v = nightlifeViability(n, ctx);
                  const flags = [
                    n.transportRequired ? "VERVOER NODIG" : null,
                    n.taxiRequired ? (n.taxiArranged ? "TAXI GEREGELD" : "TAXI NIET GEREGELD") : null,
                    n.transfers >= 3 ? `${n.transfers} VERPLAATSINGEN` : null,
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
                            Primair
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
                          {n.suitableLargeGroup && n.groupCapacity >= ctx.groupSize ? "PAST" : "KRAP"}
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
                      <td className="text-right whitespace-nowrap">
                        <span className="erp-mono font-semibold">{v.score}</span>
                        <span className="text-faint">/100</span>{" "}
                        <Badge tone={toneForStatus(v.grade)}>{nl(v.grade)}</Badge>
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

      {/* BESTEMMINGEN ----------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="erp-label">Bestemmingen</div>
          <h2 className="text-sm font-bold text-navy">Avondbestemmingen · haalbaarheid</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={addDest}>
          <Plus size={13} /> Nieuwe bestemming
        </button>
      </div>

      {weekend.nightlife.length === 0 ? (
        <EmptyState title="Geen avondbestemming vastgelegd">
          Zonder bestemming is het groepssplitsingsrisico per definitie {nl("CRITICAL")}: niemand
          weet waar de groep heen gaat, laat staan hoe men terugkomt.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {weekend.nightlife.map((n, i) => (
            <DestinationCard
              key={n.id}
              dest={n}
              ctx={ctx}
              viability={nightlifeViability(n, ctx)}
              riseIndex={i}
              onChange={(changes) => updateDest(n.id, changes)}
              onPrimary={() => makePrimary(n)}
              onRemove={() => removeDest(n)}
            />
          ))}
        </div>
      )}

      {/* LOKALE EVENEMENTEN ----------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-line">
        <div>
          <div className="erp-label">Terugvaloptie</div>
          <h2 className="text-sm font-bold text-navy">Lokale evenementen als alternatief</h2>
        </div>
        <button
          className="btn btn-sm"
          onClick={() => patch((w) => ({ ...w, localEvents: [...w.localEvents, blankEvent()] }))}
        >
          <Plus size={13} /> Nieuw evenement
        </button>
      </div>

      <Callout tone="neutral">
        Alleen relevant als praktisch alternatief voor de avond of het eten, beoordeeld met dezelfde
        maatstaf als horeca.
      </Callout>

      {weekend.localEvents.length === 0 ? (
        <div className="card px-4 py-5 text-sm text-muted">
          Geen lokale evenementen geregistreerd.
        </div>
      ) : (
        <div className="space-y-3">
          {weekend.localEvents.map((e, i) => (
            <EventCard
              key={e.id}
              event={e}
              viability={eventViability(e, ctx)}
              riseIndex={i}
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

/** Vier-staps meter voor het groepssplitsingsrisico (op navy achtergrond). */
function SplitMeter({ level }: { level: (typeof SPLIT_LEVELS)[number] }) {
  const idx = SPLIT_LEVELS.indexOf(level);
  const color = toneColor(toneForStatus(level));
  return (
    <div className="flex gap-1.5" role="img" aria-label={`Groepssplitsingsrisico ${nl(level)}`}>
      {SPLIT_LEVELS.map((l, i) => (
        <div key={l} className="flex-1 min-w-0">
          <div
            className="h-2.5 rounded-full viz-grow-x"
            style={{
              background: i <= idx ? color : "rgba(255,255,255,0.14)",
              animationDelay: `${i * 70}ms`,
            }}
          />
          <div
            className={`mt-1 text-[8.5px] font-bold tracking-[0.08em] uppercase truncate ${
              i === idx ? "text-white" : "text-white/40"
            }`}
          >
            {nl(l)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Plus/min-staafjes per scorefactor, in plaats van een tabel met cijfers. */
function FactorBars({ viability }: { viability: NightlifeViability }) {
  const max = Math.max(10, ...viability.factors.map((f) => Math.abs(f.points)));
  return (
    <ul className="px-4 py-3 space-y-1.5">
      {viability.factors.map((f, i) => {
        const pos = f.points >= 0;
        const width = `${(Math.abs(f.points) / max) * 50}%`;
        return (
          <li
            key={`${f.label}-${i}`}
            className="grid grid-cols-[84px_1fr_34px] sm:grid-cols-[96px_120px_34px_1fr] items-center gap-2"
          >
            <span className="erp-label truncate" title={f.label}>
              {f.label}
            </span>
            <div className="relative h-3 rounded-sm bg-sunken overflow-hidden" title={f.detail}>
              <span className="absolute inset-y-0 left-1/2 w-px bg-line-strong" />
              <span
                className="absolute inset-y-0 viz-grow-x rounded-sm"
                style={{
                  width,
                  background: toneColor(pos ? (f.points === 0 ? "unknown" : "go") : "nogo"),
                  left: pos ? "50%" : undefined,
                  right: pos ? undefined : "50%",
                  transformOrigin: pos ? "left center" : "right center",
                  animationDelay: `${i * 50}ms`,
                }}
              />
            </div>
            <span
              className={`erp-mono text-[11.5px] font-semibold text-right ${
                f.points > 0 ? "text-go" : f.points < 0 ? "text-nogo" : "text-faint"
              }`}
            >
              {f.points > 0 ? `+${f.points}` : f.points}
            </span>
            <span className="hidden sm:block text-[11.5px] text-muted truncate" title={f.detail}>
              {f.detail}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/** Avondbalk: BZT-venster van aankomst tot sluiting, plus eventueel de keuken. */
function EveningBar({ dest, arrivalClock }: { dest: NightlifeDestination; arrivalClock: string }) {
  const arrive = eveningMinutes(arrivalClock);
  const close = eveningMinutes(dest.closesAt);
  const opens = eveningMinutes(dest.opensAt);
  const kitchen = dest.kitchenClosesAt ? eveningMinutes(dest.kitchenClosesAt) : null;

  const spans: TimeSpan[] = [];
  if (kitchen !== null) {
    const from = Math.min(opens ?? kitchen, kitchen);
    if (kitchen > from) spans.push({ label: "Keuken", fromMin: from, toMin: kitchen, tone: "warn" });
  }
  if (arrive !== null && close !== null && close > arrive) {
    spans.push({ label: "BZT-venster", fromMin: arrive, toMin: close, tone: "go" });
  }

  const endMin = Math.max(28 * 60, (close ?? 0) + 30);
  return (
    <TimeWindowBar
      spans={spans}
      endMin={endMin}
      markers={arrive === null ? [] : [{ atMin: arrive, label: "aankomst", tone: "navy" }]}
    />
  );
}

function DestinationCard({
  dest,
  ctx,
  viability,
  riseIndex,
  onChange,
  onPrimary,
  onRemove,
}: {
  dest: NightlifeDestination;
  ctx: EveningContext;
  viability: NightlifeViability;
  riseIndex: number;
  onChange: (changes: Partial<NightlifeDestination>) => void;
  onPrimary: () => void;
  onRemove: () => void;
}) {
  return (
    <section className={`card rise rise-${Math.min(6, riseIndex + 1)}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3 pb-3 border-b border-line">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-navy">{dest.name || "Naamloos"}</h3>
            <Badge tone="neutral">{nl(dest.type)}</Badge>
            {dest.isPrimary && <Badge tone="navy">Primair</Badge>}
          </div>
          <div className="erp-label mt-1">
            BZT-venster {formatDuration(viability.bztWindowMin)} · groep {ctx.groupSize}
          </div>
          <p className="text-[12.5px] text-muted mt-1 leading-snug max-w-2xl">{viability.verdict}</p>
          <div className="mt-2">
            <EveningBar dest={dest} arrivalClock={ctx.arrivalClock} />
          </div>
        </div>
        <div className="shrink-0 text-center">
          <Gauge
            value={viability.score}
            size={96}
            stroke={9}
            tone={toneForStatus(viability.grade)}
            label="van 100"
          />
          <div className="mt-1">
            <Badge tone={toneForStatus(viability.grade)}>{nl(viability.grade)}</Badge>
          </div>
        </div>
      </header>

      <FactorBars viability={viability} />

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
        <Field label="Opent" hint="UU:MM">
          <TextInput value={dest.opensAt} onChange={(v) => onChange({ opensAt: v })} placeholder="17:00" />
        </Field>
        <Field label="Sluit" hint="UU:MM, na middernacht toegestaan">
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

        <Field label="Verplaatsingen" hint="Heen én terug">
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
          label="Alternatief aanwezig"
        />
      </div>

      <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-line pt-3">
        <button className="btn btn-primary btn-sm" onClick={onPrimary} disabled={dest.isPrimary}>
          Maak primair
        </button>
        <button className="btn btn-danger btn-sm" onClick={onRemove}>
          <Trash2 size={13} /> Verwijderen
        </button>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function EventCard({
  event,
  viability,
  riseIndex,
  onChange,
  onRemove,
}: {
  event: LocalEvent;
  viability: NightlifeViability;
  riseIndex: number;
  onChange: (changes: Partial<LocalEvent>) => void;
  onRemove: () => void;
}) {
  return (
    <section className={`card rise rise-${Math.min(6, riseIndex + 1)}`}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-4 pt-3 pb-3 border-b border-line">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-navy">{event.name || "Naamloos evenement"}</h3>
            {event.kind && <Badge tone="neutral">{event.kind}</Badge>}
            <Badge tone="neutral">Alternatief voor {fallbackLabel(event.isFallbackFor)}</Badge>
          </div>
          <div className="erp-label mt-1">
            {event.opensAt || "?"} – {event.closesAt || "?"} · terug: {nl(event.returnTransport)}
          </div>
          <p className="text-[12.5px] text-muted mt-1 leading-snug max-w-2xl">{viability.verdict}</p>
        </div>
        <div className="shrink-0 text-center">
          <Gauge
            value={viability.score}
            size={82}
            stroke={8}
            tone={toneForStatus(viability.grade)}
            label="van 100"
          />
          <div className="mt-1">
            <Badge tone={toneForStatus(viability.grade)}>{nl(viability.grade)}</Badge>
          </div>
        </div>
      </header>

      <FactorBars viability={viability} />

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
        <Field label="Opent" hint="UU:MM">
          <TextInput value={event.opensAt} onChange={(v) => onChange({ opensAt: v })} />
        </Field>
        <Field label="Sluit" hint="UU:MM">
          <TextInput value={event.closesAt} onChange={(v) => onChange({ closesAt: v })} />
        </Field>
        <Field label="Terugreis">
          <Select
            value={event.returnTransport}
            onChange={(v) => onChange({ returnTransport: v })}
            options={RETURN_OPTIONS}
          />
        </Field>
        <Field label="Alternatief voor">
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
          <Trash2 size={13} /> Evenement verwijderen
        </button>
      </div>
    </section>
  );
}
