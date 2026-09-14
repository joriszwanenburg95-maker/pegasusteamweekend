"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState, type ReactNode } from "react";
import type { AppState, SeasonCalendar, SeasonEvent, Weekend } from "@/lib/types";
import { SEED_VERSION, seedState } from "@/data/seed";

const STORAGE_KEY = "pegasus-teamweekend-erp-v1";

type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "upsertWeekend"; weekend: Weekend }
  | { type: "updateWeekend"; id: string; patch: (w: Weekend) => Weekend }
  | { type: "deleteWeekend"; id: string }
  | { type: "updateCalendar"; patch: (c: SeasonCalendar) => SeasonCalendar }
  | { type: "upsertEvent"; event: SeasonEvent }
  | { type: "deleteEvent"; id: string }
  | { type: "setClock"; iso: string | null }
  | { type: "reset" };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;
    case "upsertWeekend": {
      const exists = state.weekends.some((w) => w.id === action.weekend.id);
      return {
        ...state,
        weekends: exists
          ? state.weekends.map((w) => (w.id === action.weekend.id ? action.weekend : w))
          : [action.weekend, ...state.weekends],
      };
    }
    case "updateWeekend":
      return {
        ...state,
        weekends: state.weekends.map((w) => (w.id === action.id ? action.patch(w) : w)),
      };
    case "deleteWeekend":
      return {
        ...state,
        weekends: state.weekends.filter((w) => w.id !== action.id),
        // Koppelingen naar een verwijderd weekend opruimen.
        calendar: {
          ...state.calendar,
          events: state.calendar.events.map((e) => (e.weekendId === action.id ? { ...e, weekendId: null } : e)),
        },
      };
    case "updateCalendar":
      return { ...state, calendar: action.patch(state.calendar) };
    case "upsertEvent": {
      const exists = state.calendar.events.some((e) => e.id === action.event.id);
      return {
        ...state,
        calendar: {
          ...state.calendar,
          events: exists
            ? state.calendar.events.map((e) => (e.id === action.event.id ? action.event : e))
            : [...state.calendar.events, action.event],
        },
      };
    }
    case "deleteEvent":
      return { ...state, calendar: { ...state.calendar, events: state.calendar.events.filter((e) => e.id !== action.id) } };
    case "setClock":
      return { ...state, clockOverride: action.iso };
    case "reset":
      return seedState();
  }
}

interface StoreValue {
  state: AppState;
  hydrated: boolean;
  /** "Nu" volgens de app (echte klok of simulatie). ISO. */
  now: string;
  dispatch: (a: Action) => void;
  updateWeekend: (id: string, patch: (w: Weekend) => Weekend) => void;
  getWeekend: (idOrSlug: string) => Weekend | undefined;
  updateCalendar: (patch: (c: SeasonCalendar) => SeasonCalendar) => void;
  upsertEvent: (event: SeasonEvent) => void;
  updateEvent: (id: string, patch: Partial<SeasonEvent>) => void;
  deleteEvent: (id: string) => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, seedState);
  const [hydrated, setHydrated] = useState(false);
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as AppState;
        if (parsed && parsed.version === SEED_VERSION && Array.isArray(parsed.weekends) && parsed.calendar) {
          dispatch({ type: "hydrate", state: parsed });
        }
      }
    } catch {
      /* corrupt storage → seed */
    }
    // localStorage is alleen client-side beschikbaar; hydrateren ná mount is hier bewust.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota / private mode */
    }
  }, [state, hydrated]);

  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const updateWeekend = useCallback(
    (id: string, patch: (w: Weekend) => Weekend) => dispatch({ type: "updateWeekend", id, patch }),
    [],
  );
  const getWeekend = useCallback(
    (idOrSlug: string) => state.weekends.find((w) => w.id === idOrSlug || w.slug === idOrSlug),
    [state.weekends],
  );
  const updateCalendar = useCallback(
    (patch: (c: SeasonCalendar) => SeasonCalendar) => dispatch({ type: "updateCalendar", patch }),
    [],
  );
  const upsertEvent = useCallback((event: SeasonEvent) => dispatch({ type: "upsertEvent", event }), []);
  const updateEvent = useCallback(
    (id: string, patch: Partial<SeasonEvent>) =>
      dispatch({
        type: "updateCalendar",
        patch: (c) => ({ ...c, events: c.events.map((e) => (e.id === id ? { ...e, ...patch } : e)) }),
      }),
    [],
  );
  const deleteEvent = useCallback((id: string) => dispatch({ type: "deleteEvent", id }), []);

  const now = state.clockOverride ?? new Date(tick).toISOString();

  const value = useMemo<StoreValue>(
    () => ({ state, hydrated, now, dispatch, updateWeekend, getWeekend, updateCalendar, upsertEvent, updateEvent, deleteEvent }),
    [state, hydrated, now, updateWeekend, getWeekend, updateCalendar, upsertEvent, updateEvent, deleteEvent],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

/** Handige hook voor één weekend incl. patch-helper. */
export function useWeekend(idOrSlug: string) {
  const { getWeekend, updateWeekend, now } = useStore();
  const weekend = getWeekend(idOrSlug);
  const patch = useCallback(
    (fn: (w: Weekend) => Weekend) => {
      if (weekend) updateWeekend(weekend.id, fn);
    },
    [weekend, updateWeekend],
  );
  const set = useCallback(
    <K extends keyof Weekend>(key: K, value: Weekend[K]) => patch((w) => ({ ...w, [key]: value })),
    [patch],
  );
  return { weekend, patch, set, now };
}

export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}
