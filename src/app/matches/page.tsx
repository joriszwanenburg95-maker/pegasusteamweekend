"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, Car, ChevronRight, Link2, Plus, Settings2, Table2, Tent, Trash2, X } from "lucide-react";
import { newId, useStore } from "@/store/store";
import { blankWeekend } from "@/data/seed";
import { SEASON_EVENT_KINDS, type SeasonCalendar, type SeasonEvent, type SeasonEventKind, type TrainingSlot, type Weekend } from "@/lib/types";
import {
  applyEventToWeekend,
  blankEvent,
  driverTally,
  eventWarnings,
  eventsOn,
  formatDateKey,
  formatEuro,
  formatMonth,
  isMatch,
  isoToDateKey,
  knownDriverNames,
  matches,
  monthGrid,
  nextMatch,
  seasonMonths,
  seasonStats,
  trainingsOn,
  travelCost,
  travelMinutes,
  upcomingMatches,
} from "@/lib/engine";
import { Badge, Callout, Card, Checkbox, EmptyState, Field, Kpi, NumberInput, PageHeader, Select, TextInput } from "@/components/ui";
import { CountUp } from "@/components/viz";
import { DriverChip, EventPill, KIND_STYLE, KindBadge, driverColor, eventFullLabel } from "@/components/calendar";
import { nl } from "@/lib/labels";

type View = "calendar" | "schedule" | "settings";

const VIEWS: { key: View; label: string; icon: ReactNode }[] = [
  { key: "calendar", label: "Kalender", icon: <CalendarDays size={14} /> },
  { key: "schedule", label: "Rijschema", icon: <Table2 size={14} /> },
  { key: "settings", label: "Rooster & instellingen", icon: <Settings2 size={14} /> },
];

const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const WEEKDAY_OPTIONS = [
  { value: "1", label: "Maandag" },
  { value: "2", label: "Dinsdag" },
  { value: "3", label: "Woensdag" },
  { value: "4", label: "Donderdag" },
  { value: "5", label: "Vrijdag" },
  { value: "6", label: "Zaterdag" },
  { value: "7", label: "Zondag" },
];

/** Roostervoornamen voor de chauffeursuggesties (rijschema gebruikt voornamen). */
const ROSTER_FIRST_NAMES = ["Dicky", "Dean", "Wouter", "Senna", "Tom", "Koen", "Boaz", "Joris", "Pep", "Rik", "Pim", "Job", "Henk", "Matta"];

export default function MatchesPage() {
  return (
    <Suspense fallback={<EmptyState title="Programma laden…" />}>
      <MatchesInner />
    </Suspense>
  );
}

