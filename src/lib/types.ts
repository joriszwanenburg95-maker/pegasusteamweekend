/**
 * Domain model — Pegasus HS1 Teamweekend Control Room.
 * All times are ISO strings (UTC) unless noted; durations in minutes.
 */

export type WeekendPhase =
  | "DRAFT"
  | "PLANNING"
  | "READY"
  | "LOCKED"
  | "LIVE"
  | "COMPLETED";

export const WEEKEND_PHASES: WeekendPhase[] = [
  "DRAFT",
  "PLANNING",
  "READY",
  "LOCKED",
  "LIVE",
  "COMPLETED",
];

export type Attendance = "going" | "notGoing" | "unknown";

export interface Participant {
  id: string;
  name: string;
  /** Rugnummer / rol, vrije tekst (bijv. "PL", "Trainer"). */
  role?: string;
  match: Attendance;
  weekend: Attendance;
  overnight: Attendance;
  sunday: Attendance;
  dinner: Attendance;
  ownTransport: boolean;
  isDriver: boolean;
}

export type AccommodationType =
  | "hotel"
  | "hostel"
  | "holidayHome"
  | "camping"
  | "friendsFamily"
  | "unknown";

export interface Accommodation {
  name: string;
  type: AccommodationType;
  address: string;
  confirmed: boolean;
  /** Aantal daadwerkelijke bedden dat de accommodatie levert. */
  bedsProvided: number;
  /** Deelnemers moeten zelf hun slaapplek (tent/matje) meenemen. */
  ownShelterRequired: boolean;
  checkInFrom: string; // "15:00"
  checkInUntil: string; // "22:00"
  accessCode: string;
  contact: string;
  /** Reistijd van wedstrijdlocatie naar accommodatie. */
  travelFromVenueMin: number;
  notes?: string;
}

export interface FoodPlan {
  /** false = "wat eten we eigenlijk?" staat nog open. */
  known: boolean;
  location: string;
  address: string;
  reserved: boolean;
  reservedCount: number;
  time: string; // "19:00"
  travelMin: number;
  durationMin: number;
  onCriticalPath: boolean;
  beerCanStartHere: boolean;
  kitchenClosesAt: string; // "21:30"
  fallback: string;
}

export type NightlifeType =
  | "pub"
  | "bar"
  | "club"
  | "restaurantBar"
  | "event"
  | "other";

export interface NightlifeDestination {
  id: string;
  name: string;
  type: NightlifeType;
  address: string;
  distanceKm: number;
  walkMin: number;
  opensAt: string; // "17:00"
  closesAt: string; // "02:00" (na middernacht toegestaan)
  kitchenClosesAt: string; // "" = geen keuken
  suitableLargeGroup: boolean;
  reservationNeeded: boolean;
  reservationConfirmed: boolean;
  groupCapacity: number;
  entrancePolicy: string;
  transportRequired: boolean;
  taxiRequired: boolean;
  taxiArranged: boolean;
  /** Aantal overstappen/verplaatsingen om er te komen én terug te komen. */
  transfers: number;
  fallbackAvailable: boolean;
  isPrimary: boolean;
  notes?: string;
}

export interface LocalEvent {
  id: string;
  name: string;
  kind: string; // kermis, festival, bierfestival …
  address: string;
  distanceKm: number;
  walkMin: number;
  opensAt: string;
  closesAt: string;
  drinksAvailable: boolean;
  foodAvailable: boolean;
  suitableLargeGroup: boolean;
  returnTransport: "walk" | "car" | "taxi" | "unknown";
  isFallbackFor: "nightlife" | "dinner" | "both";
  notes?: string;
}

export type CargoSize = "small" | "medium" | "large";
export type LuggageLoad = "low" | "medium" | "high";

export interface Vehicle {
  id: string;
  driverId: string | null;
  name: string;
  /** Passagiersstoelen exclusief chauffeur. */
  nominalSeats: number;
  /** Daadwerkelijk beschikbare passagiersstoelen (kinderzitje, kapotte gordel …). */
  availableSeats: number;
  cargoSize: CargoSize;
  luggageLoad: LuggageLoad;
  passengerIds: string[];
  confirmed: boolean;
}

export type ChecklistSection =
  | "beforeDeparture"
  | "access"
  | "teamEquipment"
  | "personal";

export type ChecklistStatus = "open" | "inProgress" | "done" | "blocked" | "na";

export interface ChecklistItem {
  id: string;
  section: ChecklistSection;
  label: string;
  ownerId: string | null;
  status: ChecklistStatus;
  deadline: string | null; // ISO
  /** Locatiespecifiek: alleen tonen indien relevant. */
  conditional?: boolean;
}

export type PathCategory = "valueAdding" | "bzt" | "logistics" | "waste";

export interface PathStep {
  id: string;
  label: string;
  durationMin: number;
  category: PathCategory;
  /** Kan overgeslagen/verplaatst worden; toont optimalisatiehint. */
  optional: boolean;
  optimizationHint?: string;
  /** Extra verplaatsing (transfer) — telt mee voor Group Split Risk. */
  isTransfer?: boolean;
}

export type DecisionTopic =
  | "attendance"
  | "accommodation"
  | "dinner"
  | "nightlife"
  | "transport"
  | "activity"
  | "other";

export interface DecisionLogEntry {
  id: string;
  at: string; // ISO
  topic: DecisionTopic;
  summary: string;
  /** Wijziging binnen 24u voor vertrek = last-minute. Berekend, niet opgeslagen. */
  override?: boolean;
}

