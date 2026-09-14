"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, ArrowRight, CalendarDays, Car, ChevronRight, Link2, Plus, Settings2, Shirt, Table2, Tent, Trash2, Users, X } from "lucide-react";
import { newId, useStore } from "@/store/store";
import { blankWeekend } from "@/data/seed";
import { shortName } from "@/data/team";
import { SEASON_EVENT_KINDS, type SeasonCalendar, type SeasonEvent, type SeasonEventKind, type TeamMember, type TeamRole, type TrainingSlot, type Weekend } from "@/lib/types";
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
  memberLabel,
  monthGrid,
  nextMatch,
  nextShirtBag,
  players,
  rotationOrder,
  shirtBagFor,
  shirtBagSchedule,
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

type View = "calendar" | "schedule" | "team" | "settings";

const VIEWS: { key: View; label: string; icon: ReactNode }[] = [
  { key: "calendar", label: "Kalender", icon: <CalendarDays size={14} /> },
  { key: "schedule", label: "Rijschema", icon: <Table2 size={14} /> },
  { key: "team", label: "Selectie & shirttas", icon: <Users size={14} /> },
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


export default function MatchesPage() {
  return (
    <Suspense fallback={<EmptyState title="Programma laden…" />}>
      <MatchesInner />
    </Suspense>
  );
}

function MatchesInner() {
  const { state, now, upsertEvent, updateEvent, deleteEvent, updateCalendar, updateWeekend, updateTeam } = useStore();
  const team = state.team;
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
        <NextMatchKpi next={next} cal={cal} team={team} onOpen={() => next && setEditingId(next.id)} />
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
      {view === "schedule" && <ScheduleView cal={cal} team={team} weekends={state.weekends} today={today} onEvent={(id) => setEditingId(id)} />}
      {view === "team" && <TeamView cal={cal} team={team} now={now} updateTeam={updateTeam} updateCalendar={updateCalendar} onEvent={(id) => setEditingId(id)} />}
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
            team={team}
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

function NextMatchKpi({ next, cal, team, onOpen }: { next: SeasonEvent | null; cal: SeasonCalendar; team: TeamMember[]; onOpen: () => void }) {
  const bag = next ? shirtBagFor(cal, team, next.id) : null;
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
      {(next.cars.length > 0 || bag) && (
        <div className="flex flex-wrap items-center gap-1 mt-2">
          {next.cars.map((c) => <DriverChip key={c} name={c} size="sm" />)}
          {bag && (
            <span className="inline-flex items-center gap-1 text-[11px] text-white/80 ml-1">
              <Shirt size={12} /> shirttas {memberLabel(bag.member)}
            </span>
          )}
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

function ScheduleView({ cal, team, weekends, today, onEvent }: { cal: SeasonCalendar; team: TeamMember[]; weekends: Weekend[]; today: string; onEvent: (id: string) => void }) {
  const rows = useMemo(() => matches(cal), [cal]);
  const bags = useMemo(() => new Map(shirtBagSchedule(cal, team).map((a) => [a.event.id, a])), [cal, team]);
  const tally = useMemo(() => driverTally(cal), [cal]);
  const maxTally = tally[0]?.count ?? 1;
  const warnings = rows.flatMap((ev) => eventWarnings(ev).map((w) => ({ ev, w })));
  const weekendName = (id: string | null) => weekends.find((w) => w.id === id);

  return (
    <div className="space-y-3 rise rise-3">
      <Card eyebrow={`KM × ${formatEuro(cal.kmRate)} · bedragen via WBW`} title="Rijschema uitwedstrijden" padded={false}>
        <div className="overflow-x-auto">
          <table className="erp min-w-[1250px]">
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
                <th>Shirttas</th>
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
                    <td className="min-w-[190px]">
                      <div className="flex flex-wrap gap-1">
                        {ev.cars.filter((c) => c.trim()).map((c, i) => <DriverChip key={`${c}${i}`} name={c} size="sm" title={`Auto ${i + 1}: ${c}`} />)}
                        {ev.cars.filter((c) => c.trim()).length === 0 && <span className="text-faint">—</span>}
                      </div>
                    </td>
                    <td className="whitespace-nowrap">{ev.carpool || <span className="text-faint">—</span>}</td>
                    <td className="whitespace-nowrap">{ev.ownTransport || <span className="text-faint">—</span>}</td>
                    <td className="whitespace-nowrap">
                      {(() => {
                        const a = bags.get(ev.id);
                        if (!a || !a.member) return <span className="text-faint">—</span>;
                        return (
                          <span className="inline-flex items-center gap-1.5" title={a.override ? "Handmatig afwijkend van het rooster" : "Volgens rooster (op rugnummer)"}>
                            <span className="erp-mono text-[11px] text-faint">{a.member.number !== null ? `#${a.member.number}` : "#?"}</span>
                            <span className="font-semibold text-navy">{shortName(a.member)}</span>
                            {a.override && <Badge tone="warn">afw.</Badge>}
                          </span>
                        );
                      })()}
                    </td>
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
/* Selectie & shirttas                                                  */
/* ------------------------------------------------------------------ */

const ROLE_OPTIONS: { value: TeamRole; label: string }[] = [
  { value: "player", label: "Speler" },
  { value: "trainer", label: "Trainer" },
  { value: "assistant", label: "Assistent" },
];
const POSITION_OPTIONS = ["", "SV", "PL", "MID", "DIA", "LIB"].map((p) => ({ value: p, label: p ? `${p} · ${nl(p)}` : "—" }));

function TeamView({
  cal,
  team,
  now,
  updateTeam,
  updateCalendar,
  onEvent,
}: {
  cal: SeasonCalendar;
  team: TeamMember[];
  now: string;
  updateTeam: (p: (t: TeamMember[]) => TeamMember[]) => void;
  updateCalendar: (p: (c: SeasonCalendar) => SeasonCalendar) => void;
  onEvent: (id: string) => void;
}) {
  const setMember = (id: string, patch: Partial<TeamMember>) => updateTeam((t) => t.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const order = rotationOrder(team);
  const schedule = shirtBagSchedule(cal, team);
  const next = nextShirtBag(cal, team, now);
  const today = isoToDateKey(now);
  const activePlayers = players(team);
  const staff = team.filter((m) => m.role !== "player" && m.active);
  const inactive = team.filter((m) => !m.active);
  const sorted = [...team].sort((a, b) => {
    const ra = a.role === "player" ? 0 : 1;
    const rb = b.role === "player" ? 0 : 1;
    if (ra !== rb) return ra - rb;
    if (a.active !== b.active) return a.active ? -1 : 1;
    if (a.number !== null && b.number !== null) return a.number - b.number;
    if (a.number !== null) return -1;
    if (b.number !== null) return 1;
    return a.name.localeCompare(b.name);
  });
  const missingNumbers = activePlayers.filter((m) => m.number === null);

  return (
    <div className="space-y-3 rise rise-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Spelers" value={<CountUp value={activePlayers.length} />} sub={`${staff.length} staf · ${inactive.length} uit de selectie`} />
        <Kpi label="Rugnummer onbekend" value={<CountUp value={missingNumbers.length} />} tone={missingNumbers.length > 0 ? "warn" : "go"} sub={missingNumbers.length > 0 ? missingNumbers.map(shortName).join(", ") : "Alles ingevuld"} />
        <div className="card-navy stripe px-4 py-3 col-span-2">
          <div className="erp-label flex items-center gap-1.5"><Shirt size={12} /> Shirttas · nu aan de beurt</div>
          {next && next.member ? (
            <>
              <div className="text-lg font-extrabold tracking-tight mt-0.5">{memberLabel(next.member)}</div>
              <div className="text-[11.5px] text-white/70 mt-0.5">
                {formatDateKey(next.event.date)} · {eventFullLabel(next.event)}{next.override && " · handmatig"}
              </div>
            </>
          ) : (
            <div className="text-sm text-white/70 mt-1">Geen wedstrijd in het rooster.</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.4fr_1fr] gap-3">
        <Card
          eyebrow={`Pegasus Heren 1 · ${cal.season}`}
          title="Selectie"
          padded={false}
          actions={
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => updateTeam((t) => [...t, { id: newId("p"), name: "", nickname: "", number: null, position: "", role: "player", active: true }])}
            >
              <Plus size={12} /> Teamlid
            </button>
          }
        >
          <div className="overflow-x-auto">
            <table className="erp min-w-[760px]">
              <thead>
                <tr>
                  <th className="w-[72px]">Nr</th>
                  <th>Naam</th>
                  <th>Bijnaam</th>
                  <th>Positie</th>
                  <th>Rol</th>
                  <th>Actief</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sorted.map((m) => (
                  <tr key={m.id} className={m.active ? "" : "opacity-50"}>
                    <td>
                      {m.role === "player" ? (
                        <input
                          className="input erp-mono w-[64px]"
                          type="number"
                          min={0}
                          max={99}
                          value={m.number ?? ""}
                          placeholder="?"
                          onChange={(e) => setMember(m.id, { number: e.target.value === "" ? null : Number(e.target.value) })}
                        />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td><input className="input min-w-[150px]" value={m.name} placeholder="Naam" onChange={(e) => setMember(m.id, { name: e.target.value })} /></td>
                    <td><input className="input w-[110px]" value={m.nickname} placeholder={m.name.split(" ")[0] || "—"} onChange={(e) => setMember(m.id, { nickname: e.target.value })} /></td>
                    <td>
                      {m.role === "player" ? (
                        <Select value={m.position} onChange={(v) => setMember(m.id, { position: v })} options={POSITION_OPTIONS} />
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </td>
                    <td><Select value={m.role} onChange={(v) => setMember(m.id, { role: v })} options={ROLE_OPTIONS} /></td>
                    <td><Checkbox checked={m.active} onChange={(v) => setMember(m.id, { active: v })} /></td>
                    <td className="text-right">
                      <button
                        type="button"
                        className="btn btn-sm btn-danger"
                        aria-label="Verwijder"
                        onClick={() => {
                          if (!window.confirm(`${m.name || "Dit teamlid"} definitief verwijderen? Zet liever “actief” uit als hij nog in oude weekenden voorkomt.`)) return;
                          updateTeam((t) => t.filter((x) => x.id !== m.id));
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 text-[11.5px] text-faint border-t border-line">
            Nieuwe weekenden nemen de actieve selectie als deelnemerslijst. Bestaande weekenden veranderen niet mee.
          </div>
        </Card>

        <div className="space-y-3">
          <Card eyebrow="Rooster" title="Shirttas op rugnummer">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Aan de beurt" hint="Voor de eerste wedstrijd op of na de datum">
                <Select
                  value={cal.shirtBag.memberId}
                  onChange={(v) => updateCalendar((c) => ({ ...c, shirtBag: { ...c.shirtBag, memberId: v } }))}
                  options={order.map((m) => ({ value: m.id, label: memberLabel(m) }))}
                />
              </Field>
              <Field label="Vanaf">
                <input className="input erp-mono" type="date" value={cal.shirtBag.fromDate} onChange={(e) => updateCalendar((c) => ({ ...c, shirtBag: { ...c.shirtBag, fromDate: e.target.value } }))} />
              </Field>
            </div>
            <div className="flex flex-wrap gap-1 mt-3">
              {order.map((m, i) => (
                <span key={m.id} className={`inline-flex items-center gap-1 rounded-[4px] border px-1.5 py-0.5 text-[11px] font-semibold ${m.id === cal.shirtBag.memberId ? "bg-navy text-white border-navy" : "border-line bg-sunken text-navy"}`}>
                  <span className="erp-mono opacity-70">{m.number !== null ? m.number : "?"}</span>
                  {shortName(m)}
                  {i < order.length - 1 && <ChevronRight size={10} className="opacity-50" />}
                </span>
              ))}
            </div>
            <div className="text-[11.5px] text-faint mt-3 pt-2 border-t border-line">
              Oplopend op rugnummer; spelers zonder nummer sluiten de rij. Een afwijking op één wedstrijd (in de editor) schuift het rooster niet op.
            </div>
          </Card>

          <Card eyebrow="Per wedstrijd" title="Wie neemt de shirttas mee" padded={false}>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-line">
              {schedule.map((a) => {
                const past = a.event.date < today;
                return (
                  <button key={a.event.id} type="button" onClick={() => onEvent(a.event.id)} className={`w-full text-left px-4 py-2 flex items-center gap-3 hover:bg-sunken ${past ? "opacity-50" : ""}`}>
                    <span className="erp-mono text-[11px] text-faint w-[64px] shrink-0">{formatDateKey(a.event.date, { weekday: undefined })}</span>
                    <span className="text-[12.5px] truncate flex-1">
                      {a.event.opponent || a.event.title}
                      <span className="text-faint"> · {a.event.isHome ? "thuis" : "uit"}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 shrink-0">
                      <Shirt size={12} className="text-faint" />
                      <span className="erp-mono text-[11px] text-faint">{a.member?.number !== null && a.member?.number !== undefined ? `#${a.member.number}` : "#?"}</span>
                      <span className="text-[12.5px] font-semibold text-navy">{a.member ? shortName(a.member) : "—"}</span>
                      {a.override && <Badge tone="warn">afw.</Badge>}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor                                                               */
/* ------------------------------------------------------------------ */

function EventEditor({
  ev,
  cal,
  team,
  weekends,
  onChange,
  onDelete,
  onCreateWeekend,
  onSyncWeekend,
}: {
  ev: SeasonEvent;
  cal: SeasonCalendar;
  team: TeamMember[];
  weekends: Weekend[];
  onChange: (patch: Partial<SeasonEvent>) => void;
  onDelete: () => void;
  onCreateWeekend: () => void;
  onSyncWeekend: () => void;
}) {
  const match = isMatch(ev);
  const names = knownDriverNames(cal, players(team).map(shortName));
  const bag = match ? shirtBagFor(cal, team, ev.id) : null;
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

      {match && (
        <Field label="Shirttas" hint={bag && !bag.override ? `Volgens rooster: ${memberLabel(bag.member)}` : "Handmatige afwijking; het rooster schuift niet op."}>
          <Select
            value={ev.shirtBagMemberId}
            onChange={(v) => onChange({ shirtBagMemberId: v })}
            options={[{ value: "", label: `Volgens rooster${bag?.member ? ` (${shortName(bag.member)})` : ""}` }, ...rotationOrder(team).map((m) => ({ value: m.id, label: memberLabel(m) }))]}
          />
        </Field>
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
