"use client";

import { useState } from "react";
import { formatDateTime, headcount } from "@/lib/engine";
import type { Attendance, DecisionTopic, Participant } from "@/lib/types";
import { ATTENDANCE_OPTIONS, nl } from "@/lib/labels";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import { Badge, Callout, Card, Checkbox, Kpi, StatusBadge, TextInput, type Tone } from "@/components/ui";
import { CountUp, DotRow, Gauge, ScoreScale, StackedBar } from "@/components/viz";

type AttendanceField = "match" | "weekend" | "overnight" | "sunday" | "dinner";

const ATTENDANCE_FIELDS: { key: AttendanceField; label: string }[] = [
  { key: "match", label: "Wedstrijd" },
  { key: "weekend", label: "Weekend" },
  { key: "overnight", label: "Overnachting" },
  { key: "sunday", label: "Zondag" },
  { key: "dinner", label: "Eten" },
];

const ATTENDANCE_CLASS: Record<Attendance, string> = {
  going: "border-go/40 bg-go-bg text-go",
  notGoing: "border-nogo/40 bg-nogo-bg text-nogo",
  unknown: "border-unknown/40 bg-unknown-bg text-unknown",
};

/** Compacte aanwezigheidsselect met tone-kleur (lokale helper, geen ui-primitive). */
function AttendanceSelect({
  value,
  onChange,
  label,
}: {
  value: Attendance;
  onChange: (v: Attendance) => void;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      className={`erp-mono w-[104px] rounded-[4px] border px-1 py-1 text-[11px] font-bold ${ATTENDANCE_CLASS[value]}`}
      value={value}
      onChange={(e) => onChange(e.target.value as Attendance)}
    >
      {ATTENDANCE_OPTIONS.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function HeadcountPage() {
  const { weekend, patch, set, now } = useCurrentWeekend();
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  if (!weekend) return null;

  const hc = headcount(weekend);

  const logDecision = (topic: DecisionTopic, summary: string) =>
    patch((w) => ({
      ...w,
      decisions: [...w.decisions, { id: newId("d"), at: now, topic, summary }],
    }));

  const updateParticipant = (id: string, update: Partial<Participant>) =>
    patch((w) => ({
      ...w,
      participants: w.participants.map((p) => (p.id === id ? { ...p, ...update } : p)),
    }));

  const setAttendance = (id: string, field: AttendanceField, value: Attendance) =>
    patch((w) => ({
      ...w,
      participants: w.participants.map((p) => {
        if (p.id !== id) return p;
        const next: Participant = { ...p };
        next[field] = value;
        return next;
      }),
    }));

  const addParticipant = () => {
    const name = newName.trim();
    if (!name) return;
    const p: Participant = {
      id: newId("p"),
      name,
      role: newRole.trim() || undefined,
      match: "unknown",
      weekend: "unknown",
      overnight: "unknown",
      sunday: "unknown",
      dinner: "unknown",
      ownTransport: false,
      isDriver: false,
    };
    patch((w) => ({ ...w, participants: [...w.participants, p] }));
    logDecision("attendance", `Deelnemer ${name} toegevoegd (status ${nl("unknown")}).`);
    setNewName("");
    setNewRole("");
  };

  const removeParticipant = (p: Participant) => {
    if (!window.confirm(`${p.name} verwijderen uit dit weekend? Auto-indeling en eigenaren worden opgeschoond.`)) return;
    patch((w) => ({
      ...w,
      participants: w.participants.filter((x) => x.id !== p.id),
      vehicles: w.vehicles.map((v) => ({
        ...v,
        driverId: v.driverId === p.id ? null : v.driverId,
        passengerIds: v.passengerIds.filter((id) => id !== p.id),
      })),
      checklist: w.checklist.map((c) => (c.ownerId === p.id ? { ...c, ownerId: null } : c)),
    }));
    logDecision("attendance", `Deelnemer ${p.name} verwijderd; vervoersindeling en eigenaren in het draaiboek opgeschoond.`);
  };

  const setAllUnknownGoing = () => {
    patch((w) => ({
      ...w,
      participants: w.participants.map((p) => ({
        ...p,
        match: p.match === "unknown" ? "going" : p.match,
        weekend: p.weekend === "unknown" ? "going" : p.weekend,
        overnight: p.overnight === "unknown" ? "going" : p.overnight,
        sunday: p.sunday === "unknown" ? "going" : p.sunday,
        dinner: p.dinner === "unknown" ? "going" : p.dinner,
      })),
    }));
    logDecision("attendance", `Bulk: alles op ${nl("unknown")} omgezet naar ${nl("going")}.`);
  };

  const copyWeekendToRest = () => {
    patch((w) => ({
      ...w,
      participants: w.participants.map((p) => ({
        ...p,
        overnight: p.weekend,
        sunday: p.weekend,
        dinner: p.weekend,
      })),
    }));
    logDecision("attendance", "Bulk: weekendstatus gekopieerd naar overnachting, zondag en eten.");
  };

  const unknownWeekend = weekend.participants.filter((p) => p.weekend === "unknown").length;

  const lockHeadcount = (override: boolean) => {
    set("headcountLockedAt", now);
    logDecision(
      "attendance",
      override
        ? `OVERRIDE: deelnemersaantal vergrendeld met ${unknownWeekend} deelnemer(s) nog op ${nl("unknown")} (${hc.weekend.going} gaan mee).`
        : `Deelnemersaantal vergrendeld op ${hc.weekend.going} weekendgangers.`,
    );
  };

  const unlockHeadcount = () => {
    set("headcountLockedAt", null);
    logDecision("attendance", "Deelnemersaantal ontgrendeld; groepsgrootte weer in beweging.");
  };

  const knownPct = hc.total === 0 ? 0 : Math.round(((hc.total - unknownWeekend) / hc.total) * 100);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="erp-label">Module H-01 · Bezetting</div>
          <h2 className="text-base font-bold tracking-tight text-navy">DEELNEMERS VERGRENDELEN</h2>
        </div>
        <div className="erp-mono text-[11.5px] text-faint">
          <CountUp value={hc.total} /> deelnemers geregistreerd
        </div>
      </div>

      {/* ---------------- Aanwezigheid per onderdeel ---------------- */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="AANWEZIGHEID PER ONDERDEEL" eyebrow="Eén punt = één deelnemer" className="lg:col-span-2 rise rise-1">
          <div className="space-y-2.5">
            {ATTENDANCE_FIELDS.map((f) => {
              const c = hc[f.key];
              const tone: Tone = c.unknown > 0 ? "warn" : "go";
              return (
                <div key={f.key} className="border-b border-line pb-2 last:border-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[12.5px] font-semibold text-navy">{f.label}</span>
                    <span className="erp-mono text-[11px] text-muted">
                      <span className="font-semibold text-go">{c.going}</span> {nl("going").toLowerCase()} ·{" "}
                      <span className="text-nogo">{c.notGoing}</span> {nl("notGoing").toLowerCase()} ·{" "}
                      <span className={c.unknown > 0 ? "text-warn font-semibold" : ""}>{c.unknown}</span>{" "}
                      {nl("unknown").toLowerCase()}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <DotRow values={weekend.participants.map((p) => p[f.key])} />
                  </div>
                  <div className="mt-1">
                    <ScoreScale value={c.going} max={Math.max(1, hc.total)} tone={tone} ticks={4} height={5} />
                  </div>
                </div>
              );
            })}
            {hc.total === 0 && <div className="text-[12px] text-faint">Nog geen deelnemers geregistreerd.</div>}
          </div>
        </Card>

        <div className="space-y-3 rise rise-2">
          <Card title="GROEPSGROOTTE" eyebrow="Weekend">
            <div className="flex items-center gap-3">
              <Gauge
                value={knownPct}
                size={96}
                stroke={9}
                tone={unknownWeekend === 0 ? "go" : "warn"}
                suffix="%"
                label="bekend"
              />
              <div className="min-w-0 flex-1">
                <StackedBar
                  segments={[
                    { label: nl("going"), value: hc.weekend.going, tone: "go" },
                    { label: nl("notGoing"), value: hc.weekend.notGoing, tone: "nogo" },
                    { label: nl("unknown"), value: hc.weekend.unknown, tone: "unknown" },
                  ]}
                  height={12}
                />
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="Reizigers" value={<CountUp value={hc.travelers} />} sub="Zonder eigen vervoer" />
            <Kpi
              label="Chauffeurs"
              value={<CountUp value={hc.drivers} />}
              sub="Gaan mee"
              tone={hc.drivers === 0 ? "nogo" : undefined}
            />
          </div>
        </div>
      </div>

      {/* ---------------- Vergrendeling ---------------- */}
      <Card
        title="VERGRENDELING DEELNEMERSAANTAL"
        eyebrow="Governance"
        actions={<StatusBadge status={hc.locked ? "PASS" : "UNKNOWN"} />}
        className="rise rise-3"
      >
        {hc.locked ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="go">{nl("LOCKED")} · {hc.lockedAt ? formatDateTime(hc.lockedAt) : "—"}</Badge>
            <span className="erp-mono text-[11.5px] text-muted">{hc.weekend.going} weekendgangers vastgelegd.</span>
            <button className="btn btn-sm btn-danger" onClick={unlockHeadcount}>
              Ontgrendel
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-sm btn-primary"
                disabled={unknownWeekend > 0}
                title={unknownWeekend > 0 ? `${unknownWeekend} deelnemer(s) nog op ${nl("unknown")}.` : undefined}
                onClick={() => lockHeadcount(false)}
              >
                Vergrendel deelnemersaantal
              </button>
              {unknownWeekend > 0 && (
                <button className="btn btn-sm btn-danger" onClick={() => lockHeadcount(true)}>
                  Toch vergrendelen (override)
                </button>
              )}
            </div>
            {unknownWeekend > 0 ? (
              <Callout tone="warn" title="Vergrendelen geblokkeerd">
                {unknownWeekend} deelnemer(s) staan nog op <span className="erp-mono">{nl("unknown")}</span> voor het
                weekend. Toch vergrendelen legt een OVERRIDE vast in het besluitenlogboek.
              </Callout>
            ) : (
              <div className="erp-mono text-[11.5px] text-muted">
                Iedereen heeft een status. Vergrendelen zet de groepsgrootte vast op {hc.weekend.going}.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ---------------- Bulk ---------------- */}
      <Card title="BULKACTIES" eyebrow="Invoer" className="rise rise-4">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm" onClick={setAllUnknownGoing}>
            Alles {nl("unknown").toLowerCase()} → {nl("going").toLowerCase()}
          </button>
          <button className="btn btn-sm" onClick={copyWeekendToRest}>
            Weekend kopiëren → overnachting / eten / zondag
          </button>
        </div>
      </Card>

      {/* ---------------- Deelnemers ---------------- */}
      <Card title="DEELNEMERS" eyebrow="Aanwezigheidsregister" padded={false} className="rise rise-5">
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th className="min-w-[150px]">Naam</th>
                <th className="min-w-[110px]">Rol</th>
                {ATTENDANCE_FIELDS.map((f) => (
                  <th key={f.key}>{f.label}</th>
                ))}
                <th>Eigen vervoer</th>
                <th>Chauffeur</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {weekend.participants.map((p) => (
                <tr key={p.id}>
                  <td className="min-w-[150px]">
                    <TextInput value={p.name} onChange={(v) => updateParticipant(p.id, { name: v })} />
                  </td>
                  <td className="min-w-[110px]">
                    <TextInput value={p.role ?? ""} onChange={(v) => updateParticipant(p.id, { role: v })} placeholder="rol / #" />
                  </td>
                  {ATTENDANCE_FIELDS.map((f) => (
                    <td key={f.key}>
                      <AttendanceSelect
                        label={`${p.name} · ${f.label}`}
                        value={p[f.key]}
                        onChange={(v) => setAttendance(p.id, f.key, v)}
                      />
                    </td>
                  ))}
                  <td>
                    <Checkbox checked={p.ownTransport} onChange={(v) => updateParticipant(p.id, { ownTransport: v })} />
                  </td>
                  <td>
                    <Checkbox checked={p.isDriver} onChange={(v) => updateParticipant(p.id, { isDriver: v })} />
                  </td>
                  <td>
                    <button className="btn btn-sm btn-danger" onClick={() => removeParticipant(p)} title={`${p.name} verwijderen`}>
                      Verwijder
                    </button>
                  </td>
                </tr>
              ))}
              {weekend.participants.length === 0 && (
                <tr>
                  <td colSpan={10} className="text-center text-muted">
                    Geen deelnemers geregistreerd.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
          <div className="w-[180px]">
            <span className="erp-label mb-1 block">Nieuwe deelnemer</span>
            <TextInput value={newName} onChange={setNewName} placeholder="Naam" />
          </div>
          <div className="w-[150px]">
            <span className="erp-label mb-1 block">Rol</span>
            <TextInput value={newRole} onChange={setNewRole} placeholder="PL · #4" />
          </div>
          <button className="btn btn-sm btn-primary" disabled={!newName.trim()} onClick={addParticipant}>
            Toevoegen
          </button>
        </div>
      </Card>

      {/* ---------------- Capaciteitsconflicten ---------------- */}
      <Card title="CAPACITEITSCONFLICTEN" eyebrow="Reserveringen vs. aanwezigheid" className="rise rise-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hc.mismatches.map((m) => {
            const max = Math.max(1, m.reserved, m.confirmed);
            const tone: Tone =
              m.status === "OK" ? "go" : m.status === "CAPACITY MISMATCH" ? "nogo" : m.status === "OVERBOOKED" ? "warn" : "unknown";
            return (
              <div key={m.key} className="rounded-[6px] border border-line bg-sunken px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <span className="erp-mono text-[12px] font-bold uppercase tracking-[0.08em] text-navy">{m.label}</span>
                  <StatusBadge status={m.status} />
                </div>
                <div className="mt-2 space-y-1.5">
                  <div>
                    <div className="erp-mono flex justify-between text-[10.5px] text-muted">
                      <span>Gereserveerd</span>
                      <span className="text-fg">{m.reserved}</span>
                    </div>
                    <ScoreScale value={m.reserved} max={max} tone="navy" ticks={1} height={7} />
                  </div>
                  <div>
                    <div className="erp-mono flex justify-between text-[10.5px] text-muted">
                      <span>Bevestigd</span>
                      <span className="text-fg">{m.confirmed}</span>
                    </div>
                    <ScoreScale value={m.confirmed} max={max} tone={tone} ticks={1} height={7} />
                  </div>
                </div>
                <div className="mt-1.5 text-[11.5px] leading-snug text-muted">{m.detail}</div>
              </div>
            );
          })}
          {hc.mismatches.length === 0 && (
            <div className="erp-mono text-[12px] text-muted">Geen reserveringen om te toetsen.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
