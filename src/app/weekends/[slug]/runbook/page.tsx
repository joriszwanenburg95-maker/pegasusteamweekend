"use client";

import { useState } from "react";
import { assessTransport, formatDateTime } from "@/lib/engine";
import type { ChecklistItem, ChecklistSection, ChecklistStatus, DecisionTopic } from "@/lib/types";
import { nl } from "@/lib/labels";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import { Badge, Card, DateTimeInput, Progress, Select, StatusBadge, TextInput, toneForPercent } from "@/components/ui";
import { Gauge, StackedBar } from "@/components/viz";

const SECTIONS: { key: ChecklistSection; note?: string }[] = [
  { key: "beforeDeparture" },
  { key: "access" },
  { key: "teamEquipment" },
  {
    key: "personal",
    note: "Alleen items die door de situatie relevant zijn (bijv. een tent wanneer de accommodatie geen bedden levert).",
  },
];

const CHECKLIST_STATUSES: ChecklistStatus[] = ["open", "inProgress", "done", "blocked", "na"];

const STATUS_OPTIONS = CHECKLIST_STATUSES.map((s) => ({ value: s, label: nl(s) }));

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
    if (!window.confirm(`Draaiboekregel "${item.label}" verwijderen?`)) return;
    patch((w) => ({ ...w, checklist: w.checklist.filter((c) => c.id !== item.id) }));
  };

  const ownerOptions = [
    { value: "", label: "—" },
    ...weekend.participants.map((p) => ({ value: p.id, label: p.name })),
  ];

  const departureMinus24 = new Date(new Date(weekend.departureAt).getTime() - 24 * 3_600_000).toISOString();

  const applicable = weekend.checklist.filter((c) => c.status !== "na");
  const doneAll = weekend.checklist.filter((c) => c.status === "done").length;
  const blockedAll = weekend.checklist.filter((c) => c.status === "blocked").length;
  const naAll = weekend.checklist.filter((c) => c.status === "na").length;
  const inProgressAll = weekend.checklist.filter((c) => c.status === "inProgress").length;
  const openAll = weekend.checklist.filter((c) => c.status === "open").length;
  const completion = applicable.length
    ? Math.round((applicable.filter((c) => c.status === "done").length / applicable.length) * 100)
    : 100;

  const statusSegments = [
    { label: nl("done"), value: doneAll, tone: "go" as const },
    { label: nl("inProgress"), value: inProgressAll, tone: "warn" as const },
    { label: nl("open"), value: openAll, tone: "unknown" as const },
    { label: nl("blocked"), value: blockedAll, tone: "nogo" as const },
    { label: nl("na"), value: naAll, tone: "neutral" as const },
  ].filter((s) => s.value > 0);

  const autoChecks: { label: string; status: string; detail: string }[] = [
    {
      label: "Deelnemers vergrendeld",
      status: weekend.headcountLockedAt ? "PASS" : "FAIL",
      detail: weekend.headcountLockedAt ? formatDateTime(weekend.headcountLockedAt) : "niet vergrendeld",
    },
    {
      label: "Restaurant bevestigd",
      status: weekend.dinner.reserved ? "PASS" : "FAIL",
      detail: weekend.dinner.reserved ? `${weekend.dinner.reservedCount} pers.` : "geen reservering",
    },
    {
      label: "Accommodatie bevestigd",
      status: acc.confirmed ? "PASS" : "FAIL",
      detail: acc.name || "geen accommodatie",
    },
    {
      label: "Chauffeurs bevestigd",
      status: transport.driversConfirmed ? "PASS" : "FAIL",
      detail: transport.driversConfirmed ? `${weekend.vehicles.length} auto(s)` : "chauffeur ontbreekt of gaat niet mee",
    },
    {
      label: "Passagiers ingedeeld",
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
          <h2 className="text-base font-bold tracking-tight text-navy">DRAAIBOEK</h2>
        </div>
        <button className="btn btn-sm no-print" onClick={() => window.print()}>
          Afdrukken
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* ---------------- Voortgang ---------------- */}
        <Card title="VOORTGANG" eyebrow="Alle secties" className="rise rise-1">
          <div className="flex items-center gap-3">
            <Gauge
              value={completion}
              size={84}
              stroke={8}
              tone={toneForPercent(completion)}
              suffix="%"
              label="afgerond"
            />
            <div className="min-w-0 flex-1">
              <StackedBar segments={statusSegments} height={12} />
              <div className="erp-mono mt-2 text-[11px] text-muted">
                {doneAll}/{weekend.checklist.length} {nl("done").toLowerCase()}
              </div>
            </div>
          </div>
        </Card>

        {/* ---------------- Automatische checks ---------------- */}
        <Card title="AUTOMATISCHE CHECKS" eyebrow="Live uit de engine — alleen-lezen" className="lg:col-span-2 rise rise-2">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>

      {SECTIONS.map((section, si) => {
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
            title={nl(section.key)}
            eyebrow={section.key === "access" ? "Toegang + checklist" : "Checklist"}
            actions={
              <span className="erp-mono text-[11px] text-muted">
                {sectionDone}/{items.length} {nl("done").toLowerCase()}
              </span>
            }
            padded={false}
            className={`rise rise-${Math.min(6, si + 3)}`}
          >
            <div className="px-4 pt-2">
              <Progress value={sectionPct} tone={toneForPercent(sectionPct)} />
              {section.note && <div className="mt-2 text-[11px] leading-snug text-faint">{section.note}</div>}
            </div>

            {section.key === "access" && (
              <div className="px-4 pt-3">
                <AccessLine label="Accommodatie" value={acc.name ? `${acc.name}${acc.address ? `, ${acc.address}` : ""}` : ""} />
                <AccessLine label="Toegangscode" value={acc.accessCode} />
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
                    <th className="min-w-[200px]">Regel</th>
                    <th className="w-[150px]">Eigenaar</th>
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
                            title={`Klik: ${nl("open")} → ${nl("inProgress")} → ${nl("done")}`}
                            aria-label={`Status ${item.label}: ${nl(item.status)}`}
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
                            <span className="erp-label mt-0.5 block">voorwaardelijk · alleen tonen indien relevant</span>
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
                                Zet op {nl("T-24H")}
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
                              TE LAAT · {formatDateTime(item.deadline ?? now)}
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
                        Geen regels in deze sectie.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="no-print flex flex-wrap items-end gap-2 border-t border-line px-4 py-3">
              <div className="w-[240px]">
                <span className="erp-label mb-1 block">Nieuwe regel</span>
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

      <Card title="DRAAIBOEK AFTEKENEN" eyebrow="Operationele gereedheid" className="rise rise-6">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={toneForPercent(completion)}>{completion}% afgerond</Badge>
          <span className="erp-mono text-[11.5px] text-muted">
            {doneAll} {nl("done").toLowerCase()} · {blockedAll} {nl("blocked").toLowerCase()} · {naAll} {nl("na").toLowerCase()}
          </span>
          <button
            className="btn btn-sm no-print"
            disabled={completion < 100}
            title={completion < 100 ? `Alle toepasselijke regels moeten op ${nl("done")} staan.` : undefined}
            onClick={() => logDecision("other", `Draaiboek afgetekend op ${formatDateTime(now)} (100% afgerond).`)}
          >
            Teken draaiboek af
          </button>
        </div>
      </Card>
    </div>
  );
}
