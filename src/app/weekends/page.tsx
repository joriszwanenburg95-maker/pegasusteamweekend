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
  hoursBetween,
} from "@/lib/engine";
import {
  Badge,
  Card,
  DateTimeInput,
  EmptyState,
  Field,
  PageHeader,
  PhaseBadge,
  StatusBadge,
  TextInput,
  toneForPercent,
  type Tone,
} from "@/components/ui";
import { Gauge } from "@/components/viz";
import { nl } from "@/lib/labels";

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

/** Hoger = risicovoller: de Bob-index draait de kleurschaal om. */
function toneForBob(score: number): Tone {
  if (score >= 70) return "nogo";
  if (score >= 25) return "warn";
  return "go";
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
        eyebrow="Portefeuille"
        title="Weekenden"
        subtitle="Alle teamweekenden — aankomend bovenaan, historie daaronder."
        actions={
          <button className="btn btn-primary" onClick={() => setFormOpen((v) => !v)}>
            <Plus size={14} /> Nieuw weekend
          </button>
        }
      />

      {formOpen && (
        <Card eyebrow="Aanmelden" title="Nieuw weekend registreren" className="rise rise-1">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Naam" hint="Bijv. “Teamweekend 14 maart 2027”">
                <TextInput value={name} onChange={setName} placeholder="Teamweekend …" />
              </Field>
              <Field label="Vertrek" hint="Vertrek uit Nijmegen; bepaalt alle deadlines.">
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
            Het weekend start in fase {nl("DRAFT")} met een lege deelnemerslijst. De rest vul je in op de tabbladen.
          </p>
        </Card>
      )}

      {rows.length === 0 ? (
        <EmptyState title="Geen weekenden">Registreer een weekend om de gereedheidspoort te starten.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {rows.map((w, i) => {
            const r = evaluateReadiness(w, now);
            const bob = bobRiskIndex(w, now);
            return (
              <Link
                key={w.id}
                href={`/weekends/${w.slug}`}
                className={`card card-hover px-4 py-3 block rise rise-${Math.min(i + 1, 6)}`}
              >
                <div className="flex items-start gap-3">
                  <Gauge
                    value={r.percent}
                    size={56}
                    stroke={6}
                    suffix="%"
                    tone={toneForPercent(r.percent)}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-navy text-sm leading-snug">{w.name}</div>
                    <div className="erp-mono text-[11.5px] text-muted mt-0.5">
                      {w.season} · {w.city || "n.t.b."}
                    </div>
                    <div className="erp-mono text-[11.5px] text-faint">
                      {formatDate(w.departureAt)} → {formatDate(w.returnAt)}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
                  <PhaseBadge phase={w.phase} />
                  <StatusBadge status={r.gate} />
                  <Badge tone={toneForBob(bob.score)} title={bob.tooltip} className="ml-auto">
                    BOB {bob.score}
                  </Badge>
                </div>
                {r.failCount > 0 && (
                  <div className="text-[11.5px] text-nogo font-semibold mt-1.5">
                    {r.failCount}× {nl("FAIL")} · {r.lockBlockers.length} blokkade(s)
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
