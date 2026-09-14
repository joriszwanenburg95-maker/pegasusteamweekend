import { MATCH_KINDS, type SeasonCalendar, type SeasonEvent, type SeasonEventKind, type TeamMember, type TrainingSlot, type Weekend } from "../types";
import { parseClock } from "./time";

/**
 * Seizoenskalender & rijschema — pure functies.
 * Datums zijn lokale kalenderdatums ("YYYY-MM-DD"); er wordt bewust niet via
 * Date-UTC gerekend om verschuivingen rond middernacht te vermijden.
 */

const DAY_MS = 86_400_000;

export function parseDateKey(key: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** Lokale datum → "YYYY-MM-DD". */
export function toDateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → Date op lokale middag (DST-veilig voor dagrekenen). */
export function dateKeyToLocalNoon(key: string): Date {
  const p = parseDateKey(key);
  if (!p) return new Date(NaN);
  return new Date(p.y, p.m - 1, p.d, 12, 0, 0, 0);
}

export function addDays(key: string, days: number): string {
  return toDateKey(new Date(dateKeyToLocalNoon(key).getTime() + days * DAY_MS));
}

/** ISO-weekdag: 1 = maandag … 7 = zondag. */
export function isoWeekday(key: string): number {
  const d = dateKeyToLocalNoon(key).getDay();
  return d === 0 ? 7 : d;
}

export function daysBetweenKeys(from: string, to: string): number {
  return Math.round((dateKeyToLocalNoon(to).getTime() - dateKeyToLocalNoon(from).getTime()) / DAY_MS);
}

/** Lokale datum + "HH:MM" → ISO (UTC). Ongeldig → null. */
export function localDateTimeToIso(dateKey: string, clock: string): string | null {
  const p = parseDateKey(dateKey);
  const mins = parseClock(clock);
  if (!p || mins === null) return null;
  return new Date(p.y, p.m - 1, p.d, Math.floor(mins / 60), mins % 60, 0, 0).toISOString();
}

export function isoToDateKey(iso: string): string {
  return toDateKey(new Date(iso));
}

export function isMatchKind(kind: SeasonEventKind): boolean {
  return MATCH_KINDS.includes(kind);
}

export function isMatch(ev: SeasonEvent): boolean {
  return isMatchKind(ev.kind);
}

/** Eerste en laatste dag van een item (ééndaags → beide gelijk). */
export function eventSpan(ev: SeasonEvent): { from: string; to: string } {
  const to = ev.endDate && ev.endDate >= ev.date ? ev.endDate : ev.date;
  return { from: ev.date, to };
}

export function eventCoversDate(ev: SeasonEvent, dateKey: string): boolean {
  const { from, to } = eventSpan(ev);
  return dateKey >= from && dateKey <= to;
}

export function sortEvents(events: SeasonEvent[]): SeasonEvent[] {
  return [...events].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    const ta = parseClock(a.startTime) ?? 24 * 60;
    const tb = parseClock(b.startTime) ?? 24 * 60;
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title);
  });
}

export function eventsOn(cal: SeasonCalendar, dateKey: string): SeasonEvent[] {
  return sortEvents(cal.events.filter((e) => eventCoversDate(e, dateKey)));
}

export function matches(cal: SeasonCalendar): SeasonEvent[] {
  return sortEvents(cal.events.filter(isMatch));
}

/** Eerstvolgende wedstrijden vanaf "nu" (vandaag telt mee). */
export function upcomingMatches(cal: SeasonCalendar, nowIso: string, limit = 5): SeasonEvent[] {
  const today = isoToDateKey(nowIso);
  return matches(cal).filter((e) => eventSpan(e).to >= today).slice(0, limit);
}

export function nextMatch(cal: SeasonCalendar, nowIso: string): SeasonEvent | null {
  return upcomingMatches(cal, nowIso, 1)[0] ?? null;
}

/** Trainingen vervallen op dagen die door een item met cancelsTraining worden afgedekt. */
export function trainingCancelledOn(cal: SeasonCalendar, dateKey: string): SeasonEvent | null {
  return cal.events.find((e) => e.cancelsTraining && eventCoversDate(e, dateKey)) ?? null;
}

export interface TrainingOccurrence {
  date: string;
  slot: TrainingSlot;
}

