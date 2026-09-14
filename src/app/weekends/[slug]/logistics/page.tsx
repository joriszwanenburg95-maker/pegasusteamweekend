"use client";

import { assessFood, evaluateReadiness, formatDuration, headcount, parseClock } from "@/lib/engine";
import type { Accommodation, AccommodationType, DecisionTopic, FoodPlan, SundayActivity } from "@/lib/types";
import { nl } from "@/lib/labels";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import {
  Callout,
  Card,
  Checkbox,
  Field,
  NumberInput,
  Select,
  StatusBadge,
  TextInput,
  toneForStatus,
  type Tone,
} from "@/components/ui";
import { CountUp, ScoreScale, StackedBar, TimeWindowBar, type TimeSpan } from "@/components/viz";

const ACCOMMODATION_TYPES: AccommodationType[] = [
  "hotel",
  "hostel",
  "holidayHome",
  "camping",
  "friendsFamily",
  "unknown",
];

const ACCOMMODATION_OPTIONS = ACCOMMODATION_TYPES.map((t) => ({ value: t, label: nl(t) }));

function AccessLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 border-b border-line py-1 last:border-0">
      <span className="erp-label w-[130px] shrink-0">{label}</span>
      <span className="erp-mono text-[12px] text-fg">{value || "—"}</span>
    </div>
  );
}

