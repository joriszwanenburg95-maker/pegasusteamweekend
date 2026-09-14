"use client";

import { useState } from "react";
import { formatDateTime, headcount } from "@/lib/engine";
import type { Attendance, DecisionTopic, Participant } from "@/lib/types";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import { Badge, Callout, Card, Checkbox, Kpi, StatusBadge, TextInput } from "@/components/ui";

type AttendanceField = "match" | "weekend" | "overnight" | "sunday" | "dinner";

const ATTENDANCE_FIELDS: { key: AttendanceField; label: string }[] = [
  { key: "match", label: "Match" },
  { key: "weekend", label: "Weekend" },
  { key: "overnight", label: "Overnight" },
  { key: "sunday", label: "Sunday" },
  { key: "dinner", label: "Dinner" },
];

const ATTENDANCE_OPTIONS: Attendance[] = ["going", "notGoing", "unknown"];

const ATTENDANCE_CLASS: Record<Attendance, string> = {
  going: "border-go/40 bg-go-bg text-go",
  notGoing: "border-nogo/40 bg-nogo-bg text-nogo",
  unknown: "border-unknown/40 bg-unknown-bg text-unknown",
};

/** Compacte attendance-select met tone-kleur (lokale helper, geen ui-primitive). */
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
      className={`erp-mono w-[92px] rounded-[4px] border px-1 py-1 text-[11px] font-bold ${ATTENDANCE_CLASS[value]}`}
      value={value}
      onChange={(e) => onChange(e.target.value as Attendance)}
    >
      {ATTENDANCE_OPTIONS.map((o) => (
        <option key={o} value={o}>
          {o}
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
    logDecision("attendance", `Deelnemer ${name} toegevoegd aan de bezetting (status unknown).`);
    setNewName("");
    setNewRole("");
  };

  const removeParticipant = (p: Participant) => {
    if (!window.confirm(`${p.name} verwijderen uit dit weekend? Auto-indeling en owners worden opgeschoond.`)) return;
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
    logDecision("attendance", `Deelnemer ${p.name} verwijderd; vervoersindeling en checklist-owners opgeschoond.`);
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
    logDecision("attendance", "Bulk: alle 'unknown' attendance omgezet naar 'going'.");
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
    logDecision("attendance", "Bulk: weekend-status gekopieerd naar overnight, sunday en dinner.");
  };

  const unknownWeekend = weekend.participants.filter((p) => p.weekend === "unknown").length;

  const lockHeadcount = (override: boolean) => {
    set("headcountLockedAt", now);
    logDecision(
      "attendance",
      override
        ? `OVERRIDE: headcount gelocked met ${unknownWeekend} deelnemer(s) nog 'unknown' (${hc.weekend.going} going).`
        : `Headcount gelocked op ${hc.weekend.going} weekendgangers.`,
    );
  };

  const unlockHeadcount = () => {
    set("headcountLockedAt", null);
    logDecision("attendance", "Headcount unlocked; groepsgrootte weer in beweging.");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="erp-label">Module H-01 · Bezetting</div>
          <h2 className="text-base font-bold tracking-tight text-navy">HEADCOUNT LOCK</h2>
        </div>
        <div className="erp-mono text-[11.5px] text-faint">{hc.total} deelnemers in de registratie</div>
      </div>

      {/* ---------------- Summary ---------------- */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-7">
        {ATTENDANCE_FIELDS.map((f) => {
          const c = hc[f.key];
          return (
            <Kpi
              key={f.key}
              label={f.label}
              value={c.going}
              unit="going"
              tone={c.unknown > 0 ? "warn" : "go"}
              sub={`${c.going} going · ${c.notGoing} notGoing · ${c.unknown} unknown`}
            />
          );
        })}
        <Kpi label="Travelers" value={hc.travelers} sub="Weekend going zonder eigen vervoer" />
        <Kpi label="Drivers" value={hc.drivers} sub="Chauffeurs die mee gaan" tone={hc.drivers === 0 ? "nogo" : undefined} />
      </div>

      {/* ---------------- Lock control ---------------- */}
      <Card title="HEADCOUNT LOCK CONTROL" eyebrow="Governance" actions={<StatusBadge status={hc.locked ? "PASS" : "UNKNOWN"} />}>
        {hc.locked ? (
          <div className="flex flex-wrap items-center gap-3">
            <Badge tone="go">HEADCOUNT LOCKED at {hc.lockedAt ? formatDateTime(hc.lockedAt) : "—"}</Badge>
            <span className="erp-mono text-[11.5px] text-muted">{hc.weekend.going} weekendgangers vastgelegd.</span>
            <button className="btn btn-sm btn-danger" onClick={unlockHeadcount}>
              Unlock
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="btn btn-sm btn-primary"
                disabled={unknownWeekend > 0}
                title={unknownWeekend > 0 ? `${unknownWeekend} deelnemer(s) nog 'unknown' op weekend.` : undefined}
                onClick={() => lockHeadcount(false)}
              >
                LOCK HEADCOUNT
              </button>
              {unknownWeekend > 0 && (
                <button className="btn btn-sm btn-danger" onClick={() => lockHeadcount(true)}>
                  Lock anyway (override)
                </button>
              )}
            </div>
            {unknownWeekend > 0 ? (
              <Callout tone="warn" title="Lock geblokkeerd">
                {unknownWeekend} deelnemer(s) staan nog op <span className="erp-mono">unknown</span> voor het weekend.
                Locken met onbekenden legt een OVERRIDE vast in het decision log.
              </Callout>
            ) : (
              <div className="erp-mono text-[11.5px] text-muted">
                Iedereen heeft een status. Lock zet de groepsgrootte vast op {hc.weekend.going}.
              </div>
            )}
          </div>
        )}
      </Card>

      {/* ---------------- Bulk ---------------- */}
      <Card title="BULK ACTIONS" eyebrow="Data entry">
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-sm" onClick={setAllUnknownGoing}>
            Set all unknown → going
          </button>
          <button className="btn btn-sm" onClick={copyWeekendToRest}>
            Copy weekend → overnight/dinner/sunday
          </button>
        </div>
      </Card>

      {/* ---------------- Participants ---------------- */}
      <Card title="PARTICIPANTS" eyebrow="Attendance register" padded={false}>
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

      {/* ---------------- Capacity mismatches ---------------- */}
      <Card title="CAPACITY MISMATCH" eyebrow="Reserveringen vs. attendance">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {hc.mismatches.map((m) => (
            <div key={m.key} className="rounded-[6px] border border-line bg-sunken px-3 py-2">
              <div className="flex items-start justify-between gap-2">
                <span className="erp-mono text-[12px] font-bold uppercase tracking-[0.08em] text-navy">{m.label}</span>
                <StatusBadge status={m.status} />
              </div>
              <div className="erp-mono mt-1 text-[11.5px] leading-relaxed text-muted">
                <div>Reserved: {m.reserved}</div>
                <div>Confirmed {m.key === "dinner" ? "dinner participants" : m.key === "beds" ? "overnight participants" : "participants"}: {m.confirmed}</div>
                <div className="text-fg">STATUS: {m.status}</div>
              </div>
              <div className="mt-1 text-[11.5px] leading-snug text-muted">{m.detail}</div>
            </div>
          ))}
          {hc.mismatches.length === 0 && (
            <div className="erp-mono text-[12px] text-muted">Geen reserveringen om te toetsen.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