export interface OutcomeInput {
  gezelligheid: number; // 1-10
  realizedBzt: number;
  location: number;
  evening: number;
  accommodation: number;
  activity: number;
  overall: number;
}

export interface OperationalInput {
  lastMinuteDecisions: number;
  unresolvedAtDeparture: number;
  unnecessaryTravelMin: number;
  waitingMin: number;
  groupSplits: number;
  reservationIssues: number;
  transportIssues: number;
  bztLossMin: number;
  overrides: number;
}

export interface Retrospective {
  filled: boolean;
  outcome: OutcomeInput;
  operational: OperationalInput;
  lessonsLearned: string[];
}

export interface SundayActivity {
  relevant: boolean;
  name: string;
  location: string;
  travelFromAccommodationMin: number;
  startTime: string;
  confirmed: boolean;
}

export interface MatchContext {
  /** false = puur teamweekend zonder wedstrijd; critical path start dan bij aankomst. */
  hasMatch: boolean;
  opponent: string;
  venue: string;
  city: string;
  matchStart: string; // ISO
  /** Geschat einde wedstrijd (incl. netjes uitspelen). */
  matchEnd: string; // ISO
  isAway: boolean;
}

export interface Weekend {
  id: string;
  slug: string;
  name: string;
  season: string; // "2026/2027"
  city: string;
  phase: WeekendPhase;
  /** Moment van vertrek uit Nijmegen (of einde wedstrijd bij direct doorreizen). */
  departureAt: string;
  returnAt: string;
  match: MatchContext;
  participants: Participant[];
  accommodation: Accommodation;
  dinner: FoodPlan;
  nightlife: NightlifeDestination[];
  localEvents: LocalEvent[];
  vehicles: Vehicle[];
  checklist: ChecklistItem[];
  criticalPath: PathStep[];
  decisions: DecisionLogEntry[];
  sunday: SundayActivity;
  headcountLockedAt: string | null;
  planFinalAt: string | null;
  retrospective: Retrospective;
  /** Historische case: niet aanpasbaar in fasering. */
  historical?: boolean;
  summary?: string;
}

/* ------------------------------------------------------------------ */
/* Seizoenskalender & rijschema                                         */
/* ------------------------------------------------------------------ */

export type SeasonEventKind =
  | "competition"
  | "cup"
  | "friendly"
  | "tournament"
  | "playoff"
  | "reserve"
  | "teamweekend"
  | "meeting"
  | "holiday"
  | "other";

export const SEASON_EVENT_KINDS: SeasonEventKind[] = [
  "competition",
  "cup",
  "friendly",
  "tournament",
  "playoff",
  "reserve",
  "teamweekend",
  "meeting",
  "holiday",
  "other",
];

/** Wedstrijdsoorten: alles wat in het rijschema hoort. */
export const MATCH_KINDS: SeasonEventKind[] = ["competition", "cup", "friendly", "tournament", "playoff"];

/**
 * Eén regel uit de jaarkalender / het rijschema. Datums zijn lokale
 * kalenderdatums ("YYYY-MM-DD"), tijden "HH:MM"; leeg = onbekend.
 */
export interface SeasonEvent {
  id: string;
  date: string;
  /** Laatste dag bij meerdaagse items (teamweekend, vakantie). Leeg = ééndaags. */
  endDate: string;
  kind: SeasonEventKind;
  /** "Ronde 1", "Beker ronde 2", "Karnaval" … */
  title: string;
  opponent: string;
  isHome: boolean;
  venue: string;
  address: string;
  /** Aanvang wedstrijd. */
  startTime: string;
  /** Aanwezig in de hal. */
  presentTime: string;
  /** Vertrek vanaf Ark van Oost. */
  departArkTime: string;
  /** Kilometers heen en terug (rijschema); 0 = onbekend. */
  roundTripKm: number;
  /** Aantal mee volgens rijschema; 0 = onbekend. */
  headcount: number;
  /** Chauffeurs (voornamen), één per auto. */
  cars: string[];
  /** Wie rijden samen buiten het teamvervoer ("Henk + Senna"). */
  carpool: string;
  /** Wie regelt zelf vervoer. */
  ownTransport: string;
  /** Op deze dag(en) vervalt de training. */
  cancelsTraining: boolean;
  /** Gekoppeld teamweekend (Weekend.id) — het verband tussen programma en weekend. */
  weekendId: string | null;
  notes: string;
}

export interface TrainingSlot {
  id: string;
  /** 1 = maandag … 7 = zondag (ISO). */
  weekday: number;
  from: string;
  to: string;
  location: string;
  note: string;
}

export interface SeasonCalendar {
  season: string; // "2026/2027"
  /** Eerste en laatste dag waarop het trainingsrooster geldt. */
  startDate: string;
  endDate: string;
  homeVenue: string;
  homeAddress: string;
  /** Vaste aanvang thuiswedstrijden. */
  homeMatchTime: string;
  /** Kilometervergoeding per km (WBW). */
  kmRate: number;
  trainingSlots: TrainingSlot[];
  events: SeasonEvent[];
}

export interface AppState {
  version: number;
  weekends: Weekend[];
  calendar: SeasonCalendar;
  /** Simulatie-"nu" voor demo/tests; null = echte klok. */
  clockOverride: string | null;
}
