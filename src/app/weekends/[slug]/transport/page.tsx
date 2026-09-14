"use client";

import { Plus, Trash2 } from "lucide-react";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import type {
  CargoSize,
  DecisionTopic,
  LuggageLoad,
  Participant,
  Vehicle,
} from "@/lib/types";
import {
  assessTransport,
  effectivePassengerCapacity,
  luggageCheck,
  type VehicleAssessment,
} from "@/lib/engine";
import { nl } from "@/lib/labels";
import {
  Badge,
  Callout,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Kpi,
  NumberInput,
  Select,
  StatusBadge,
  TextInput,
} from "@/components/ui";
import { CountUp, SeatGrid, StackedBar } from "@/components/viz";

const CARGO_SIZES: CargoSize[] = ["small", "medium", "large"];
const LUGGAGE_LOADS: LuggageLoad[] = ["low", "medium", "high"];

const CARGO_OPTIONS: { value: CargoSize; label: string }[] = CARGO_SIZES.map((v) => ({
  value: v,
  label: nl(v),
}));

const LOAD_OPTIONS: { value: LuggageLoad; label: string }[] = LUGGAGE_LOADS.map((v) => ({
  value: v,
  label: nl(v),
}));

/** Bagage-aftrek zoals de engine hem toepast: laadruimte × bagage → verloren stoelen. */
const PENALTY_MATRIX: Record<CargoSize, Record<LuggageLoad, number>> = {
  small: { low: 0, medium: 1, high: 2 },
  medium: { low: 0, medium: 0, high: 1 },
  large: { low: 0, medium: 0, high: 0 },
};

const PENALTY_CELL = [
  "bg-go-bg text-go border-go/30",
  "bg-warn-bg text-warn border-warn/30",
  "bg-nogo-bg text-nogo border-nogo/30",
];

function blankVehicle(): Vehicle {
  return {
    id: newId("v"),
    driverId: null,
    name: "Nieuwe auto",
    nominalSeats: 4,
    availableSeats: 4,
    cargoSize: "medium",
    luggageLoad: "medium",
    passengerIds: [],
    confirmed: false,
  };
}

