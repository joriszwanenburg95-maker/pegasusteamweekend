"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus } from "lucide-react";
import { blankWeekend } from "@/data/seed";
import { newId, useStore } from "@/store/store";
import type { Weekend } from "@/lib/types";
import {
  bobRiskIndex,
  evaluateReadiness,
  formatDate,
  formatDateTime,
  hoursBetween,
} from "@/lib/engine";
import {
  Card,
  DateTimeInput,
  EmptyState,
  Field,
  PageHeader,
  PhaseBadge,
  Progress,
  StatusBadge,
  TextInput,
  toneForPercent,
} from "@/components/ui";

/** Aankomend eerst (oplopend), daarna verleden aflopend. */
function sortWeekends(weekends: Weekend[], nowIso: string): Weekend[] {
  const upcoming = weekends
    .filter((w) => hoursBetween(nowIso, w.departureAt) >= 0)
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt));
  const past = weekends
    .filter((w) => hoursBetween(nowIso, w.departureAt) < 0)
    .sort((a, b) => b.departureAt.localeCompare(a.departureAt));
  return [...upcoming, ...past];
}

export default function WeekendsPage() {
  const { state, now, dispatch } = useStore();
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [departureAt, setDepartureAt] = useState("");

  const rows = sortWeekends(state.weekends, now);
  const canCreate = name.trim().length > 0 && departureAt !== "";

  function create() {
    if (!canCreate) return;
    const weekend = blankWeekend(newId("w"), name.trim(), departureAt);
    dispatch({ type: "upsertWeekend", weekend });
    setName("");
    setDepartureAt("");
    setFormOpen(false);
    router.push(`/weekends/${weekend.slug}`);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Portfolio"
        title="Weekends"
        subtitle="Alle teamweekenden in het systeem — aankomend bovenaan, historie daaronder."
        actions={
          <button className="btn btn-primary" onClick={() => setFormOpen((v) => !v)}>
            <Plus size={14} /> Nieuw weekend
          </button>
        }
      />

      {formOpen && (
        <Card eyebrow="Intake" title="Nieuw weekend registreren">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Naam" hint="Bijv. “Teamweekend 14 maart 2027”">
                <TextInput value={name} onChange={setName} placeholder="Teamweekend …" />
              </Field>
              <Field label="Departure" hint="Vertrek uit Nijmegen; bepaalt alle deadlines.">
                <DateTimeInput value={departureAt} onChange={setDepartureAt} />
              </Field>
            </div>
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={create} disabled={!canCreate}>
                Aanmaken
              </button>
              <button className="btn" onClick={() => setFormOpen(false)}>
                Annuleren
              </button>
            </div>
          </div>
          <p className="text-[11.5px] text-faint mt-2">
            Het weekend start in fase DRAFT met een lege roster-attendance. Alle overige velden vul je in op de
            weekend-tabs.
          </p>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Geen weekends">Registreer een weekend om de readiness gate te starten.</EmptyState>
      ) : (
        <>
          {/* Tabel vanaf md */}
          <Card padded={false} className="hidden md:block">
            <div className="overflow-x-auto">
              <table className="erp">
                <thead>
                  <tr>
                    <th>Weekend</th>
                    <th>Seizoen</th>
                    <th>Stad</th>
                    <th>Vertrek → terug</th>
                    <th>Fase</th>
                    <th>Gate</th>
                    <th className="text-right">Readiness</th>
                    <th className="text-right">Bob</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((w) => {
                    const r = evaluateReadiness(w, now);
                    const bob = bobRiskIndex(w, now);
                    return (
                      <tr key={w.id}>
                        <td className="font-semibold text-navy whitespace-nowrap">
                          <Link href={`/weekends/${w.slug}`} className="hover:underline">
                            {w.name}
                          </Link>
                        </td>
                        <td className="erp-mono whitespace-nowrap">{w.season}</td>
                        <td className="whitespace-nowrap">{w.city || <span className="text-faint">n.t.b.</span>}</td>
                        <td className="erp-mono text-[11.5px] whitespace-nowrap">
                          {formatDate(w.departureAt)} → {formatDate(w.returnAt)}
                        </td>
                        <td><PhaseBadge phase={w.phase} /></td>
                        <td><StatusBadge status={r.gate} /></td>
                        <td className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="erp-mono">{r.percent}%</span>
                            <Progress value={r.percent} tone={toneForPercent(r.percent)} className="w-16" />
                          </div>
                        </td>
                        <td className="text-right erp-mono" title={bob.tooltip}>{bob.score}</td>
                        <td className="text-right">
                          <Link href={`/weekends/${w.slug}`} className="btn btn-sm">Open</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Kaarten op mobiel */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {rows.map((w) => {
              const r = evaluateReadiness(w, now);
              const bob = bobRiskIndex(w, now);
              return (
                <Link key={w.id} href={`/weekends/${w.slug}`} className="card px-4 py-3 block">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-navy text-sm">{w.name}</span>
                    <span className="ml-auto flex gap-1">
                      <PhaseBadge phase={w.phase} />
                      <StatusBadge status={r.gate} />
                    </span>
                  </div>
                  <div className="erp-mono text-[11.5px] text-muted mt-1">
                    {w.season} · {w.city || "n.t.b."} · {formatDateTime(w.departureAt)}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={r.percent} tone={toneForPercent(r.percent)} />
                    <span className="erp-mono text-[12px] shrink-0">{r.percent}%</span>
                    <span className="erp-mono text-[12px] text-faint shrink-0" title={bob.tooltip}>
                      BOB {bob.score}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
