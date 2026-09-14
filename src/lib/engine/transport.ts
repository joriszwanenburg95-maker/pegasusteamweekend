import type { CargoSize, LuggageLoad, Vehicle, Weekend } from "../types";
import { travelers } from "./headcount";

/**
 * Effective passenger capacity: passagiersstoelen (excl. chauffeur) minus
 * plekken die door bagage worden ingenomen. Een kleine auto met veel
 * kampeerspullen verliest twee stoelen (Job's Up: 4 → 2), een grote station
 * verliest niets (Senna's Volvo: 5 → 5).
 */
const LUGGAGE_PENALTY: Record<CargoSize, Record<LuggageLoad, number>> = {
  small: { low: 0, medium: 1, high: 2 },
  medium: { low: 0, medium: 0, high: 1 },
  large: { low: 0, medium: 0, high: 0 },
};

export function effectivePassengerCapacity(v: Vehicle): number {
  const penalty = LUGGAGE_PENALTY[v.cargoSize][v.luggageLoad];
  return Math.max(0, Math.min(v.availableSeats, v.nominalSeats) - penalty);
}

export interface VehicleAssessment {
  vehicle: Vehicle;
  effectiveCapacity: number;
  assigned: number;
  overloaded: boolean;
  driverMissing: boolean;
  driverNotGoing: boolean;
}

export interface TransportAssessment {
  travelers: number;
  totalEffectiveCapacity: number;
  shortfall: number; // >0 = te weinig stoelen
  vehicles: VehicleAssessment[];
  unassignedTravelerIds: string[];
  doubleAssignedIds: string[];
  driversConfirmed: boolean;
  allVehiclesConfirmed: boolean;
  status: "PASS" | "WARNING" | "FAIL" | "UNKNOWN";
  detail: string;
}

export function assessTransport(w: Weekend): TransportAssessment {
  const trav = travelers(w.participants);
  const travIds = new Set(trav.map((t) => t.id));
  const byId = new Map(w.participants.map((p) => [p.id, p]));

  const vehicles: VehicleAssessment[] = w.vehicles.map((v) => {
    const cap = effectivePassengerCapacity(v);
    const driver = v.driverId ? byId.get(v.driverId) : undefined;
    // Passagiers exclusief de chauffeur zelf
    const assigned = v.passengerIds.filter((id) => id !== v.driverId).length;
    return {
      vehicle: v,
      effectiveCapacity: cap,
      assigned,
      overloaded: assigned > cap,
      driverMissing: !driver,
      driverNotGoing: !!driver && driver.weekend !== "going",
    };
  });

  const totalEffectiveCapacity = vehicles.reduce(
    (s, v) => s + (v.driverMissing || v.driverNotGoing ? 0 : v.effectiveCapacity),
    0,
  );
  // Chauffeurs reizen in hun eigen auto: die tellen niet als "te vervoeren".
  const driverIds = new Set(
    w.vehicles.map((v) => v.driverId).filter((x): x is string => !!x),
  );
  const toSeat = trav.filter((t) => !driverIds.has(t.id));
  const shortfall = toSeat.length - totalEffectiveCapacity;

  const seen = new Map<string, number>();
  for (const v of w.vehicles)
    for (const id of v.passengerIds) seen.set(id, (seen.get(id) ?? 0) + 1);
  const assignedIds = new Set(seen.keys());
  const unassignedTravelerIds = toSeat
    .filter((t) => !assignedIds.has(t.id))
    .map((t) => t.id);
  const doubleAssignedIds = [...seen.entries()]
    .filter(([, n]) => n > 1)
    .map(([id]) => id);
  const strayAssigned = [...assignedIds].filter(
    (id) => !travIds.has(id) && !driverIds.has(id),
  );

  const driversConfirmed =
    w.vehicles.length > 0 &&
    vehicles.every((v) => !v.driverMissing && !v.driverNotGoing);
  const allVehiclesConfirmed =
    w.vehicles.length > 0 && w.vehicles.every((v) => v.confirmed);

  let status: TransportAssessment["status"] = "PASS";
  let detail = `${toSeat.length} passagiers, ${totalEffectiveCapacity} effectieve stoelen.`;
  if (toSeat.length === 0 && w.vehicles.length === 0) {
    status = "UNKNOWN";
    detail = "Nog geen reizigers of auto's ingevoerd.";
  } else if (shortfall > 0) {
    status = "FAIL";
    detail = `Tekort van ${shortfall} effectieve stoel(en): Σ effectivePassengerCapacity (${totalEffectiveCapacity}) < reizigers (${toSeat.length}).`;
  } else if (!driversConfirmed) {
    status = "FAIL";
    detail = "Niet elke auto heeft een bevestigde chauffeur die mee gaat.";
  } else if (
    unassignedTravelerIds.length > 0 ||
    doubleAssignedIds.length > 0 ||
    strayAssigned.length > 0 ||
    vehicles.some((v) => v.overloaded)
  ) {
    status = "WARNING";
    detail = [
      unassignedTravelerIds.length
        ? `${unassignedTravelerIds.length} reiziger(s) nog niet ingedeeld`
        : null,
      doubleAssignedIds.length
        ? `${doubleAssignedIds.length} dubbel ingedeeld`
        : null,
      strayAssigned.length
        ? `${strayAssigned.length} ingedeeld zonder reisbehoefte`
        : null,
      vehicles.some((v) => v.overloaded) ? "auto overbeladen" : null,
    ]
      .filter(Boolean)
      .join("; ");
  } else if (!allVehiclesConfirmed) {
    status = "WARNING";
    detail = "Verdeling sluit, maar niet elke auto is bevestigd.";
  }

  return {
    travelers: toSeat.length,
    totalEffectiveCapacity,
    shortfall,
    vehicles,
    unassignedTravelerIds,
    doubleAssignedIds,
    driversConfirmed,
    allVehiclesConfirmed,
    status,
    detail,
  };
}

/** Bagagecapaciteit: som van cargo-units vs. wat mee moet. Ruwe indicatie. */
export function luggageCheck(w: Weekend) {
  const cargoUnits: Record<CargoSize, number> = { small: 1, medium: 2, large: 3 };
  const supply = w.vehicles.reduce((s, v) => s + cargoUnits[v.cargoSize], 0);
  const travelersCount = travelers(w.participants).length;
  // Vuistregel: 1 cargo-unit per 3 personen bij normaal weekend, per 1.5 bij kamperen.
  const perUnit = w.accommodation.ownShelterRequired ? 1.5 : 3;
  const demand = Math.ceil(travelersCount / perUnit);
  return {
    supply,
    demand,
    ok: supply >= demand,
    detail:
      supply >= demand
        ? `Bagageruimte ${supply} units voor geschatte behoefte ${demand}.`
        : `Bagageruimte ${supply} units, geschatte behoefte ${demand}. ${w.accommodation.ownShelterRequired ? "Kampeerspullen drukken de capaciteit." : "Grote bagage past mogelijk niet."}`,
  };
}
