"use client";

import { assessFood, evaluateReadiness, formatDuration, headcount } from "@/lib/engine";
import type { Accommodation, AccommodationType, DecisionTopic, FoodPlan, SundayActivity } from "@/lib/types";
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
} from "@/components/ui";

const ACCOMMODATION_OPTIONS: { value: AccommodationType; label: string }[] = [
  { value: "hotel", label: "Hotel" },
  { value: "hostel", label: "Hostel" },
  { value: "holidayHome", label: "Vakantiehuis" },
  { value: "camping", label: "Camping" },
  { value: "friendsFamily", label: "Vrienden / familie" },
  { value: "unknown", label: "Onbekend" },
];

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
    logDecision("dinner", `Reservering bevestigd bij ${dinner.location || "dinerlocatie"} voor ${count} personen.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="erp-label">Module L-01 · Verblijf &amp; eten</div>
          <h2 className="text-base font-bold tracking-tight text-navy">STAY &amp; FOOD CONTROL</h2>
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
        {/* ---------------- Accommodation ---------------- */}
        <Card
          title="ACCOMMODATION"
          eyebrow="Slaapplaats"
          className="lg:col-span-2"
          actions={<StatusBadge status={check("accommodation")?.status ?? "UNKNOWN"} />}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Naam">
              <TextInput value={acc.name} onChange={(v) => setAcc({ name: v })} placeholder="Hostel / camping / huis" />
            </Field>
            <Field label="Type">
              <Select
                value={acc.type}
                onChange={(v) => setAcc({ type: v })}
                options={ACCOMMODATION_OPTIONS}
              />
            </Field>
            <Field label="Adres" className="sm:col-span-2">
              <TextInput value={acc.address} onChange={(v) => setAcc({ address: v })} placeholder="Straat, plaats" />
            </Field>
            <Field label="Bedden geleverd" hint="bedsProvided — telt tegen het aantal overnachters.">
              <NumberInput value={acc.bedsProvided} onChange={(v) => setAcc({ bedsProvided: v })} />
            </Field>
            <Field label="Reistijd vanaf wedstrijdlocatie (min)">
              <NumberInput value={acc.travelFromVenueMin} onChange={(v) => setAcc({ travelFromVenueMin: v })} />
            </Field>
            <Field label="Check-in vanaf (HH:MM)">
              <TextInput value={acc.checkInFrom} onChange={(v) => setAcc({ checkInFrom: v })} placeholder="15:00" />
            </Field>
            <Field label="Check-in tot (HH:MM)">
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
              Tent zelf regelen = geen bed = FAIL op Beds.
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

        {/* ---------------- Access summary ---------------- */}
        <Card title="ACCESS DETAILS" eyebrow="Runbook-uitsnede" actions={<StatusBadge status={check("access")?.status ?? "UNKNOWN"} />}>
          <AccessLine label="Accommodation" value={acc.name ? `${acc.name}${acc.address ? `, ${acc.address}` : ""}` : ""} />
          <AccessLine label="Gate/access code" value={acc.accessCode} />
          <AccessLine label="Contact" value={acc.contact} />
          <AccessLine
            label="Check-in"
            value={acc.checkInFrom || acc.checkInUntil ? `${acc.checkInFrom || "?"}–${acc.checkInUntil || "?"}` : ""}
          />
          <div className="erp-mono mt-2 text-[11px] leading-snug text-faint">
            Read-only weergave. Dezelfde regels verschijnen in de runbook onder ACCESS.
          </div>
        </Card>
      </div>

      {/* ---------------- Food control ---------------- */}
      <Card
        title="FOOD CONTROL"
        eyebrow="Zaterdagavond"
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
              &ldquo;Wat eten we eigenlijk?&rdquo; staat nog open — ernstige readiness warning.
            </Callout>
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Locatie">
            <TextInput value={dinner.location} onChange={(v) => setDinner({ location: v })} placeholder="Eetcafé…" />
          </Field>
          <Field label="Adres">
            <TextInput value={dinner.address} onChange={(v) => setDinner({ address: v })} />
          </Field>
          <Field label="Tijd (HH:MM)">
            <TextInput value={dinner.time} onChange={(v) => setDinner({ time: v })} placeholder="20:15" />
          </Field>
          <Field label="Keuken sluit (HH:MM)">
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
          <Field label="Fallback">
            <TextInput value={dinner.fallback} onChange={(v) => setDinner({ fallback: v })} placeholder="Alternatief bij vol/gesloten" />
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 border-t border-line pt-3">
          <Checkbox
            checked={dinner.reserved}
            onChange={(v) => {
              setDinner({ reserved: v });
              if (!v) logDecision("dinner", `Reservering bij ${dinner.location || "dinerlocatie"} ingetrokken.`);
            }}
            label="Gereserveerd"
          />
          <Checkbox checked={dinner.onCriticalPath} onChange={(v) => setDinner({ onCriticalPath: v })} label="Op critical path" />
          <Checkbox checked={dinner.beerCanStartHere} onChange={(v) => setDinner({ beerCanStartHere: v })} label="BZT kan hier starten" />
          <button className="btn btn-sm btn-primary" onClick={confirmDinnerReservation}>
            Bevestig reservering ({hc.dinner.going} pers.)
          </button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-[6px] border border-line bg-sunken px-3 py-2">
            <div className="erp-label">Keukenbuffer</div>
            <div className="erp-mono text-[12px]">
              {food.kitchenBufferMin === null
                ? "—"
                : `${food.kitchenBufferMin} min (${formatDuration(food.kitchenBufferMin)}) tussen ${dinner.time || "?"} en keukensluiting ${dinner.kitchenClosesAt || "?"}`}
            </div>
            <div className="erp-label mt-2">Issues</div>
            {food.issues.length ? (
              <ul className="list-disc pl-5 text-[11.5px] leading-snug text-muted">
                {food.issues.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : (
              <div className="erp-mono text-[11.5px] text-go">Geen issues.</div>
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
              <div className="erp-mono mt-1 text-[11.5px] leading-relaxed text-muted">
                <div>Reserved: {dinnerMismatch.reserved}</div>
                <div>Confirmed dinner participants: {dinnerMismatch.confirmed}</div>
                <div className="text-fg">STATUS: {dinnerMismatch.status}</div>
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-muted">{dinnerMismatch.detail}</div>
            </div>
          )}
        </div>
      </Card>

      {/* ---------------- Sunday ---------------- */}
      <Card
        title="SUNDAY ACTIVITY"
        eyebrow="Zondagprogramma"
        actions={<StatusBadge status={sundayCheck?.status ?? "UNKNOWN"} />}
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
                <TextInput value={sunday.name} onChange={(v) => setSunday({ name: v })} placeholder="Escape room, bowlen…" />
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
              <Field label="Starttijd (HH:MM)">
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
            Geen zondagprogramma. De readiness check &ldquo;Sunday programme&rdquo; wordt niet geëvalueerd.
          </div>
        )}
      </Card>
    </div>
  );
}
