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
import {
  Badge,
  Callout,
  Card,
  Checkbox,
  EmptyState,
  Field,
  Kpi,
  NumberInput,
  Progress,
  Select,
  StatusBadge,
  TextInput,
} from "@/components/ui";

const CARGO_OPTIONS: { value: CargoSize; label: string }[] = [
  { value: "small", label: "SMALL" },
  { value: "medium", label: "MEDIUM" },
  { value: "large", label: "LARGE" },
];

const LOAD_OPTIONS: { value: LuggageLoad; label: string }[] = [
  { value: "low", label: "LOW" },
  { value: "medium", label: "MEDIUM" },
  { value: "high", label: "HIGH" },
];

/** LUGGAGE_PENALTY zoals de engine hem toepast: cargo × load → verloren stoelen. */
const PENALTY_MATRIX: Record<CargoSize, Record<LuggageLoad, number>> = {
  small: { low: 0, medium: 1, high: 2 },
  medium: { low: 0, medium: 0, high: 1 },
  large: { low: 0, medium: 0, high: 0 },
};

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
      {/* TOP ------------------------------------------------------------- */}
      <Card eyebrow="Transport capacity 2.0" title="Vervoersbeoordeling">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={transport.status} />
          <span className="text-[13px] text-muted leading-snug">{transport.detail}</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Reizigers" value={transport.travelers} sub="Weekend going, geen eigen vervoer, geen chauffeur" />
        <Kpi
          label="Σ effective capacity"
          value={transport.totalEffectiveCapacity}
          sub="Stoelen na bagage-aftrek"
        />
        <Kpi
          label="Shortfall"
          value={transport.shortfall > 0 ? transport.shortfall : 0}
          tone={transport.shortfall > 0 ? "nogo" : "go"}
          sub={
            transport.shortfall > 0
              ? "SUM effectivePassengerCapacity < aantal reizigers"
              : "Capaciteit sluit aan op het aantal reizigers"
          }
        />
        <Kpi
          label="Niet ingedeeld"
          value={transport.unassignedTravelerIds.length}
          tone={transport.unassignedTravelerIds.length > 0 ? "warn" : "go"}
          sub="Reizigers zonder auto"
        />
        <Kpi
          label="Bagagecapaciteit"
          value={`${luggage.supply}/${luggage.demand}`}
          tone={luggage.ok ? "go" : "warn"}
          sub={luggage.ok ? "Supply ≥ demand" : "Supply < demand"}
        />
      </div>

      {transport.shortfall > 0 && (
        <Callout tone="nogo" title="Seat capacity FAIL">
          SUM effectivePassengerCapacity ({transport.totalEffectiveCapacity}) &lt; aantal reizigers (
          {transport.travelers}). Tekort van {transport.shortfall} effectieve stoel(en).
        </Callout>
      )}

      {/* VEHICLES -------------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="erp-label">Fleet</div>
          <h2 className="text-sm font-bold text-navy">Auto’s en indeling</h2>
        </div>
        <button className="btn btn-primary btn-sm" onClick={addVehicle}>
          <Plus size={13} /> Nieuwe auto
        </button>
      </div>

      {weekend.vehicles.length === 0 ? (
        <EmptyState title="Geen auto’s ingevoerd">
          Zonder auto’s is er geen effectieve stoelcapaciteit en blijft Transport op UNKNOWN staan.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
          {weekend.vehicles.map((v) => {
            const a = transport.vehicles.find((x) => x.vehicle.id === v.id);
            if (!a) return null;
            return (
              <VehicleCard
                key={v.id}
                assessment={a}
                driverOptions={driverOptions}
                seatSeekers={seatSeekers}
                onChange={(changes) => updateVehicle(v.id, changes)}
                onAssign={assign}
                onRemove={() => removeVehicle(v)}
              />
            );
          })}
        </div>
      )}

      {/* UNASSIGNED ------------------------------------------------------ */}
      <Card
        eyebrow="Unassigned"
        title={`Reizigers zonder auto (${transport.unassignedTravelerIds.length})`}
        padded={false}
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
                  <th>Quick assign</th>
                </tr>
              </thead>
              <tbody>
                {transport.unassignedTravelerIds.map((id) => {
                  const p = byId.get(id);
                  return (
                    <tr key={id}>
                      <td className="font-semibold text-navy whitespace-nowrap">
                        {p?.name ?? id}
                      </td>
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

      {/* LUGGAGE --------------------------------------------------------- */}
      <Callout tone="warn" title="Luggage">
        Kampeeruitrusting is in normale weekendplanning niet nodig (accommodatiecontrols), maar
        logistiek moet ook andere grote bagage aankunnen.
      </Callout>

      <Card
        eyebrow="LUGGAGE_PENALTY"
        title="Cargo × load → verloren passagiersstoelen"
        padded={false}
      >
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th>Cargo \ Load</th>
                {LOAD_OPTIONS.map((l) => (
                  <th key={l.value} className="text-right">
                    {l.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CARGO_OPTIONS.map((c) => (
                <tr key={c.value}>
                  <td className="font-semibold text-navy">{c.label}</td>
                  {LOAD_OPTIONS.map((l) => {
                    const lost = PENALTY_MATRIX[c.value][l.value];
                    return (
                      <td
                        key={l.value}
                        className={`text-right erp-mono font-semibold ${
                          lost === 0 ? "text-go" : lost === 1 ? "text-warn" : "text-nogo"
                        }`}
                      >
                        −{lost}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-[12px] text-muted leading-snug border-t border-line">
          {luggage.detail} Effective capacity = min(nominalSeats, availableSeats) − penalty.
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
  onChange,
  onAssign,
  onRemove,
}: {
  assessment: VehicleAssessment;
  driverOptions: { value: string; label: string }[];
  seatSeekers: Participant[];
  onChange: (changes: Partial<Vehicle>) => void;
  onAssign: (participantId: string, vehicleId: string | null) => void;
  onRemove: () => void;
}) {
  const v = assessment.vehicle;
  const cap = assessment.effectiveCapacity;
  const pct = cap > 0 ? (assessment.assigned / cap) * 100 : assessment.assigned > 0 ? 100 : 0;
  const assigned = new Set(v.passengerIds);

  return (
    <section className="card">
      <header className="px-4 pt-3 pb-3 border-b border-line">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-navy">{v.name || "Naamloze auto"}</h3>
            <div className="erp-mono text-[12px] text-muted mt-0.5">
              Seats: {v.availableSeats} · Camping load: {v.luggageLoad.toUpperCase()} · Cargo:{" "}
              {v.cargoSize.toUpperCase()}
            </div>
            <div className="erp-mono text-[12px] font-semibold text-navy mt-0.5">
              Effective capacity: {cap}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 shrink-0">
            {v.confirmed ? <Badge tone="go">Bevestigd</Badge> : <Badge tone="warn">Niet bevestigd</Badge>}
            {assessment.driverMissing && <Badge tone="nogo">Driver missing</Badge>}
            {assessment.driverNotGoing && <Badge tone="nogo">Driver not going</Badge>}
            {assessment.overloaded && <Badge tone="nogo">Overloaded</Badge>}
          </div>
        </div>

        <div className="mt-2.5">
          <div className="flex items-center justify-between text-[11.5px] erp-mono mb-1">
            <span className="erp-label">Bezetting</span>
            <span className={assessment.overloaded ? "text-nogo font-semibold" : ""}>
              {assessment.assigned} / {cap}
            </span>
          </div>
          <Progress
            value={pct}
            tone={assessment.overloaded ? "nogo" : pct === 100 ? "go" : "warn"}
          />
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
        <Field label="Cargo size">
          <Select
            value={v.cargoSize}
            onChange={(val) => onChange({ cargoSize: val })}
            options={CARGO_OPTIONS}
          />
        </Field>
        <Field label="Luggage load">
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
          <Trash2 size={13} /> Verwijder auto
        </button>
      </div>
    </section>
  );
}