function MatchesInner() {
  const { state, now, upsertEvent, updateEvent, deleteEvent, updateCalendar, updateWeekend } = useStore();
  const router = useRouter();
  const params = useSearchParams();
  const cal = state.calendar;

  const [view, setView] = useState<View>(() => (params.get("view") as View) || "calendar");
  const [editingId, setEditingId] = useState<string | null>(() => params.get("event"));
  const [dayKey, setDayKey] = useState<string | null>(null);

  // Deeplink vanuit een weekend: ?event=<id> opent de editor.
  useEffect(() => {
    const id = params.get("event");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (id) setEditingId(id);
  }, [params]);

  const editing = editingId ? cal.events.find((e) => e.id === editingId) ?? null : null;
  const stats = useMemo(() => seasonStats(cal), [cal]);
  const next = useMemo(() => nextMatch(cal, now), [cal, now]);
  const today = isoToDateKey(now);

  function createEvent(date: string, kind: SeasonEventKind = "competition") {
    const ev = blankEvent(newId("e"), date, kind);
    if (kind === "competition") {
      ev.startTime = cal.homeMatchTime;
    }
    upsertEvent(ev);
    setDayKey(null);
    setEditingId(ev.id);
  }

  function createWeekendFromEvent(ev: SeasonEvent) {
    const id = newId("w");
    const depart = new Date(`${ev.date}T${ev.departArkTime || ev.startTime || "15:00"}:00`).toISOString();
    const name = `Teamweekend ${ev.opponent || ev.title || formatDateKey(ev.date)}`;
    const weekend = applyEventToWeekend(blankWeekend(id, name, depart), ev, cal.homeVenue);
    // slug = id bij blankWeekend
    updateWeekendUpsert(weekend);
    updateEvent(ev.id, { weekendId: id });
    router.push(`/weekends/${weekend.slug}`);
  }
  const { dispatch } = useStore();
  function updateWeekendUpsert(w: Weekend) {
    dispatch({ type: "upsertWeekend", weekend: w });
  }

  function syncToWeekend(ev: SeasonEvent) {
    if (!ev.weekendId) return;
    updateWeekend(ev.weekendId, (w) => applyEventToWeekend(w, ev, cal.homeVenue));
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={`Programma · Seizoen ${cal.season} · Superdivisie Heren`}
        title="Wedstrijden & seizoenskalender"
        subtitle="Jaarkalender, rijschema en trainingsrooster in één overzicht. Alles is aanpasbaar; wedstrijden koppel je aan een teamweekend."
        actions={
          <>
            <button className="btn btn-primary" onClick={() => createEvent(today)}>
              <Plus size={14} /> Nieuw item
            </button>
            <Link href="/weekends" className="btn">
              Weekenden <ArrowRight size={14} />
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3 rise rise-1">
        <NextMatchKpi next={next} cal={cal} onOpen={() => next && setEditingId(next.id)} />
        <Kpi label="Competitie" value={<CountUp value={stats.competition} />} unit="rondes" sub={`${stats.competitionHome} thuis · ${stats.competitionAway} uit`} />
        <Kpi label="Beker" value={<CountUp value={stats.cup} />} unit="rondes" sub="Indien nog in de beker" />
        <Kpi label="Kilometers uit" value={<CountUp value={stats.totalKm} />} unit="km" sub={`${formatEuro(stats.totalCost)} via WBW (${formatEuro(cal.kmRate)}/km)`} />
        <Kpi label="Trainingen" value={<CountUp value={stats.trainings} />} sub={`${cal.trainingSlots.length} vaste avonden, minus vrije dagen`} />
        <Kpi
          label="Locatie onbekend"
          value={<CountUp value={stats.unknownVenue} />}
          tone={stats.unknownVenue > 0 ? "warn" : "go"}
          sub={stats.unknownVenue > 0 ? "Wedstrijden zonder locatie (beker, P/D)" : "Alles bekend"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 rise rise-2">
        <div className="inline-flex rounded-[6px] border border-line bg-elev p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              onClick={() => setView(v.key)}
              className={`inline-flex items-center gap-1.5 rounded-[4px] px-3 py-1.5 text-[12.5px] font-semibold ${view === v.key ? "bg-navy text-white" : "text-muted hover:bg-sunken"}`}
              aria-pressed={view === v.key}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>
        {view === "calendar" && <Legend />}
      </div>

      {view === "calendar" && (
        <CalendarView cal={cal} today={today} onDay={(k) => setDayKey(k)} onEvent={(id) => setEditingId(id)} />
      )}
      {view === "schedule" && <ScheduleView cal={cal} weekends={state.weekends} today={today} onEvent={(id) => setEditingId(id)} />}
      {view === "settings" && <SettingsView cal={cal} update={updateCalendar} />}

      {dayKey && (
        <Drawer title={formatDateKey(dayKey, { year: "numeric", weekday: "long" })} onClose={() => setDayKey(null)}>
          <DayPanel cal={cal} dateKey={dayKey} onEvent={(id) => { setDayKey(null); setEditingId(id); }} onCreate={(kind) => createEvent(dayKey, kind)} />
        </Drawer>
      )}

      {editing && (
        <Drawer title={eventFullLabel(editing) || "Nieuw item"} onClose={() => setEditingId(null)}>
          <EventEditor
            ev={editing}
            cal={cal}
            weekends={state.weekends}
            onChange={(patch) => updateEvent(editing.id, patch)}
            onDelete={() => {
              if (!window.confirm(`“${eventFullLabel(editing) || "dit item"}” verwijderen uit het programma?`)) return;
              deleteEvent(editing.id);
              setEditingId(null);
            }}
            onCreateWeekend={() => createWeekendFromEvent(editing)}
            onSyncWeekend={() => syncToWeekend(editing)}
          />
        </Drawer>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* KPI: volgende wedstrijd                                              */
/* ------------------------------------------------------------------ */

function NextMatchKpi({ next, cal, onOpen }: { next: SeasonEvent | null; cal: SeasonCalendar; onOpen: () => void }) {
  if (!next) return <Kpi label="Volgende wedstrijd" value="—" sub="Geen wedstrijd meer in het programma" className="col-span-2" />;
  return (
    <button type="button" onClick={onOpen} className="card-navy stripe px-4 py-3 text-left col-span-2 hover:brightness-110">
      <div className="erp-label">Volgende wedstrijd · {formatDateKey(next.date)}</div>
      <div className="text-lg font-extrabold tracking-tight mt-0.5 truncate">
        {next.opponent || next.title}
        <span className="text-white/60 font-semibold text-sm ml-2">{next.isHome ? "thuis" : "uit"}</span>
      </div>
      <div className="erp-mono text-[11.5px] text-white/70 mt-1 flex flex-wrap gap-x-3">
        {next.startTime && <span>Aanvang {next.startTime}</span>}
        {next.departArkTime && <span>Vertrek Ark {next.departArkTime}</span>}
        {!next.isHome && next.roundTripKm > 0 && <span>{next.roundTripKm} km · {formatEuro(travelCost(next, cal.kmRate))}</span>}
        {next.isHome && <span>{cal.homeVenue}</span>}
      </div>
      {next.cars.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {next.cars.map((c) => <DriverChip key={c} name={c} size="sm" />)}
        </div>
      )}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Kalender                                                             */
/* ------------------------------------------------------------------ */

function Legend() {
  const items: { kind: SeasonEventKind; label: string }[] = [
    { kind: "competition", label: "Competitie uit" },
    { kind: "cup", label: "Beker" },
    { kind: "friendly", label: "Oefen / toernooi" },
    { kind: "teamweekend", label: "Teamweekend" },
    { kind: "reserve", label: "Reserve" },
    { kind: "holiday", label: "Vrij" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted ml-auto">
      {items.map((i) => (
        <span key={i.kind} className="inline-flex items-center gap-1">
          <span className={`inline-block w-2.5 h-2.5 rounded-[2px] ${KIND_STYLE[i.kind].dot}`} />
          {i.label}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="inline-block w-2.5 h-2.5 rounded-[2px] border border-navy bg-elev" /> Competitie thuis
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky" /> Training
      </span>
    </div>
  );
}

function CalendarView({ cal, today, onDay, onEvent }: { cal: SeasonCalendar; today: string; onDay: (k: string) => void; onEvent: (id: string) => void }) {
  const months = useMemo(() => seasonMonths(cal), [cal]);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 rise rise-3">
      {months.map((m) => (
        <MonthCard key={m} monthKey={m} cal={cal} today={today} onDay={onDay} onEvent={onEvent} />
      ))}
    </div>
  );
}

function MonthCard({ monthKey, cal, today, onDay, onEvent }: { monthKey: string; cal: SeasonCalendar; today: string; onDay: (k: string) => void; onEvent: (id: string) => void }) {
  const cells = monthGrid(monthKey);
  const ym = monthKey.slice(0, 7);
  const monthMatches = matches(cal).filter((e) => e.date.startsWith(ym));
  const away = monthMatches.filter((e) => !e.isHome).length;
  return (
    <section className="card overflow-hidden">
      <header className="flex items-center justify-between px-3 py-2 border-b border-line bg-sunken">
        <h2 className="text-sm font-bold text-navy capitalize">{formatMonth(monthKey)}</h2>
        <span className="text-[11px] text-muted erp-mono">
          {monthMatches.length} wedstr. · {away} uit
        </span>
      </header>
      <div className="grid grid-cols-7 text-center text-[10px] font-semibold tracking-wider text-faint border-b border-line">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((key, i) => {
          if (!key) return <div key={`x${i}`} className="cal-cell border-b border-r border-line/60 bg-sunken/40" />;
          const events = eventsOn(cal, key);
          const trainings = trainingsOn(cal, key);
          const isToday = key === today;
          const inSeason = key >= cal.startDate && key <= cal.endDate;
          const weekend = i % 7 >= 5;
          return (
            <div
              key={key}
              className={`cal-cell border-b border-r border-line/60 p-0.5 sm:p-1 flex flex-col gap-0.5 ${weekend ? "bg-bg" : ""} ${!inSeason ? "opacity-60" : ""}`}
            >
              <button
                type="button"
                onClick={() => onDay(key)}
                className={`self-start erp-mono text-[10.5px] leading-none px-1 py-0.5 rounded ${isToday ? "bg-nogo text-white font-bold" : "text-muted hover:bg-sunken"}`}
                aria-label={`${formatDateKey(key)} openen`}
              >
                {Number(key.slice(8))}
                {trainings.length > 0 && <span className="inline-block w-1.5 h-1.5 rounded-full bg-sky ml-1 align-middle" title="Training" />}
              </button>
              {events.slice(0, 2).map((ev) => (
                <EventPill key={ev.id} ev={ev} compact onClick={() => onEvent(ev.id)} />
              ))}
              {events.length > 2 && (
                <button type="button" onClick={() => onDay(key)} className="text-[9.5px] text-faint text-left px-1 hover:underline">
                  +{events.length - 2} meer
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DayPanel({ cal, dateKey, onEvent, onCreate }: { cal: SeasonCalendar; dateKey: string; onEvent: (id: string) => void; onCreate: (kind: SeasonEventKind) => void }) {
  const events = eventsOn(cal, dateKey);
  const trainings = trainingsOn(cal, dateKey);
  return (
    <div className="space-y-4">
      {trainings.length > 0 && (
        <div>
          <div className="erp-label mb-1.5">Training</div>
          {trainings.map((t) => (
            <div key={t.id} className="flex items-center gap-2 rounded-[6px] border border-line bg-sunken px-3 py-2 text-[13px]">
              <span className="inline-block w-2 h-2 rounded-full bg-sky" />
              <span className="erp-mono font-semibold text-navy">{t.from}–{t.to}</span>
              <span className="text-muted">{t.location}</span>
              {t.note && <span className="text-faint text-[11px] ml-auto">{t.note}</span>}
            </div>
          ))}
        </div>
      )}
      <div>
        <div className="erp-label mb-1.5">Programma</div>
        {events.length === 0 ? (
          <div className="text-sm text-muted">Niets gepland op deze dag.</div>
        ) : (
          <div className="space-y-1.5">
            {events.map((ev) => (
              <button key={ev.id} type="button" onClick={() => onEvent(ev.id)} className="w-full text-left rounded-[6px] border border-line px-3 py-2 hover:bg-sunken">
                <div className="flex flex-wrap items-center gap-2">
                  <KindBadge kind={ev.kind} isHome={isMatch(ev) ? ev.isHome : undefined} />
                  <span className="text-[13px] font-semibold text-navy">{eventFullLabel(ev)}</span>
                  <ChevronRight size={14} className="ml-auto text-faint" />
                </div>
                {(ev.venue || ev.startTime) && (
                  <div className="text-[11.5px] text-muted mt-0.5 erp-mono">
                    {ev.startTime && `${ev.startTime} · `}
                    {ev.venue}
                    {ev.address && `, ${ev.address}`}
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
      <div>
        <div className="erp-label mb-1.5">Toevoegen op deze dag</div>
        <div className="flex flex-wrap gap-1.5">
          {(["competition", "cup", "friendly", "teamweekend", "holiday", "other"] as SeasonEventKind[]).map((k) => (
            <button key={k} type="button" className="btn btn-sm" onClick={() => onCreate(k)}>
              <Plus size={12} /> {nl(k)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Rijschema                                                            */
/* ------------------------------------------------------------------ */

function ScheduleView({ cal, weekends, today, onEvent }: { cal: SeasonCalendar; weekends: Weekend[]; today: string; onEvent: (id: string) => void }) {
  const rows = useMemo(() => matches(cal), [cal]);
  const tally = useMemo(() => driverTally(cal), [cal]);
  const maxTally = tally[0]?.count ?? 1;
  const warnings = rows.flatMap((ev) => eventWarnings(ev).map((w) => ({ ev, w })));
  const weekendName = (id: string | null) => weekends.find((w) => w.id === id);

  return (
    <div className="space-y-3 rise rise-3">
      <Card eyebrow={`KM × ${formatEuro(cal.kmRate)} · bedragen via WBW`} title="Rijschema uitwedstrijden" padded={false}>
        <div className="overflow-x-auto">
          <table className="erp min-w-[1100px]">
            <thead>
              <tr>
                <th>Datum</th>
                <th>Wedstrijd</th>
                <th>Adres</th>
                <th className="text-right">Aanvang</th>
                <th className="text-right">Aanwezig</th>
                <th className="text-right">Vertrek Ark</th>
                <th className="text-right">Km</th>
                <th className="text-right">Bedrag</th>
                <th className="text-right">Mee</th>
                <th>Auto&apos;s</th>
                <th>Carpool</th>
                <th>Zelf</th>
                <th>Weekend</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => {
                const unknown = !ev.isHome && !ev.venue;
                const past = ev.date < today;
                const warn = eventWarnings(ev);
                const wk = weekendName(ev.weekendId);
                return (
                  <tr key={ev.id} className={`${unknown ? "bg-sunken/60 text-muted" : ""} ${past ? "opacity-60" : ""}`}>
                    <td className="erp-mono whitespace-nowrap">
                      {formatDateKey(ev.date)}
                      {ev.date === today && <Badge tone="nogo" className="ml-1.5">Vandaag</Badge>}
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <KindBadge kind={ev.kind} isHome={ev.isHome} />
                        <span className="font-semibold text-navy">{ev.opponent || ev.title}</span>
                        {ev.opponent && <span className="text-faint text-[11px]">{ev.title}</span>}
                        {warn.length > 0 && (
                          <span title={warn.join("\n")} className="text-warn inline-flex">
                            <AlertTriangle size={14} />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="max-w-[260px]">
                      {ev.isHome ? (
                        <span className="text-muted">{cal.homeAddress}</span>
                      ) : ev.venue ? (
                        <>
                          <div className="font-medium">{ev.venue}</div>
                          <div className="text-[11.5px] text-muted truncate">{ev.address}</div>
                        </>
                      ) : (
                        <span className="italic">Onbekend</span>
                      )}
                    </td>
                    <td className="erp-mono text-right">{ev.startTime || "—"}</td>
                    <td className="erp-mono text-right">{ev.presentTime || "—"}</td>
                    <td className="erp-mono text-right">{ev.departArkTime || "—"}</td>
                    <td className="erp-mono text-right">{ev.roundTripKm > 0 ? ev.roundTripKm : "—"}</td>
                    <td className="erp-mono text-right whitespace-nowrap">{ev.roundTripKm > 0 ? formatEuro(travelCost(ev, cal.kmRate)) : "—"}</td>
                    <td className="erp-mono text-right">{ev.headcount > 0 ? ev.headcount : "—"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {ev.cars.filter((c) => c.trim()).map((c, i) => <DriverChip key={`${c}${i}`} name={c} size="sm" title={`Auto ${i + 1}: ${c}`} />)}
                        {ev.cars.filter((c) => c.trim()).length === 0 && <span className="text-faint">—</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{ev.carpool || <span className="text-faint">—</span>}</td>
                    <td className="whitespace-nowrap">{ev.ownTransport || <span className="text-faint">—</span>}</td>
                    <td className="whitespace-nowrap">
                      {wk ? (
                        <Link href={`/weekends/${wk.slug}`} className="inline-flex items-center gap-1 text-cobalt font-semibold hover:underline text-[12px]">
                          <Tent size={12} /> {wk.name.replace("Teamweekend ", "")}
                        </Link>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      <button type="button" className="btn btn-sm" onClick={() => onEvent(ev.id)}>Bewerk</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card eyebrow="Telling" title="Wie rijdt hoe vaak">
          {tally.length === 0 ? (
            <div className="text-sm text-muted">Nog geen chauffeurs ingedeeld.</div>
          ) : (
            <div className="space-y-1.5">
              {tally.map((t) => {
                const c = driverColor(t.name);
                return (
                  <div key={t.name} className="flex items-center gap-2 text-[12.5px]">
                    <span className="w-16 shrink-0"><DriverChip name={t.name} size="sm" /></span>
                    <div className="flex-1 h-4 rounded-[3px] bg-sunken overflow-hidden">
                      <div className="h-full" style={{ width: `${(t.count / maxTally) * 100}%`, background: c.fg, opacity: 0.75 }} />
                    </div>
                    <span className="erp-mono w-6 text-right font-semibold text-navy">{t.count}</span>
                    <span className="hidden sm:inline text-[11px] text-faint w-40 truncate" title={t.dates.map((d) => formatDateKey(d)).join(", ")}>
                      {t.dates.map((d) => formatDateKey(d, { weekday: undefined })).join(", ")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          <div className="text-[11.5px] text-faint mt-3 pt-2 border-t border-line">
            Eerlijk verdelen: ieder rijdt 2 à 3 keer per seizoen. Carpoolers (Henk + Senna) tellen niet als teamauto.
          </div>
        </Card>

        <Card eyebrow="Plausibiliteit" title="Aandachtspunten rijschema">
          {warnings.length === 0 ? (
            <div className="text-sm text-go font-semibold">Geen opmerkingen.</div>
          ) : (
            <ul className="space-y-1.5">
              {warnings.map(({ ev, w }, i) => (
                <li key={`${ev.id}-${i}`} className="flex gap-2 text-[12.5px]">
                  <AlertTriangle size={14} className="text-warn shrink-0 mt-0.5" />
                  <span>
                    <button type="button" className="font-semibold text-navy hover:underline" onClick={() => onEvent(ev.id)}>
                      {formatDateKey(ev.date, { weekday: undefined })} · {ev.opponent || ev.title}
                    </button>
                    <span className="text-muted"> — {w}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="text-[11.5px] text-faint mt-3 pt-2 border-t border-line">
            Signaal, geen blokkade. Bekerrondes krijgen een locatie zodra de loting bekend is.
          </div>
        </Card>
      </div>

      <UpcomingStrip cal={cal} today={today} onEvent={onEvent} />
    </div>
  );
}

function UpcomingStrip({ cal, today, onEvent }: { cal: SeasonCalendar; today: string; onEvent: (id: string) => void }) {
  const list = upcomingMatches(cal, `${today}T12:00:00`, 6);
  if (list.length === 0) return null;
  return (
    <Card eyebrow="Komend" title="Eerstvolgende wedstrijden">
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {list.map((ev) => (
          <button key={ev.id} type="button" onClick={() => onEvent(ev.id)} className="shrink-0 w-[190px] rounded-[6px] border border-line px-3 py-2 text-left hover:bg-sunken">
            <div className="erp-mono text-[11px] text-faint">{formatDateKey(ev.date)}{ev.startTime && ` · ${ev.startTime}`}</div>
            <div className="font-bold text-navy text-sm truncate mt-0.5">{ev.opponent || ev.title}</div>
            <div className="mt-1"><KindBadge kind={ev.kind} isHome={ev.isHome} /></div>
            {ev.cars.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">{ev.cars.map((c, i) => <DriverChip key={`${c}${i}`} name={c} size="sm" />)}</div>
            )}
          </button>
        ))}
      </div>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Rooster & instellingen                                               */
/* ------------------------------------------------------------------ */

function SettingsView({ cal, update }: { cal: SeasonCalendar; update: (p: (c: SeasonCalendar) => SeasonCalendar) => void }) {
  const set = <K extends keyof SeasonCalendar>(key: K, value: SeasonCalendar[K]) => update((c) => ({ ...c, [key]: value }));
  const setSlot = (id: string, patch: Partial<TrainingSlot>) =>
    update((c) => ({ ...c, trainingSlots: c.trainingSlots.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  const cancelled = cal.events.filter((e) => e.cancelsTraining).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 rise rise-3">
      <Card eyebrow="Seizoen" title="Algemeen">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Seizoen"><TextInput value={cal.season} onChange={(v) => set("season", v)} /></Field>
          <Field label="Km-vergoeding (€/km)"><NumberInput value={cal.kmRate} onChange={(v) => set("kmRate", v)} step={0.01} /></Field>
          <Field label="Rooster vanaf"><input className="input erp-mono" type="date" value={cal.startDate} onChange={(e) => set("startDate", e.target.value)} /></Field>
          <Field label="Rooster tot en met"><input className="input erp-mono" type="date" value={cal.endDate} onChange={(e) => set("endDate", e.target.value)} /></Field>
          <Field label="Thuishal"><TextInput value={cal.homeVenue} onChange={(v) => set("homeVenue", v)} /></Field>
          <Field label="Aanvang thuiswedstrijden"><input className="input erp-mono" type="time" value={cal.homeMatchTime} onChange={(e) => set("homeMatchTime", e.target.value)} /></Field>
          <Field label="Adres thuishal" className="col-span-2"><TextInput value={cal.homeAddress} onChange={(v) => set("homeAddress", v)} /></Field>
        </div>
      </Card>

      <Card
        eyebrow="Rooster"
        title="Trainingen"
        actions={
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => update((c) => ({ ...c, trainingSlots: [...c.trainingSlots, { id: newId("t"), weekday: 1, from: "19:00", to: "21:30", location: c.homeVenue, note: "" }] }))}
          >
            <Plus size={12} /> Avond
          </button>
        }
      >
        {cal.trainingSlots.length === 0 ? (
          <div className="text-sm text-muted">Geen vaste trainingsavonden.</div>
        ) : (
          <div className="space-y-2">
            {cal.trainingSlots.map((s) => (
              <div key={s.id} className="grid grid-cols-[1fr_auto_auto_1fr_auto] gap-2 items-end">
                <Field label="Dag"><Select value={String(s.weekday)} onChange={(v) => setSlot(s.id, { weekday: Number(v) })} options={WEEKDAY_OPTIONS} /></Field>
                <Field label="Van"><input className="input erp-mono w-[92px]" type="time" value={s.from} onChange={(e) => setSlot(s.id, { from: e.target.value })} /></Field>
                <Field label="Tot"><input className="input erp-mono w-[92px]" type="time" value={s.to} onChange={(e) => setSlot(s.id, { to: e.target.value })} /></Field>
                <Field label="Locatie / notitie"><TextInput value={s.location} onChange={(v) => setSlot(s.id, { location: v })} placeholder="Ark van Oost" /></Field>
                <button type="button" className="btn btn-sm btn-danger" onClick={() => update((c) => ({ ...c, trainingSlots: c.trainingSlots.filter((x) => x.id !== s.id) }))} aria-label="Verwijder">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="text-[11.5px] text-faint mt-3 pt-2 border-t border-line">
          Trainingen vervallen automatisch op dagen met een kalenderitem waar “geen training” aan staat (vakanties, feestdagen).
        </div>
      </Card>

      <Card eyebrow="Uitzonderingen" title="Dagen zonder training" className="lg:col-span-2">
        {cancelled.length === 0 ? (
          <div className="text-sm text-muted">Geen uitzonderingen. Zet “training vervalt” aan bij een kalenderitem.</div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {cancelled.map((e) => (
              <span key={e.id} className="inline-flex items-center gap-1.5 rounded-[4px] border border-line bg-sunken px-2 py-1 text-[12px]">
                <span className="erp-mono text-faint">{formatDateKey(e.date, { weekday: undefined })}{e.endDate && ` – ${formatDateKey(e.endDate, { weekday: undefined })}`}</span>
                <span className="font-semibold text-navy">{e.title}</span>
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */

function EventEditor({
  ev,
  cal,
  weekends,
  onChange,
  onDelete,
  onCreateWeekend,
  onSyncWeekend,
}: {
  ev: SeasonEvent;
  cal: SeasonCalendar;
  weekends: Weekend[];
  onChange: (patch: Partial<SeasonEvent>) => void;
  onDelete: () => void;
  onCreateWeekend: () => void;
  onSyncWeekend: () => void;
}) {
  const match = isMatch(ev);
  const names = knownDriverNames(cal, ROSTER_FIRST_NAMES);
  const warnings = eventWarnings(ev);
  const linked = ev.weekendId ? weekends.find((w) => w.id === ev.weekendId) : undefined;
  const travel = travelMinutes(ev);
  const cars = [0, 1, 2, 3].map((i) => ev.cars[i] ?? "");
  const setCar = (i: number, v: string) => {
    const next = [...cars];
    next[i] = v;
    while (next.length > 0 && next[next.length - 1].trim() === "") next.pop();
    onChange({ cars: next });
  };

  return (
    <div className="space-y-4">
      <datalist id="chauffeurs">
        {names.map((n) => <option key={n} value={n} />)}
      </datalist>

      <div className="flex flex-wrap items-center gap-2">
        <KindBadge kind={ev.kind} isHome={match ? ev.isHome : undefined} />
        {ev.weekendId && <Badge tone="navy"><Tent size={11} /> gekoppeld weekend</Badge>}
      </div>

      {warnings.length > 0 && (
        <Callout tone="warn" title="Controleer">
          <ul className="list-disc pl-4 space-y-0.5">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>
        </Callout>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Soort" className="col-span-2">
          <Select value={ev.kind} onChange={(v) => onChange({ kind: v })} options={SEASON_EVENT_KINDS.map((k) => ({ value: k, label: nl(k) }))} />
        </Field>
        <Field label="Titel" className="col-span-2" hint="Bijv. Ronde 3, Beker 1/8 finale, Karnaval">
          <TextInput value={ev.title} onChange={(v) => onChange({ title: v })} />
        </Field>
        <Field label="Datum"><input className="input erp-mono" type="date" value={ev.date} onChange={(e) => onChange({ date: e.target.value })} /></Field>
        <Field label="Tot en met" hint="Alleen bij meerdaags">
          <input className="input erp-mono" type="date" value={ev.endDate} min={ev.date} onChange={(e) => onChange({ endDate: e.target.value })} />
        </Field>
        {match && (
          <>
            <Field label="Tegenstander"><TextInput value={ev.opponent} onChange={(v) => onChange({ opponent: v })} placeholder="Onbekend" /></Field>
            <Field label="Thuis / uit">
              <Select
                value={ev.isHome ? "home" : "away"}
                onChange={(v) =>
                  onChange(
                    v === "home"
                      ? { isHome: true, venue: cal.homeVenue, address: cal.homeAddress, startTime: ev.startTime || cal.homeMatchTime }
                      : { isHome: false },
                  )
                }
                options={[{ value: "away", label: "Uit" }, { value: "home", label: `Thuis (${cal.homeVenue})` }]}
              />
            </Field>
          </>
        )}
        <Field label="Locatie / hal" className="col-span-2"><TextInput value={ev.venue} onChange={(v) => onChange({ venue: v })} placeholder="Onbekend" /></Field>
        <Field label="Adres" className="col-span-2"><TextInput value={ev.address} onChange={(v) => onChange({ address: v })} placeholder="Straat huisnummer Plaats" /></Field>
        <Field label="Aanvang"><input className="input erp-mono" type="time" value={ev.startTime} onChange={(e) => onChange({ startTime: e.target.value })} /></Field>
        {match && !ev.isHome && (
          <>
            <Field label="Aanwezig"><input className="input erp-mono" type="time" value={ev.presentTime} onChange={(e) => onChange({ presentTime: e.target.value })} /></Field>
            <Field label="Vertrek Ark" hint={travel !== null ? `${travel} min reistijd` : undefined}>
              <input className="input erp-mono" type="time" value={ev.departArkTime} onChange={(e) => onChange({ departArkTime: e.target.value })} />
            </Field>
            <Field label="Km heen en terug" hint={ev.roundTripKm > 0 ? `${formatEuro(travelCost(ev, cal.kmRate))} via WBW` : undefined}>
              <NumberInput value={ev.roundTripKm} onChange={(v) => onChange({ roundTripKm: v })} />
            </Field>
            <Field label="Aantal mee"><NumberInput value={ev.headcount} onChange={(v) => onChange({ headcount: v })} /></Field>
          </>
        )}
      </div>

      {match && !ev.isHome && (
        <div>
          <div className="erp-label mb-1.5 flex items-center gap-1.5"><Car size={12} /> Auto&apos;s (chauffeur)</div>
          <div className="grid grid-cols-2 gap-2">
            {cars.map((c, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <span className="erp-mono text-[11px] text-faint w-4">{i + 1}</span>
                <input className="input" list="chauffeurs" value={c} placeholder={`Auto ${i + 1}`} onChange={(e) => setCar(i, e.target.value)} />
                {c.trim() && <DriverChip name={c} size="sm" />}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Carpool" hint="Buiten het teamvervoer"><TextInput value={ev.carpool} onChange={(v) => onChange({ carpool: v })} placeholder="Henk + Senna" /></Field>
            <Field label="Zelf"><TextInput value={ev.ownTransport} onChange={(v) => onChange({ ownTransport: v })} placeholder="Wouter" /></Field>
          </div>
        </div>
      )}

      <Field label="Notities"><textarea className="input min-h-[72px]" value={ev.notes} onChange={(e) => onChange({ notes: e.target.value })} /></Field>

      <Checkbox checked={ev.cancelsTraining} onChange={(v) => onChange({ cancelsTraining: v })} label="Training vervalt op deze dag(en)" />

      <div className="rounded-[6px] border border-line bg-sunken px-3 py-3 space-y-2">
        <div className="erp-label flex items-center gap-1.5"><Link2 size={12} /> Verband met teamweekend</div>
        <Select
          value={ev.weekendId ?? ""}
          onChange={(v) => onChange({ weekendId: v || null })}
          options={[{ value: "", label: "— geen weekend —" }, ...weekends.map((w) => ({ value: w.id, label: `${w.name} (${nl(w.phase)})` }))]}
        />
        <div className="flex flex-wrap gap-2">
          {linked ? (
            <>
              <Link href={`/weekends/${linked.slug}`} className="btn btn-sm btn-primary">Open weekend <ArrowRight size={12} /></Link>
              {match && (
                <button type="button" className="btn btn-sm" onClick={onSyncWeekend} title="Tegenstander, locatie, aanvang en vertrek Ark overnemen in het weekend">
                  Wedstrijdgegevens naar weekend
                </button>
              )}
            </>
          ) : (
            match && (
              <button type="button" className="btn btn-sm btn-primary" onClick={onCreateWeekend}>
                <Tent size={12} /> Maak teamweekend van deze wedstrijd
              </button>
            )
          )}
        </div>
        <div className="text-[11px] text-faint">
          Een gekoppeld weekend neemt de wedstrijd als startpunt van het kritieke pad (einde wedstrijd → eerste bier).
        </div>
      </div>

      <div className="flex justify-between pt-2 border-t border-line">
        <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}><Trash2 size={13} /> Verwijderen</button>
        <span className="text-[11px] text-faint self-center">Wijzigingen worden direct opgeslagen.</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Lade                                                                 */
/* ------------------------------------------------------------------ */

function Drawer({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="drawer absolute inset-y-0 right-0 w-[min(32rem,100vw)] bg-elev shadow-2xl flex flex-col">
        <header className="flex items-center gap-2 px-4 py-3 border-b border-line bg-navy text-white">
          <h2 className="text-sm font-bold truncate">{title}</h2>
          <button type="button" className="ml-auto p-1.5 rounded hover:bg-white/10" onClick={onClose} aria-label="Sluiten"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-24 lg:pb-6">{children}</div>
      </aside>
    </div>
  );
}