/** Alle trainingen uit het rooster binnen het seizoen, minus vervallen dagen. */
export function trainingOccurrences(cal: SeasonCalendar): TrainingOccurrence[] {
  const out: TrainingOccurrence[] = [];
  if (!parseDateKey(cal.startDate) || !parseDateKey(cal.endDate) || cal.endDate < cal.startDate) return out;
  const byWeekday = new Map<number, TrainingSlot[]>();
  for (const s of cal.trainingSlots) {
    const list = byWeekday.get(s.weekday) ?? [];
    list.push(s);
    byWeekday.set(s.weekday, list);
  }
  if (byWeekday.size === 0) return out;
  const total = daysBetweenKeys(cal.startDate, cal.endDate);
  for (let i = 0; i <= total; i++) {
    const key = addDays(cal.startDate, i);
    const slots = byWeekday.get(isoWeekday(key));
    if (!slots || trainingCancelledOn(cal, key)) continue;
    for (const slot of slots) out.push({ date: key, slot });
  }
  return out;
}

export function trainingsOn(cal: SeasonCalendar, dateKey: string): TrainingSlot[] {
  if (dateKey < cal.startDate || dateKey > cal.endDate) return [];
  if (trainingCancelledOn(cal, dateKey)) return [];
  const wd = isoWeekday(dateKey);
  return cal.trainingSlots.filter((s) => s.weekday === wd);
}

/** Maanden (eerste dag) van seizoensstart tot en met seizoenseinde, plus maanden met items daarbuiten. */
export function seasonMonths(cal: SeasonCalendar): string[] {
  const keys = new Set<string>();
  const push = (k: string) => {
    const p = parseDateKey(k);
    if (p) keys.add(`${p.y}-${String(p.m).padStart(2, "0")}-01`);
  };
  push(cal.startDate);
  push(cal.endDate);
  for (const e of cal.events) {
    push(e.date);
    if (e.endDate) push(e.endDate);
  }
  const sorted = [...keys].sort();
  if (sorted.length === 0) return [];
  const out: string[] = [];
  let cur = parseDateKey(sorted[0])!;
  const last = parseDateKey(sorted[sorted.length - 1])!;
  while (cur.y < last.y || (cur.y === last.y && cur.m <= last.m)) {
    out.push(`${cur.y}-${String(cur.m).padStart(2, "0")}-01`);
    cur = cur.m === 12 ? { y: cur.y + 1, m: 1, d: 1 } : { y: cur.y, m: cur.m + 1, d: 1 };
  }
  return out;
}

