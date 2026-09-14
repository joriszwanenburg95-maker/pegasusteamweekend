/**
 * Nederlandse weergavelabels voor interne enum-waarden.
 * De engine werkt met Engelse codes (PASS/FAIL, LOW/HIGH …); de UI toont uitsluitend Nederlands.
 */

const LABELS: Record<string, string> = {
  // CheckStatus / gate
  PASS: "OK",
  WARNING: "LET OP",
  FAIL: "FOUT",
  UNKNOWN: "ONBEKEND",
  OK: "OK",
  GO: "GO",
  "CONDITIONAL GO": "VOORWAARDELIJK GO",
  "NO GO": "NO GO",
  COMPLETED: "AFGEROND",
  // Fases
  DRAFT: "CONCEPT",
  PLANNING: "PLANNING",
  READY: "GEREED",
  LOCKED: "VERGRENDELD",
  LIVE: "LIVE",
  // Group split
  LOW: "LAAG",
  MEDIUM: "GEMIDDELD",
  HIGH: "HOOG",
  CRITICAL: "KRITIEK",
  // Viability grade
  EXCELLENT: "UITSTEKEND",
  GOOD: "GOED",
  MARGINAL: "MARGINAAL",
  POOR: "ZWAK",
  UNVIABLE: "ONHAALBAAR",
  // Bob level
  NEGLIGIBLE: "VERWAARLOOSBAAR",
  MODERATE: "MATIG",
  ELEVATED: "VERHOOGD",
  SEVERE: "ERNSTIG",
  CATASTROPHIC: "CATASTROFAAL",
  // Deadlines
  "T-7D": "T-7 DAGEN",
  "T-72H": "T-72 UUR",
  "T-24H": "T-24 UUR",
  DEPARTURE: "VERTREK",
  "AT RISK": "RISICO",
  MISSED: "GEMIST",
  UPCOMING: "KOMEND",
  // Mismatch
  "CAPACITY MISMATCH": "CAPACITEITSCONFLICT",
  OVERBOOKED: "OVERBOEKT",
  // Checklist
  open: "OPEN",
  inProgress: "BEZIG",
  done: "KLAAR",
  blocked: "GEBLOKKEERD",
  na: "N.V.T.",
  // Attendance
  going: "GAAT MEE",
  notGoing: "GAAT NIET",
  unknown: "ONBEKEND",
  // Path categories
  valueAdding: "WAARDE",
  bzt: "BZT",
  logistics: "LOGISTIEK",
  waste: "VERSPILLING",
  // Cargo / luggage
  small: "KLEIN",
  medium: "MIDDEL",
  large: "GROOT",
  low: "LAAG",
  high: "HOOG",
  // Accommodation types
  hotel: "Hotel",
  hostel: "Hostel",
  holidayHome: "Vakantiehuis",
  camping: "Camping",
  friendsFamily: "Vrienden/familie",
  // Nightlife types
  pub: "Kroeg",
  bar: "Bar",
  club: "Club",
  restaurantBar: "Restaurant/bar",
  event: "Evenement",
  other: "Overig",
  // Decision topics
  attendance: "Deelname",
  accommodation: "Accommodatie",
  dinner: "Eten",
  nightlife: "Avond",
  transport: "Vervoer",
  activity: "Activiteit",
  // Checklist sections
  beforeDeparture: "VOOR VERTREK",
  access: "TOEGANG",
  teamEquipment: "TEAMMATERIAAL",
  personal: "PERSOONLIJK / LOCATIESPECIFIEK",
  both: "Avond + eten",
  // Return transport
  walk: "Lopen",
  car: "Auto",
  taxi: "Taxi",
  // Seizoenskalender
  competition: "Competitie",
  cup: "Beker",
  friendly: "Oefenwedstrijd",
  tournament: "Toernooi",
  playoff: "P/D-wedstrijden",
  reserve: "Reservedatum",
  teamweekend: "Teamweekend",
  meeting: "Teambespreking",
  holiday: "Vrij / vakantie",
};

/** Vertaal een interne code naar een Nederlands label; onbekende codes komen ongewijzigd terug. */
export function nl(code: string | null | undefined): string {
  if (code === null || code === undefined) return "—";
  return LABELS[code] ?? code;
}

export const ATTENDANCE_OPTIONS = [
  { value: "going" as const, label: "Gaat mee" },
  { value: "notGoing" as const, label: "Gaat niet" },
  { value: "unknown" as const, label: "Onbekend" },
];