export default function TransportPage() {
  const { weekend, patch, now } = useCurrentWeekend();
  if (!weekend) return null;

  const transport = assessTransport(weekend);
  const luggage = luggageCheck(weekend);
  const byId = new Map(weekend.participants.map((p) => [p.id, p]));
  const driverIds = new Set(
    weekend.vehicles.map((v) => v.driverId).filter((x): x is string => !!x),
  );
  const goingParticipants = weekend.participants.filter((p) => p.weekend === "going");
  /** Reizigers die een stoel nodig hebben: gaan mee, geen eigen vervoer, niet zelf chauffeur. */
  const seatSeekers = weekend.participants.filter(
    (p) => p.weekend === "going" && !p.ownTransport && !driverIds.has(p.id),
  );

  const assignedTotal = transport.vehicles.reduce((s, v) => s + v.assigned, 0);
  const freeSeats = Math.max(0, transport.totalEffectiveCapacity - assignedTotal);
  const shortfall = Math.max(0, transport.shortfall);
  const inUse = new Set(weekend.vehicles.map((v) => `${v.cargoSize}|${v.luggageLoad}`));

  const logDecision = (topic: DecisionTopic, summary: string) =>
    patch((w) => ({
      ...w,
      decisions: [...w.decisions, { id: newId("d"), at: now, topic, summary }],
    }));

  const updateVehicle = (id: string, changes: Partial<Vehicle>) =>
    patch((w) => ({
      ...w,
      vehicles: w.vehicles.map((v) => (v.id === id ? { ...v, ...changes } : v)),
    }));

  /** Zet één reiziger in één auto (of nergens) en haal hem overal anders weg. */
  const assign = (participantId: string, vehicleId: string | null) =>
    patch((w) => ({
      ...w,
      vehicles: w.vehicles.map((v) => {
        const without = v.passengerIds.filter((id) => id !== participantId);
        return v.id === vehicleId
          ? { ...v, passengerIds: [...without, participantId] }
          : { ...v, passengerIds: without };
      }),
    }));

  const addVehicle = () => {
    const v = blankVehicle();
    patch((w) => ({ ...w, vehicles: [...w.vehicles, v] }));
    logDecision("transport", `Auto toegevoegd aan de vervoersplanning (${v.name}).`);
  };

  const removeVehicle = (v: Vehicle) => {
    if (!window.confirm(`Auto “${v.name}” verwijderen? Passagiers worden losgekoppeld.`)) return;
    patch((w) => ({ ...w, vehicles: w.vehicles.filter((x) => x.id !== v.id) }));
    logDecision("transport", `Auto ${v.name} verwijderd uit de vervoersplanning.`);
  };

  const driverOptions: { value: string; label: string }[] = [
    { value: "", label: "—" },
    ...goingParticipants.map((p) => ({ value: p.id, label: p.name })),
  ];

  return (
    <div className="space-y-5">
      {/* BOVENAAN --------------------------------------------------------- */}
      <Card eyebrow="Vervoerscapaciteit 2.0" title="Vervoersbeoordeling" className="rise rise-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={transport.status} />
          <span className="text-[13px] text-muted leading-snug">{transport.detail}</span>
        </div>
        <div className="mt-3">
          <StackedBar
            height={18}
            segments={[
              { label: "Bezet", value: assignedTotal, tone: "go" },
              { label: "Vrij", value: freeSeats, tone: "neutral" },
              { label: "Tekort", value: shortfall, tone: "nogo" },
            ]}
          />
          <div className="erp-mono text-[11.5px] text-muted mt-1.5">
            {transport.totalEffectiveCapacity} effectieve stoelen voor {transport.travelers} reizigers
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi
          label="Reizigers"
          value={<CountUp value={transport.travelers} />}
          sub="Gaan mee, zonder eigen vervoer, geen chauffeur"
          className="rise rise-2"
        />
        <Kpi
          label="Effectieve capaciteit"
          value={<CountUp value={transport.totalEffectiveCapacity} />}
          sub="Stoelen na bagage-aftrek"
          className="rise rise-2"
        />
        <Kpi
          label="Tekort"
          value={<CountUp value={shortfall} />}
          tone={shortfall > 0 ? "nogo" : "go"}
          sub={
            shortfall > 0
              ? "Minder effectieve stoelen dan reizigers"
              : "Capaciteit sluit aan op het aantal reizigers"
          }
          className="rise rise-3"
        />
        <Kpi
          label="Niet ingedeeld"
          value={<CountUp value={transport.unassignedTravelerIds.length} />}
          tone={transport.unassignedTravelerIds.length > 0 ? "warn" : "go"}
          sub="Reizigers zonder auto"
          className="rise rise-3"
        />
        <Kpi
          label="Bagage"
          value={`${luggage.supply}/${luggage.demand}`}
          tone={luggage.ok ? "go" : "warn"}
          sub={luggage.ok ? "Ruimte is toereikend" : "Ruimte schiet tekort"}
          className="rise rise-4"
        />
      </div>

      {shortfall > 0 && (
        <Callout tone="nogo" title="Stoelcapaciteit onvoldoende">
          {transport.totalEffectiveCapacity} effectieve stoelen voor {transport.travelers} reizigers:
          tekort van {shortfall} stoel(en).
        </Callout>
      )}

      {/* AUTO’S ----------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="erp-label">Wagenpark</div>
          <h2 className="text-sm font-bold text-navy">Auto’s en indeling</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={addVehicle}>
          <Plus size={13} /> Nieuwe auto
        </button>
      </div>

      {weekend.vehicles.length === 0 ? (
        <EmptyState title="Geen auto’s ingevoerd">
          Zonder auto’s is er geen effectieve stoelcapaciteit en blijft vervoer op {nl("UNKNOWN")}{" "}
          staan.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {weekend.vehicles.map((v, i) => {
            const a = transport.vehicles.find((x) => x.vehicle.id === v.id);
            if (!a) return null;
            return (
              <VehicleCard
                key={v.id}
                assessment={a}
                driverOptions={driverOptions}
                seatSeekers={seatSeekers}
                riseIndex={i}
                onChange={(changes) => updateVehicle(v.id, changes)}
                onAssign={assign}
                onRemove={() => removeVehicle(v)}
              />
            );
          })}
        </div>
      )}

      {/* NIET INGEDEELD --------------------------------------------------- */}
      <Card
        eyebrow="Nog in te delen"
        title={`Reizigers zonder auto (${transport.unassignedTravelerIds.length})`}
        padded={false}
        className="rise rise-5"
      >
        {transport.unassignedTravelerIds.length === 0 ? (
          <div className="px-4 py-5 text-sm text-muted">
            Iedere reiziger is aan een auto toegewezen.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="erp">
              <thead>
                <tr>
                  <th>Reiziger</th>
                  <th>Rol</th>
                  <th>Snel indelen</th>
                </tr>
              </thead>
              <tbody>
                {transport.unassignedTravelerIds.map((id) => {
                  const p = byId.get(id);
                  return (
                    <tr key={id}>
                      <td className="font-semibold text-navy whitespace-nowrap">{p?.name ?? id}</td>
                      <td className="text-muted whitespace-nowrap">{p?.role ?? "—"}</td>
                      <td className="w-[220px]">
                        <Select
                          value=""
                          onChange={(vid) => assign(id, vid === "" ? null : vid)}
                          options={[
                            { value: "", label: "— kies auto —" },
                            ...weekend.vehicles.map((v) => ({
                              value: v.id,
                              label: `${v.name} (${effectivePassengerCapacity(v)} plaatsen)`,
                            })),
                          ]}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* BAGAGE ----------------------------------------------------------- */}
      <Card
        eyebrow="Bagage-aftrek"
        title="Laadruimte × bagage → verloren stoelen"
        className="rise rise-6"
      >
        <div className="overflow-x-auto">
          <div className="min-w-[280px]">
            <div className="grid grid-cols-4 gap-1.5">
              <div className="erp-label flex items-end">Laadruimte</div>
              {LUGGAGE_LOADS.map((l) => (
                <div key={l} className="erp-label text-center flex items-end justify-center">
                  {nl(l)}
                </div>
              ))}
              {CARGO_SIZES.map((c) =>
                [
                  <div key={c} className="erp-label text-navy flex items-center">
                    {nl(c)}
                  </div>,
                  ...LUGGAGE_LOADS.map((l) => {
                    const lost = PENALTY_MATRIX[c][l];
                    const used = inUse.has(`${c}|${l}`);
                    return (
                      <div
                        key={`${c}-${l}`}
                        title={`${nl(c)} + ${nl(l)} → ${lost} stoel(en) kwijt`}
                        className={`rounded-[4px] border py-2 text-center erp-mono text-sm font-semibold viz-pop ${PENALTY_CELL[lost]} ${
                          used ? "ring-2 ring-cobalt" : ""
                        }`}
                      >
                        −{lost}
                      </div>
                    );
                  }),
                ],
              )}
            </div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-line text-[12px] text-muted leading-snug">
          {luggage.detail} Omkaderd = combinatie die nu in het wagenpark voorkomt.
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function VehicleCard({
  assessment,
  driverOptions,
  seatSeekers,
  riseIndex,
  onChange,
  onAssign,
  onRemove,
}: {
  assessment: VehicleAssessment;
  driverOptions: { value: string; label: string }[];
  seatSeekers: Participant[];
  riseIndex: number;
  onChange: (changes: Partial<Vehicle>) => void;
  onAssign: (participantId: string, vehicleId: string | null) => void;
  onRemove: () => void;
}) {
  const v = assessment.vehicle;
  const cap = assessment.effectiveCapacity;
  const lost = Math.max(0, v.nominalSeats - cap);
  const assigned = new Set(v.passengerIds);

  return (
    <section className={`card rise rise-${Math.min(6, riseIndex + 1)}`}>
      <header className="px-4 pt-3 pb-3 border-b border-line">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-navy">{v.name || "Naamloze auto"}</h3>
            <div className="erp-mono text-[12px] text-muted mt-0.5">
              Stoelen {v.availableSeats} · Laadruimte {nl(v.cargoSize)} · Bagage {nl(v.luggageLoad)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {v.confirmed ? <Badge tone="go">Bevestigd</Badge> : <Badge tone="warn">Niet bevestigd</Badge>}
            {assessment.driverMissing && <Badge tone="nogo">Geen chauffeur</Badge>}
            {assessment.driverNotGoing && <Badge tone="nogo">Chauffeur gaat niet mee</Badge>}
            {assessment.overloaded && <Badge tone="nogo">Overbeladen</Badge>}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <SeatGrid seats={v.nominalSeats} filled={assessment.assigned} lost={lost} />
          <div className="erp-mono text-[12px] whitespace-nowrap">
            <span className={assessment.overloaded ? "text-nogo font-semibold" : "font-semibold"}>
              {assessment.assigned} / {cap}
            </span>
            <span className="text-faint"> effectieve plaatsen</span>
            {lost > 0 && <span className="text-warn"> · {lost} kwijt aan bagage</span>}
          </div>
        </div>
      </header>

      <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Field label="Naam" className="col-span-2 sm:col-span-3">
          <TextInput value={v.name} onChange={(val) => onChange({ name: val })} />
        </Field>
        <Field label="Chauffeur" className="col-span-2">
          <Select
            value={v.driverId ?? ""}
            onChange={(val) => onChange({ driverId: val === "" ? null : val })}
            options={driverOptions}
          />
        </Field>
        <Field label="Nominale stoelen" hint="Excl. chauffeur">
          <NumberInput value={v.nominalSeats} onChange={(val) => onChange({ nominalSeats: val })} />
        </Field>
        <Field label="Beschikbare stoelen">
          <NumberInput
            value={v.availableSeats}
            onChange={(val) => onChange({ availableSeats: val })}
          />
        </Field>
        <Field label="Laadruimte">
          <Select
            value={v.cargoSize}
            onChange={(val) => onChange({ cargoSize: val })}
            options={CARGO_OPTIONS}
          />
        </Field>
        <Field label="Bagage">
          <Select
            value={v.luggageLoad}
            onChange={(val) => onChange({ luggageLoad: val })}
            options={LOAD_OPTIONS}
          />
        </Field>
      </div>

      <div className="px-4 pb-3">
        <Checkbox
          checked={v.confirmed}
          onChange={(val) => onChange({ confirmed: val })}
          label="Auto bevestigd"
        />
      </div>

      <div className="px-4 py-3 border-t border-line">
        <div className="erp-label mb-2">Passagiers</div>
        {seatSeekers.length === 0 ? (
          <div className="text-[12px] text-muted">Geen reizigers die een stoel nodig hebben.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {seatSeekers.map((p) => (
              <Checkbox
                key={p.id}
                checked={assigned.has(p.id)}
                onChange={(checked) => onAssign(p.id, checked ? v.id : null)}
                label={p.name}
              />
            ))}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-line">
        <button className="btn btn-danger btn-sm" onClick={onRemove}>
          <Trash2 size={13} /> Auto verwijderen
        </button>
      </div>
    </section>
  );
}