export default function LogisticsPage() {
  const { weekend, patch, now } = useCurrentWeekend();
  if (!weekend) return null;

  const readiness = evaluateReadiness(weekend, now);
  const hc = headcount(weekend);
  const food = assessFood(weekend);
  const acc = weekend.accommodation;
  const dinner = weekend.dinner;
  const sunday = weekend.sunday;
  const dinnerMismatch = hc.mismatches.find((m) => m.key === "dinner");
  const check = (key: string) => readiness.checks.find((c) => c.key === key);
  const sundayCheck = check("sunday");

  const logDecision = (topic: DecisionTopic, summary: string) =>
    patch((w) => ({
      ...w,
      decisions: [...w.decisions, { id: newId("d"), at: now, topic, summary }],
    }));

  const setAcc = (update: Partial<Accommodation>) =>
    patch((w) => ({ ...w, accommodation: { ...w.accommodation, ...update } }));
  const setDinner = (update: Partial<FoodPlan>) =>
    patch((w) => ({ ...w, dinner: { ...w.dinner, ...update } }));
  const setSunday = (update: Partial<SundayActivity>) =>
    patch((w) => ({ ...w, sunday: { ...w.sunday, ...update } }));

  const confirmDinnerReservation = () => {
    const count = hc.dinner.going;
    setDinner({ reserved: true, reservedCount: count });
    logDecision("dinner", `Reservering bevestigd bij ${dinner.location || "eetlocatie"} voor ${count} personen.`);
  };

  /* ---------- Avondtijdlijn: eten vs. keukensluiting ---------- */
  const dinnerMin = parseClock(dinner.time);
  const kitchenRaw = parseClock(dinner.kitchenClosesAt);
  const kitchenMin =
    dinnerMin !== null && kitchenRaw !== null && kitchenRaw < dinnerMin ? kitchenRaw + 1440 : kitchenRaw;
  const foodTone: Tone = toneForStatus(food.status);
  const spans: TimeSpan[] = [];
  if (dinnerMin !== null) {
    if (dinner.travelMin > 0)
      spans.push({ label: `Reis ${dinner.travelMin}m`, fromMin: dinnerMin - dinner.travelMin, toMin: dinnerMin, tone: "navy" });
    spans.push({
      label: `Eten ${formatDuration(dinner.durationMin)}`,
      fromMin: dinnerMin,
      toMin: dinnerMin + Math.max(15, dinner.durationMin),
      tone: foodTone,
    });
    if (dinner.beerCanStartHere)
      spans.push({
        label: "BZT",
        fromMin: dinnerMin + Math.max(15, dinner.durationMin),
        toMin: 26 * 60,
        tone: "go",
        hatched: true,
      });
  }
  const markers =
    kitchenMin !== null ? [{ atMin: kitchenMin, label: "keuken dicht", tone: "nogo" as Tone }] : [];

  const bedsMax = Math.max(1, acc.bedsProvided, hc.overnight.going);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="erp-label">Module L-01 · Verblijf &amp; eten</div>
          <h2 className="text-base font-bold tracking-tight text-navy">SLAPEN &amp; ETEN</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {["accommodation", "beds", "access", "dinner"].map((k) => {
            const c = check(k);
            return c ? (
              <span key={k} className="flex items-center gap-1">
                <span className="erp-label">{c.label}</span>
                <StatusBadge status={c.status} />
              </span>
            ) : null;
          })}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------------- Accommodatie ---------------- */}
        <Card
          title="ACCOMMODATIE"
          eyebrow="Slaapplaats"
          className="lg:col-span-2 rise rise-1"
          actions={<StatusBadge status={check("accommodation")?.status ?? "UNKNOWN"} />}
        >
          <div className="mb-3 rounded-[6px] border border-line bg-sunken px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="erp-label">Bedden vs. overnachters</span>
              <span className="erp-mono text-[12px]">
                <CountUp value={acc.bedsProvided} /> bedden · <CountUp value={hc.overnight.going} /> overnachters
              </span>
            </div>
            <div className="mt-1.5 space-y-1.5">
              <ScoreScale value={acc.bedsProvided} max={bedsMax} tone="navy" ticks={1} height={7} />
              <ScoreScale
                value={hc.overnight.going}
                max={bedsMax}
                tone={acc.ownShelterRequired ? "unknown" : acc.bedsProvided >= hc.overnight.going ? "go" : "nogo"}
                ticks={1}
                height={7}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Naam">
              <TextInput value={acc.name} onChange={(v) => setAcc({ name: v })} placeholder="Hostel / camping / huis" />
            </Field>
            <Field label="Type">
              <Select value={acc.type} onChange={(v) => setAcc({ type: v })} options={ACCOMMODATION_OPTIONS} />
            </Field>
            <Field label="Adres" className="sm:col-span-2">
              <TextInput value={acc.address} onChange={(v) => setAcc({ address: v })} placeholder="Straat, plaats" />
            </Field>
            <Field label="Bedden geleverd" hint="Telt tegen het aantal overnachters.">
              <NumberInput value={acc.bedsProvided} onChange={(v) => setAcc({ bedsProvided: v })} />
            </Field>
            <Field label="Reistijd vanaf wedstrijdlocatie (min)">
              <NumberInput value={acc.travelFromVenueMin} onChange={(v) => setAcc({ travelFromVenueMin: v })} />
            </Field>
            <Field label="Check-in vanaf (UU:MM)">
              <TextInput value={acc.checkInFrom} onChange={(v) => setAcc({ checkInFrom: v })} placeholder="15:00" />
            </Field>
            <Field label="Check-in tot (UU:MM)">
              <TextInput value={acc.checkInUntil} onChange={(v) => setAcc({ checkInUntil: v })} placeholder="22:00" />
            </Field>
            <Field label="Toegangscode / instructie">
              <TextInput value={acc.accessCode} onChange={(v) => setAcc({ accessCode: v })} placeholder="Sleutelkluis, code…" />
            </Field>
            <Field label="Contact">
              <TextInput value={acc.contact} onChange={(v) => setAcc({ contact: v })} placeholder="Naam + telefoonnummer" />
            </Field>
            <Field label="Notities" className="sm:col-span-2">
              <textarea
                className="input"
                rows={3}
                value={acc.notes ?? ""}
                onChange={(e) => setAcc({ notes: e.target.value })}
                placeholder="Bijzonderheden, huisregels, ontbijt…"
              />
            </Field>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3">
            <Checkbox
              checked={acc.confirmed}
              onChange={(v) => {
                setAcc({ confirmed: v });
                logDecision(
                  "accommodation",
                  v
                    ? `Accommodatie ${acc.name || "(naamloos)"} bevestigd.`
                    : `Bevestiging accommodatie ${acc.name || "(naamloos)"} ingetrokken.`,
                );
              }}
              label="Bevestigd"
            />
            <Checkbox
              checked={acc.ownShelterRequired}
              onChange={(v) => setAcc({ ownShelterRequired: v })}
              label="Eigen slaapplek vereist"
            />
            <span className="text-[11px] text-faint">
              Zelf een tent regelen = geen bed = {nl("FAIL")} op {check("beds")?.label ?? "bedden"}.
            </span>
          </div>

          <div className="mt-3 space-y-1">
            {(["accommodation", "beds", "access"] as const).map((k) => {
              const c = check(k);
              if (!c) return null;
              return (
                <div key={k} className="flex items-start justify-between gap-2 border-b border-line py-1 last:border-0">
                  <div>
                    <div className="text-[12px] font-semibold text-navy">{c.label}</div>
                    <div className="erp-mono text-[11px] leading-snug text-muted">{c.detail}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              );
            })}
          </div>
        </Card>

        {/* ---------------- Toegangsgegevens ---------------- */}
        <Card
          title="TOEGANGSGEGEVENS"
          eyebrow="Uitsnede draaiboek"
          actions={<StatusBadge status={check("access")?.status ?? "UNKNOWN"} />}
          className="rise rise-2"
        >
          <AccessLine label="Accommodatie" value={acc.name ? `${acc.name}${acc.address ? `, ${acc.address}` : ""}` : ""} />
          <AccessLine label="Toegangscode" value={acc.accessCode} />
          <AccessLine label="Contact" value={acc.contact} />
          <AccessLine
            label="Check-in"
            value={acc.checkInFrom || acc.checkInUntil ? `${acc.checkInFrom || "?"}–${acc.checkInUntil || "?"}` : ""}
          />
          <div className="erp-mono mt-2 text-[11px] leading-snug text-faint">
            Alleen-lezen. Dezelfde regels staan in het draaiboek onder {nl("access")}.
          </div>
        </Card>
      </div>

      {/* ---------------- Etencontrole ---------------- */}
      <Card
        title="ETENCONTROLE"
        eyebrow="Zaterdagavond"
        className="rise rise-3"
        actions={
          <>
            <StatusBadge status={food.status} />
            {dinnerMismatch && <StatusBadge status={dinnerMismatch.status} />}
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-4">
          <Checkbox checked={dinner.known} onChange={(v) => setDinner({ known: v })} label="Eten is bekend" />
          <span className="erp-mono text-[11.5px] text-muted">{food.headline}</span>
        </div>

        {!dinner.known && (
          <div className="mt-3">
            <Callout tone="nogo" title="Open punt">
              &ldquo;Wat eten we eigenlijk?&rdquo; staat nog open — zware waarschuwing voor de gereedheid.
            </Callout>
          </div>
        )}

        {dinnerMin !== null && (
          <div className="mt-3 rounded-[6px] border border-line bg-sunken px-3 py-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="erp-label">Avondvenster</span>
              <span className="erp-mono text-[11.5px]">
                Keukenbuffer{" "}
                {food.kitchenBufferMin === null ? (
                  "—"
                ) : (
                  <span className={food.kitchenBufferMin < 45 ? "font-bold text-nogo" : "font-bold text-go"}>
                    {formatDuration(food.kitchenBufferMin)}
                  </span>
                )}
              </span>
            </div>
            <div className="mt-2">
              <TimeWindowBar spans={spans} markers={markers} />
            </div>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Locatie">
            <TextInput value={dinner.location} onChange={(v) => setDinner({ location: v })} placeholder="Eetcafé…" />
          </Field>
          <Field label="Adres">
            <TextInput value={dinner.address} onChange={(v) => setDinner({ address: v })} />
          </Field>
          <Field label="Tijd (UU:MM)">
            <TextInput value={dinner.time} onChange={(v) => setDinner({ time: v })} placeholder="20:15" />
          </Field>
          <Field label="Keuken sluit (UU:MM)">
            <TextInput value={dinner.kitchenClosesAt} onChange={(v) => setDinner({ kitchenClosesAt: v })} placeholder="21:30" />
          </Field>
          <Field label="Gereserveerd voor (pers.)">
            <NumberInput value={dinner.reservedCount} onChange={(v) => setDinner({ reservedCount: v })} />
          </Field>
          <Field label="Reistijd (min)">
            <NumberInput value={dinner.travelMin} onChange={(v) => setDinner({ travelMin: v })} />
          </Field>
          <Field label="Duur (min)">
            <NumberInput value={dinner.durationMin} onChange={(v) => setDinner({ durationMin: v })} />
          </Field>
          <Field label="Terugvaloptie">
            <TextInput value={dinner.fallback} onChange={(v) => setDinner({ fallback: v })} placeholder="Alternatief bij vol/gesloten" />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3">
          <Checkbox
            checked={dinner.reserved}
            onChange={(v) => {
              setDinner({ reserved: v });
              if (!v) logDecision("dinner", `Reservering bij ${dinner.location || "eetlocatie"} ingetrokken.`);
            }}
            label="Gereserveerd"
          />
          <Checkbox checked={dinner.onCriticalPath} onChange={(v) => setDinner({ onCriticalPath: v })} label="Op kritiek pad" />
          <Checkbox checked={dinner.beerCanStartHere} onChange={(v) => setDinner({ beerCanStartHere: v })} label="BZT kan hier starten" />
          <button className="btn btn-sm btn-primary" onClick={confirmDinnerReservation}>
            Bevestig reservering ({hc.dinner.going} pers.)
          </button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-[6px] border border-line bg-sunken px-3 py-2">
            <div className="erp-label">Aandachtspunten</div>
            {food.issues.length ? (
              <ul className="list-disc pl-5 text-[11.5px] leading-snug text-muted">
                {food.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : (
              <div className="erp-mono text-[11.5px] text-go">Geen aandachtspunten.</div>
            )}
          </div>

          {dinnerMismatch && (
            <div className="rounded-[6px] border border-line bg-sunken px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="erp-mono text-[12px] font-bold uppercase tracking-[0.08em] text-navy">
                  {dinnerMismatch.label}
                </span>
                <StatusBadge status={dinnerMismatch.status} />
              </div>
              <div className="mt-2">
                <StackedBar
                  segments={[
                    { label: "Gereserveerd", value: dinnerMismatch.reserved, tone: "navy" },
                    {
                      label: "Bevestigde eters",
                      value: dinnerMismatch.confirmed,
                      tone: dinnerMismatch.status === "OK" ? "go" : dinnerMismatch.status === "UNKNOWN" ? "unknown" : "nogo",
                    },
                  ]}
                  height={12}
                  formatValue={(v) => `${v} pers.`}
                />
              </div>
              <div className="mt-1.5 text-[11.5px] leading-snug text-muted">{dinnerMismatch.detail}</div>
            </div>
          )}
        </div>
      </Card>

      {/* ---------------- Zondag ---------------- */}
      <Card
        title="ZONDAGPROGRAMMA"
        eyebrow="Activiteit"
        actions={<StatusBadge status={sundayCheck?.status ?? "UNKNOWN"} />}
        className="rise rise-4"
      >
        <Checkbox
          checked={sunday.relevant}
          onChange={(v) => setSunday({ relevant: v })}
          label="Zondagactiviteit relevant"
        />
        {sunday.relevant ? (
          <>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Naam">
                <TextInput value={sunday.name} onChange={(v) => setSunday({ name: v })} placeholder="Escaperoom, bowlen…" />
              </Field>
              <Field label="Locatie">
                <TextInput value={sunday.location} onChange={(v) => setSunday({ location: v })} />
              </Field>
              <Field label="Reistijd vanaf accommodatie (min)">
                <NumberInput
                  value={sunday.travelFromAccommodationMin}
                  onChange={(v) => setSunday({ travelFromAccommodationMin: v })}
                />
              </Field>
              <Field label="Starttijd (UU:MM)">
                <TextInput value={sunday.startTime} onChange={(v) => setSunday({ startTime: v })} placeholder="11:30" />
              </Field>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3">
              <Checkbox
                checked={sunday.confirmed}
                onChange={(v) => {
                  setSunday({ confirmed: v });
                  logDecision(
                    "activity",
                    v
                      ? `Zondagactiviteit ${sunday.name || "(naamloos)"} bevestigd.`
                      : `Bevestiging zondagactiviteit ${sunday.name || "(naamloos)"} ingetrokken.`,
                  );
                }}
                label="Bevestigd"
              />
              {sundayCheck && <span className="erp-mono text-[11.5px] text-muted">{sundayCheck.detail}</span>}
            </div>
          </>
        ) : (
          <div className="erp-mono mt-2 text-[11.5px] text-muted">
            Geen zondagprogramma. De check &ldquo;Zondagprogramma&rdquo; wordt niet meegewogen.
          </div>
        )}
      </Card>
    </div>
  );
}