/** Dagen van een maand, aangevuld met lege cellen zodat de grid op maandag start. */
export function monthGrid(monthKey: string): (string | null)[] {
  const p = parseDateKey(monthKey);
  if (!p) return [];
  const first = `${p.y}-${String(p.m).padStart(2, "0")}-01`;
  const lead = isoWeekday(first) - 1;
  const daysInMonth = new Date(p.y, p.m, 0).getDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(`${p.y}-${String(p.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

/* ---------- Rijschema ---------- */

export function travelCost(ev: SeasonEvent, kmRate: number): number {
  return Math.round(ev.roundTripKm * kmRate * 100) / 100;
}

/** Reistijd Ark → aanwezig in minuten; null als een tijd ontbreekt. */
export function travelMinutes(ev: SeasonEvent): number | null {
  const a = parseClock(ev.departArkTime);
  const b = parseClock(ev.presentTime);
  if (a === null || b === null) return null;
  return b - a;
}

export interface DriverTally {
  name: string;
  count: number;
  dates: string[];
}

/** Hoe vaak iedere chauffeur rijdt (rijschema-telling). */
export function driverTally(cal: SeasonCalendar): DriverTally[] {
  const map = new Map<string, DriverTally>();
  for (const e of matches(cal)) {
    for (const raw of e.cars) {
      const name = raw.trim();
      if (!name) continue;
      const t = map.get(name) ?? { name, count: 0, dates: [] };
      t.count += 1;
      t.dates.push(e.date);
      map.set(name, t);
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** Alle namen die ooit in het rijschema voorkomen (voor suggesties in de editor). */
export function knownDriverNames(cal: SeasonCalendar, extra: string[] = []): string[] {
  const set = new Set<string>(extra.map((n) => n.trim()).filter(Boolean));
  for (const e of cal.events) for (const c of e.cars) if (c.trim()) set.add(c.trim());
  return [...set].sort((a, b) => a.localeCompare(b));
}

export interface SeasonStats {
  competition: number;
  competitionHome: number;
  competitionAway: number;
  cup: number;
  friendlies: number;
  away: number;
  home: number;
  totalKm: number;
  totalCost: number;
  trainings: number;
  unknownVenue: number;
}

export function seasonStats(cal: SeasonCalendar): SeasonStats {
  const ms = matches(cal);
  const away = ms.filter((m) => !m.isHome);
  const comp = ms.filter((m) => m.kind === "competition");
  return {
    competition: comp.length,
    competitionHome: comp.filter((m) => m.isHome).length,
    competitionAway: comp.filter((m) => !m.isHome).length,
    cup: ms.filter((m) => m.kind === "cup").length,
    friendlies: ms.filter((m) => m.kind === "friendly" || m.kind === "tournament").length,
    away: away.length,
    home: ms.filter((m) => m.isHome).length,
    totalKm: away.reduce((s, m) => s + (m.roundTripKm || 0), 0),
    totalCost: Math.round(away.reduce((s, m) => s + travelCost(m, cal.kmRate), 0) * 100) / 100,
    trainings: trainingOccurrences(cal).length,
    unknownVenue: ms.filter((m) => !m.isHome && !m.venue).length,
  };
}

/** Plausibiliteitscontroles op één rijschemaregel (geen blokkade, wel signaal). */
export function eventWarnings(ev: SeasonEvent): string[] {
  const out: string[] = [];
  if (!isMatch(ev)) return out;
  const travel = travelMinutes(ev);
  if (travel !== null && travel <= 0) out.push("Vertrektijd Ark ligt niet vóór de aanwezigheidstijd.");
  else if (travel !== null && ev.roundTripKm > 0) {
    // Vuistregel: 85 km/u gemiddeld op de enkele reis (snelweg, incl. Nijmegen uit).
    const needed = Math.round((ev.roundTripKm / 2 / 85) * 60);
    if (travel < needed - 10) out.push(`Reistijd ${travel} min lijkt te kort voor ${Math.round(ev.roundTripKm / 2)} km enkele reis (±${needed} min).`);
  }
  const a = parseClock(ev.presentTime);
  const s = parseClock(ev.startTime);
  if (a !== null && s !== null && a >= s) out.push("Aanwezigheidstijd ligt niet vóór de aanvang.");
  if (!ev.isHome && !ev.venue) out.push("Locatie nog onbekend.");
  if (!ev.isHome && ev.venue && ev.cars.filter((c) => c.trim()).length === 0) out.push("Nog geen chauffeurs ingedeeld.");
  if (!ev.isHome && ev.venue && ev.headcount > 0) {
    const seats = ev.cars.filter((c) => c.trim()).length * 5 + (ev.carpool.trim() ? ev.carpool.split("+").length : 0) + (ev.ownTransport.trim() ? ev.ownTransport.split("+").length : 0);
    if (seats < ev.headcount) out.push(`Capaciteit (${seats} incl. chauffeurs) lijkt kleiner dan ${ev.headcount} mee.`);
  }
  return out;
}

/* ---------- Verband met teamweekenden ---------- */

export function eventsForWeekend(cal: SeasonCalendar, weekendId: string): SeasonEvent[] {
  return sortEvents(cal.events.filter((e) => e.weekendId === weekendId));
}

/** De wedstrijd die aan een weekend hangt (eerste gekoppelde wedstrijdsoort). */
export function matchForWeekend(cal: SeasonCalendar, weekendId: string): SeasonEvent | null {
  return eventsForWeekend(cal, weekendId).find(isMatch) ?? null;
}

/**
 * Neem wedstrijdgegevens uit het programma over in een weekend: tegenstander,
 * locatie, aanvang/einde en vertrek vanaf de Ark. Overige planning blijft staan.
 */
export function applyEventToWeekend(w: Weekend, ev: SeasonEvent, homeVenue: string, homeCity = "Nijmegen"): Weekend {
  const start = localDateTimeToIso(ev.date, ev.startTime || "16:30") ?? w.match.matchStart;
  const end = new Date(new Date(start).getTime() + 2 * 3_600_000).toISOString();
  const depart = localDateTimeToIso(ev.date, ev.departArkTime || ev.presentTime || ev.startTime || "15:00") ?? w.departureAt;
  const city = ev.isHome ? homeCity : cityFromAddress(ev.address) || w.match.city;
  return {
    ...w,
    city: w.city && w.city !== "Nog te bepalen" ? w.city : city,
    departureAt: depart,
    match: {
      ...w.match,
      hasMatch: true,
      opponent: ev.opponent || ev.title,
      venue: ev.isHome ? homeVenue : ev.venue || "Nog te bepalen",
      city,
      matchStart: start,
      matchEnd: end,
      isAway: !ev.isHome,
    },
  };
}

/** "Kurversweg 2 Meijel" → "Meijel"; "Sporthal Olympus, Mr. Groen van Prinstererlaan 100 Assen" → "Assen". */
export function cityFromAddress(address: string): string {
  const last = address.split(",").pop()?.trim() ?? "";
  const words = last.split(/\s+/).filter(Boolean);
  // Laatste woord(en) zonder cijfers na het laatste huisnummer.
  let i = words.length - 1;
  const city: string[] = [];
  while (i >= 0 && !/\d/.test(words[i])) {
    city.unshift(words[i]);
    i--;
  }
  return city.join(" ");
}

export function blankEvent(id: string, date: string, kind: SeasonEventKind = "competition"): SeasonEvent {
  return {
    id,
    date,
    endDate: "",
    kind,
    title: "",
    opponent: "",
    isHome: false,
    venue: "",
    address: "",
    startTime: "",
    presentTime: "",
    departArkTime: "",
    roundTripKm: 0,
    headcount: 0,
    cars: [],
    carpool: "",
    ownTransport: "",
    cancelsTraining: false,
    weekendId: null,
    shirtBagMemberId: "",
    notes: "",
  };
}

export function formatDateKey(key: string, opts?: Intl.DateTimeFormatOptions): string {
  const d = dateKeyToLocalNoon(key);
  if (Number.isNaN(d.getTime())) return key;
  return new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short", ...opts }).format(d);
}

export function formatMonth(monthKey: string): string {
  const d = dateKeyToLocalNoon(monthKey);
  return new Intl.DateTimeFormat("nl-NL", { month: "long", year: "numeric" }).format(d);
}

export function formatEuro(n: number): string {
  return new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(n);
}

/* ---------- Selectie & shirttas ---------- */


export function players(team: TeamMember[]): TeamMember[] {
  return team.filter((m) => m.role === "player" && m.active);
}

/** Volgorde van het shirttas-rooster: op rugnummer oplopend, spelers zonder nummer achteraan op naam. */
export function rotationOrder(team: TeamMember[]): TeamMember[] {
  return [...players(team)].sort((a, b) => {
    if (a.number !== null && b.number !== null) return a.number - b.number;
    if (a.number !== null) return -1;
    if (b.number !== null) return 1;
    return a.name.localeCompare(b.name);
  });
}

export interface ShirtBagAssignment {
  event: SeasonEvent;
  member: TeamMember | null;
  /** true = handmatig afwijkend van het rooster. */
  override: boolean;
}

/**
 * Wie neemt per wedstrijd de shirttas mee? Vanaf de eerste wedstrijd op/na `shirtBag.fromDate`
 * begint `shirtBag.memberId`; daarna gaat het op rugnummer door. Een handmatige afwijking
 * op één wedstrijd verschuift het rooster niet.
 */
export function shirtBagSchedule(cal: SeasonCalendar, team: TeamMember[]): ShirtBagAssignment[] {
  const order = rotationOrder(team);
  const list = matches(cal).filter((e) => e.date >= cal.shirtBag.fromDate);
  if (order.length === 0) return list.map((event) => ({ event, member: null, override: false }));
  let idx = Math.max(0, order.findIndex((m) => m.id === cal.shirtBag.memberId));
  return list.map((event) => {
    const scheduled = order[idx % order.length];
    idx += 1;
    const manual = event.shirtBagMemberId ? team.find((m) => m.id === event.shirtBagMemberId) ?? null : null;
    return { event, member: manual ?? scheduled, override: manual !== null };
  });
}

export function shirtBagFor(cal: SeasonCalendar, team: TeamMember[], eventId: string): ShirtBagAssignment | null {
  return shirtBagSchedule(cal, team).find((a) => a.event.id === eventId) ?? null;
}

/** Wie is er nu aan de beurt (eerste wedstrijd op/na vandaag)? */
export function nextShirtBag(cal: SeasonCalendar, team: TeamMember[], nowIso: string): ShirtBagAssignment | null {
  const today = isoToDateKey(nowIso);
  return shirtBagSchedule(cal, team).find((a) => eventSpan(a.event).to >= today) ?? null;
}

export function memberLabel(m: TeamMember | null): string {
  if (!m) return "—";
  const nick = (m.nickname ?? "").trim();
  const name = nick ? `${nick} (${m.name})` : m.name;
  return m.number !== null ? `#${m.number} ${name}` : name;
}
