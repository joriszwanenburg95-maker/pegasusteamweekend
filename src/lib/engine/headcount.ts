import type { Participant, Weekend } from "../types";

export interface HeadcountSummary {
  total: number;
  match: AttendanceCount;
  weekend: AttendanceCount;
  overnight: AttendanceCount;
  sunday: AttendanceCount;
  dinner: AttendanceCount;
  /** Reizigers die mee moeten in het teamvervoer (weekend going, geen eigen vervoer). */
  travelers: number;
  drivers: number;
  locked: boolean;
  lockedAt: string | null;
  mismatches: CapacityMismatch[];
}

export interface AttendanceCount {
  going: number;
  notGoing: number;
  unknown: number;
}

export interface CapacityMismatch {
  key: "dinner" | "beds" | "nightlife" | "sunday";
  label: string;
  reserved: number;
  confirmed: number;
  /** "CAPACITY MISMATCH" wanneer reserved < confirmed; "OVERBOOKED" wanneer reserved > confirmed + 2. */
  status: "OK" | "CAPACITY MISMATCH" | "OVERBOOKED" | "UNKNOWN";
  detail: string;
}

export function countAttendance(
  participants: Participant[],
  field: keyof Pick<Participant, "match" | "weekend" | "overnight" | "sunday" | "dinner">,
): AttendanceCount {
  const c: AttendanceCount = { going: 0, notGoing: 0, unknown: 0 };
  for (const p of participants) c[p[field]] += 1;
  return c;
}

export function travelers(participants: Participant[]): Participant[] {
  return participants.filter((p) => p.weekend === "going" && !p.ownTransport);
}

export function headcount(w: Weekend): HeadcountSummary {
  const ps = w.participants;
  const dinner = countAttendance(ps, "dinner");
  const overnight = countAttendance(ps, "overnight");
  const mismatches: CapacityMismatch[] = [];

  // Diner-reservering vs bevestigde eters
  if (w.dinner.known) {
    const confirmed = dinner.going;
    const reserved = w.dinner.reserved ? w.dinner.reservedCount : 0;
    let status: CapacityMismatch["status"] = "OK";
    if (!w.dinner.reserved) status = "UNKNOWN";
    else if (reserved < confirmed) status = "CAPACITY MISMATCH";
    else if (reserved > confirmed + 2) status = "OVERBOOKED";
    mismatches.push({
      key: "dinner",
      label: "Restaurant",
      reserved,
      confirmed,
      status,
      detail: !w.dinner.reserved
        ? "Geen reservering: aantal onbekend voor de locatie."
        : status === "OK"
          ? `Gereserveerd voor ${reserved}, ${confirmed} bevestigde eters.`
          : status === "CAPACITY MISMATCH"
            ? `Gereserveerd: ${reserved}. Bevestigde eters: ${confirmed}. Tekort van ${confirmed - reserved}.`
            : `Gereserveerd: ${reserved}. Bevestigde eters: ${confirmed}. ${reserved - confirmed} stoelen te veel.`,
    });
  }

  // Bedden vs overnachters
  {
    const confirmed = overnight.going;
    const reserved = w.accommodation.bedsProvided;
    let status: CapacityMismatch["status"] = "OK";
    if (w.accommodation.ownShelterRequired) status = "UNKNOWN";
    else if (reserved < confirmed) status = "CAPACITY MISMATCH";
    mismatches.push({
      key: "beds",
      label: "Bedden",
      reserved,
      confirmed,
      status,
      detail: w.accommodation.ownShelterRequired
        ? "Accommodatie levert geen bedden; deelnemers regelen eigen slaapplek."
        : status === "OK"
          ? `${reserved} bedden voor ${confirmed} overnachters.`
          : `${reserved} bedden voor ${confirmed} overnachters. ${confirmed - reserved} slaapt op de grond.`,
    });
  }

  // Primaire nightlife capaciteit vs weekendgangers
  const primary = w.nightlife.find((n) => n.isPrimary);
  if (primary && primary.reservationNeeded) {
    const confirmed = countAttendance(ps, "weekend").going;
    const reserved = primary.reservationConfirmed ? primary.groupCapacity : 0;
    mismatches.push({
      key: "nightlife",
      label: primary.name,
      reserved,
      confirmed,
      status: !primary.reservationConfirmed
        ? "UNKNOWN"
        : reserved < confirmed
          ? "CAPACITY MISMATCH"
          : "OK",
      detail: !primary.reservationConfirmed
        ? "Reservering nodig maar niet bevestigd."
        : `Capaciteit ${reserved} voor ${confirmed} weekendgangers.`,
    });
  }

  return {
    total: ps.length,
    match: countAttendance(ps, "match"),
    weekend: countAttendance(ps, "weekend"),
    overnight,
    sunday: countAttendance(ps, "sunday"),
    dinner,
    travelers: travelers(ps).length,
    drivers: ps.filter((p) => p.isDriver && p.weekend === "going").length,
    locked: w.headcountLockedAt !== null,
    lockedAt: w.headcountLockedAt,
    mismatches,
  };
}
