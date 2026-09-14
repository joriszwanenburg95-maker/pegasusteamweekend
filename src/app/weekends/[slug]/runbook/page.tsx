"use client";

import { useState } from "react";
import { assessTransport, formatDateTime } from "@/lib/engine";
import type { ChecklistItem, ChecklistSection, ChecklistStatus, DecisionTopic } from "@/lib/types";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import { Badge, Card, DateTimeInput, Progress, Select, StatusBadge, TextInput, toneForPercent } from "@/components/ui";

const SECTIONS: { key: ChecklistSection; title: string; note?: string }[] = [
  { key: "beforeDeparture", title: "BEFORE DEPARTURE" },
  { key: "access", title: "ACCESS" },
  { key: "teamEquipment", title: "TEAM EQUIPMENT" },
  {
    key: "personal",
    title: "PERSONAL / LOCATION-SPECIFIC",
    note: "Alleen items die door de situatie relevant zijn (bijv. tent wanneer de accommodatie geen bedden levert).",
  },
];

const STATUS_OPTIONS: { value: ChecklistStatus; label: string }[] = [
  { value: "open", label: "open" },
  { value: "inProgress", label: "inProgress" },
  { value: "done", label: "done" },
  { value: "blocked", label: "blocked" },
  { value: "na", label: "na" },
];

const STATUS_GLYPH: Record<ChecklistStatus, string> = {
  open: "[ ]",
  inProgress: "[~]",
  done: "[x]",
  blocked: "[!]",
  na: "[-]",
};

const STATUS_COLOR: Record<ChecklistStatus, string> = {
  open: "text-unknown",
  inProgress: "text-warn",
  done: "text-go",
  blocked: "text-nogo",
  na: "text-faint",
};

function nextStatus(s: ChecklistStatus): ChecklistStatus {
  if (s === "open") return "inProgress";
  if (s === "inProgress") return "done";
  if (s === "done") return "open";
  return "open";
}

function AccessLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap gap-x-2 border-b border-line py-1 last:border-0">
      <span className="erp-label w-[130px] shrink-0">{label}</span>
      <span className="erp-mono text-[12px] text-fg">{value || "—"}</span>
    </div>
  );
}

export default function RunbookPage() {
  const { weekend, patch, now } = useCurrentWeekend();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  if (!weekend) return null;

  const acc = weekend.accommodation;
  const transport = assessTransport(weekend);

  const logDecision = (topic: DecisionTopic, summary: string) =>
    patch((w) => ({
      ...w,
      decisions: [...w.decisions, { id: newId("d"), at: now, topic, summary }],
    }));

  const updateItem = (id: string, update: Partial<ChecklistItem>) =>
    patch((w) => ({
      ...w,
      checklist: w.checklist.map((c) => (c.id === id ? { ...c, ...update } : c)),
    }));

  const addItem = (section: ChecklistSection) => {
    const label = (drafts[section] ?? "").trim();
    if (!label) return;
    patch((w) => ({
      ...w,
      checklist: [
        ...w.checklist,
        { id: newId("c"), section, label, ownerId: null, status: "open", deadline: null },
      ],
    }));
    setDrafts((d) => ({ ...d, [section]: "" }));
  };

  const removeItem = (item: ChecklistItem) => {
    if (!window.confirm(`Runbook-item "${item.label}" verwijderen?`)) return;
    patch((w) => ({ ...w, checklist: w.checklist.filter((c) => c.id !== item.id) }));
  };

  const ownerOptions = [
    { value: "", label: "—" },
    ...weekend.participants.map((p) => ({ value: p.id, label: p.name })),
  ];

  const departureMinus24 = new Date(new Date(weekend.departureAt).getTime() - 24 * 3_600_000).toISOString();

  const applicable = weekend.checklist.filter((c) => c.status !== "na");
  const doneAll = weekend.checklist.filter((c) => c.status === "done").length;
  const completion = applicable.length
    ? Math.round((applicable.filter((c) => c.status === "done").length / applicable.length) * 100)
    : 100;

  const autoChecks: { label: string; status: string; detail: string }[] = [
    {
      label: "Attendance locked",
      status: weekend.headcountLockedAt ? "PASS" : "FAIL",
      detail: weekend.headcountLockedAt ? formatDateTime(weekend.headcountLockedAt) : "headcount niet gelocked",
    },
    {
      label: "Restaurant confirmed",
      status: weekend.dinner.reserved ? "PASS" : "FAIL",
      detail: weekend.dinner.reserved ? `${weekend.dinner.reservedCount} pers.` : "geen reservering",
    },
    {
      label: "Accommodation confirmed",
      status: acc.confirmed ? "PASS" : "FAIL",
      detail: acc.name || "geen accommodatie",
    },
    {
      label: "Drivers confirmed",
      status: transport.driversConfirmed ? "PASS" : "FAIL",
      detail: transport.driversConfirmed ? `${weekend.vehicles.length} auto(s)` : "chauffeur ontbreekt of gaat niet mee",
    },
    {
      label: "Passengers assigned",
      status: transport.unassignedTravelerIds.length === 0 ? "PASS" : "FAIL",
      detail:
        transport.unassignedTravelerIds.length === 0
          ? "iedereen ingedeeld"
          : `${transport.unassignedTravelerIds.length} reiziger(s) zonder stoel`,
    },
  ];

  return (
    <div className="space-y-4">
      <style>{`@media print { .no-print { display: none !important; } .card, .card-navy { break-inside: avoid; } }`}</style>

      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="erp-label">Module O-01 · Uitvoering</div>
          <h2 className="text-base font-bold tracking-tight text-navy">RUNBOOK</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="erp-mono text-[11.5px] text-faint">
            RUNBOOK COMPLETION {completion}% · {doneAll}/{weekend.checklist.length} done
          </span>
          <button className="btn btn-sm no-print" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <Progress value={completion} tone={toneForPercent(completion)} />

      {/* ---------------- Auto-checks ---------------- */}
      <Card title="AUTO-CHECKS" eyebrow="Live uit de engine — read-only">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {autoChecks.map((a) => (
            <div key={a.label} className="rounded-[6px] border border-line bg-sunken px-2 py-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] font-semibold text-navy">{a.label}</span>
                <StatusBadge status={a.status} />
              </div>
              <div className="erp-mono text-[10.5px] leading-snug text-muted">{a.detail}</div>
            </div>
          ))}
        </div>
      </Card>

      {SECTIONS.map((section) => {
        const items = weekend.checklist.filter((c) => c.section === section.key);
        if (section.key === "personal" && items.length === 0) return null;
        const sectionApplicable = items.filter((c) => c.status !== "na");
        const sectionDone = items.filter((c) => c.status === "done").length;
        const sectionPct = sectionApplicable.length
          ? Math.round((sectionApplicable.filter((c) => c.status === "done").length / sectionApplicable.length) * 100)
          : 100;

        return (
          <Card
            key={section.key}
            title={section.title}
            eyebrow={section.key === "access" ? "Toegang + checklist" : "Checklist"}
            actions={
              <span className="erp-mono text-[11px] text-muted">
                {sectionDone}/{items.length} done
              </span>
            }
            padded={false}
          >
            <div className="px-4 pt-2">
              <Progress value={sectionPct} tone={toneForPercent(sectionPct)} />
              {section.note && <div className="mt-2 text-[11px] leading-snug text-faint">{section.note}</div>}
            </div>

            {section.key === "access" && (
              <div className="px-4 pt-3">
                <AccessLine label="Accommodation" value={acc.name ? `${acc.name}${acc.address ? `, ${acc.address}` : ""}` : ""} />
                <AccessLine label="Gate/access code" value={acc.accessCode} />
                <AccessLine label="Contact" value={acc.contact} />
                <AccessLine
                  label="Check-in"
                  value={acc.checkInFrom || acc.checkInUntil ? `${acc.checkInFrom || "?"}–${acc.checkInUntil || "?"}` : ""}
                />
              </div>
            )}

            <div className="mt-2 overflow-x-auto">
              <table className="erp">
                <thead>
                  <tr>
                    <th className="w-[54px]">St.</th>
                    <th className="w-[120px]">Status</th>
                    <th className="min-w-[200px]">Item</th>
                    <th className="w-[150px]">Owner</th>
                    <th className="min-w-[190px]">Deadline</th>
                    <th className="w-[90px] no-print" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const overdue =
                      item.deadline !== null &&
                      new Date(item.deadline).getTime() < new Date(now).getTime() &&
                      item.status !== "done" &&
                      item.status !== "na";
                    return (
                      <tr key={item.id} className={overdue ? "bg-nogo-bg" : undefined}>
                        <td>
                          <button
                            className={`erp-mono text-[14px] font-bold ${STATUS_COLOR[item.status]}`}
                            title="Klik: open → inProgress → done"
                            aria-label={`Status ${item.label}: ${item.status}`}
                            onClick={() => updateItem(item.id, { status: nextStatus(item.status) })}
                          >
                            {STATUS_GLYPH[item.status]}
                          </button>
                        </td>
                        <td>
                          <div className="w-[112px]">
                            <Select
                              value={item.status}
                              onChange={(v) => updateItem(item.id, { status: v })}
                              options={STATUS_OPTIONS}
                            />
                          </div>
                        </td>
                        <td className="min-w-[200px]">
                          <TextInput value={item.label} onChange={(v) => updateItem(item.id, { label: v })} />
                          {item.conditional && (
                            <span className="erp-label mt-0.5 block">conditional · alleen tonen indien relevant</span>
                          )}
                        </td>
                        <td>
                          <div className="w-[140px]">
                            <Select
                              value={item.ownerId ?? ""}
                              onChange={(v) => updateItem(item.id, { ownerId: v === "" ? null : v })}
                              options={ownerOptions}
                            />
                          </div>
                        </td>
                        <td className="min-w-[190px]">
                          {item.deadline === null ? (
                            <div className="flex items-center gap-2">
                              <span className="erp-mono text-[12px] text-faint">—</span>
                              <button
                                className="btn btn-sm no-print"
                                onClick={() => updateItem(item.id, { deadline: departureMinus24 })}
                              >
                                Zet op T-24h
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <DateTimeInput value={item.deadline} onChange={(iso) => updateItem(item.id, { deadline: iso })} />
                              <button
                                className="btn btn-sm no-print"
                                title="Deadline wissen"
                                onClick={() => updateItem(item.id, { deadline: null })}
                              >
                                ×
                              </button>
                            </div>
                          )}
                          {overdue && (
                            <span className="erp-mono mt-0.5 block text-[10.5px] font-bold text-nogo">
                              OVERDUE · {formatDateTime(item.deadline ?? now)}
                            </span>
                          )}
                        </td>
                        <td className="no-print">
                          <button className="btn btn-sm btn-danger" onClick={() => removeItem(item)}>
                            Verwijder
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        Geen items in deze sectie.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="no-print flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
              <div className="w-[240px]">
                <span className="erp-label mb-1 block">Nieuw item</span>
                <TextInput
                  value={drafts[section.key] ?? ""}
                  onChange={(v) => setDrafts((d) => ({ ...d, [section.key]: v }))}
                  placeholder="Omschrijving"
                />
              </div>
              <button
                className="btn btn-sm btn-primary"
                disabled={!(drafts[section.key] ?? "").trim()}
                onClick={() => addItem(section.key)}
              >
                Toevoegen
              </button>
            </div>
          </Card>
        );
      })}

      <Card title="RUNBOOK SIGN-OFF" eyebrow="Operational readiness">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={toneForPercent(completion)}>COMPLETION {completion}%</Badge>
          <span className="erp-mono text-[11.5px] text-muted">
            {doneAll} done · {weekend.checklist.filter((c) => c.status === "blocked").length} blocked ·{" "}
            {weekend.checklist.filter((c) => c.status === "na").length} n.v.t.
          </span>
          <button
            className="btn btn-sm no-print"
            disabled={completion < 100}
            title={completion < 100 ? "Alle toepasselijke items moeten done zijn." : undefined}
            onClick={() => logDecision("other", `Runbook afgetekend op ${formatDateTime(now)} (100% completion).`)}
          >
            Teken runbook af
          </button>
        </div>
      </Card>
    </div>
  );
}
