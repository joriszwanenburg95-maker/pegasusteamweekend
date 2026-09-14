"use client";

import { useState } from "react";
import { ArrowDown, ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { newId } from "@/store/store";
import { useCurrentWeekend } from "@/store/useCurrentWeekend";
import type { PathCategory, PathStep } from "@/lib/types";
import {
  analyzeCriticalPath,
  CATEGORY_LABEL,
  estimateBzt,
  formatDuration,
  isoToClock,
  primaryNightlife,
} from "@/lib/engine";
import {
  Badge,
  Card,
  Checkbox,
  EmptyState,
  Kpi,
  NumberInput,
  Select,
  TextInput,
  type Tone,
} from "@/components/ui";

const CATEGORY_OPTIONS: { value: PathCategory; label: string }[] = (
  Object.keys(CATEGORY_LABEL) as PathCategory[]
).map((c) => ({ value: c, label: CATEGORY_LABEL[c] }));

function toneForCategory(c: PathCategory): Tone {
  switch (c) {
    case "bzt":
      return "go";
    case "waste":
      return "nogo";
    case "valueAdding":
      return "navy";
    default:
      return "unknown";
  }
}

/** Randkleur van een node, per categorie. */
const NODE_BORDER: Record<PathCategory, string> = {
  valueAdding: "border-cobalt",
  bzt: "border-go",
  logistics: "border-line-strong",
  waste: "border-nogo",
};

export default function CriticalPathPage() {
  const { weekend, patch } = useCurrentWeekend();
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  if (!weekend) return null;

  const analysis = analyzeCriticalPath(weekend);
  const bzt = estimateBzt(weekend);
  const primary = primaryNightlife(weekend);
  const firstBeerId = analysis.steps.find((s) => s.category === "bzt")?.id ?? null;

  const skippedIds = Object.entries(skipped)
    .filter(([, on]) => on)
    .map(([id]) => id);
  const simulated =
    skippedIds.length > 0
      ? analyzeCriticalPath({
          ...weekend,
          criticalPath: weekend.criticalPath.filter((s) => !skippedIds.includes(s.id)),
        })
      : null;
  const simulatedSaving =
    simulated && analysis.minutesToFirstBeer !== null && simulated.minutesToFirstBeer !== null
      ? analysis.minutesToFirstBeer - simulated.minutesToFirstBeer
      : null;

  const updateStep = (id: string, changes: Partial<PathStep>) =>
    patch((w) => ({
      ...w,
      criticalPath: w.criticalPath.map((s) => (s.id === id ? { ...s, ...changes } : s)),
    }));

  const moveStep = (index: number, delta: number) =>
    patch((w) => {
      const next = [...w.criticalPath];
      const target = index + delta;
      if (target < 0 || target >= next.length) return w;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...w, criticalPath: next };
    });

  const removeStep = (step: PathStep) => {
    if (!window.confirm(`Stap “${step.label}” verwijderen?`)) return;
    patch((w) => ({ ...w, criticalPath: w.criticalPath.filter((s) => s.id !== step.id) }));
  };

  const addStep = () =>
    patch((w) => ({
      ...w,
      criticalPath: [
        ...w.criticalPath,
        {
          id: newId("s"),
          label: "NIEUWE STAP",
          durationMin: 10,
          category: "logistics",
          optional: true,
          isTransfer: false,
          optimizationHint: "",
        },
      ],
    }));

  /** Altijd getoonde, afgeleide hints naast de engine-optimalisaties. */
  const derivedHints: string[] = [];
  if (weekend.dinner.known && !weekend.dinner.beerCanStartHere)
    derivedHints.push(
      "Moving dinner to a venue where the beer moment can start saves one transfer.",
    );
  if (primary?.taxiRequired)
    derivedHints.push("Taxi to another city costs an estimated 90 minutes of team BZT.");

  const firstStepLabel = weekend.match.hasMatch ? "MATCH END" : "ARRIVAL";

  return (
    <div className="space-y-5">
      {/* KPIs ------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi
          label="Minutes to first beer"
          value={
            analysis.minutesToFirstBeer === null
              ? "—"
              : formatDuration(analysis.minutesToFirstBeer)
          }
          tone={
            analysis.minutesToFirstBeer === null
              ? "nogo"
              : analysis.minutesToFirstBeer <= 120
                ? "go"
                : analysis.minutesToFirstBeer <= 210
                  ? "warn"
                  : "nogo"
          }
          sub={
            analysis.firstBeerAt
              ? `FIRST BEER om ${isoToClock(analysis.firstBeerAt)} · pad start bij ${firstStepLabel}`
              : "Geen BZT-stap op het critical path"
          }
        />
        <Kpi
          label="Total path"
          value={formatDuration(analysis.totalMin)}
          sub={`${analysis.steps.length} stappen vanaf ${firstStepLabel}`}
        />
        <Kpi
          label="BZT netto"
          value={formatDuration(bzt.netMin)}
          tone={bzt.netMin > 0 ? "go" : "nogo"}
          sub={
            bzt.splitPenaltyMin > 0
              ? `−${formatDuration(bzt.splitPenaltyMin)} door Group Split Risk`
              : "Geen splitsingsaftrek"
          }
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {(Object.keys(CATEGORY_LABEL) as PathCategory[]).map((c) => (
          <Kpi
            key={c}
            label={CATEGORY_LABEL[c]}
            value={formatDuration(analysis.byCategory[c])}
            tone={c === "bzt" ? "go" : c === "waste" ? "nogo" : undefined}
            sub={`${Math.round(
              analysis.totalMin > 0 ? (analysis.byCategory[c] / analysis.totalMin) * 100 : 0,
            )}% van het pad`}
          />
        ))}
        <Kpi
          label="Transfers"
          value={analysis.transfers}
          tone={analysis.transfers >= 3 ? "nogo" : analysis.transfers >= 2 ? "warn" : "go"}
          sub="Verplaatsingen op het pad"
        />
      </div>

      {/* FLOW ------------------------------------------------------------ */}
      <Card eyebrow="Critical drinking path" title="Van wedstrijdeinde tot eerste bier">
        {analysis.steps.length === 0 ? (
          <EmptyState title="Geen stappen op het critical path">
            Voeg stappen toe in de editor hieronder om het pad door te rekenen.
          </EmptyState>
        ) : (
          <ol className="space-y-0">
            {analysis.steps.map((s, i) => {
              const isFirstBeer = s.id === firstBeerId;
              const isSkipped = !!skipped[s.id];
              return (
                <li key={s.id}>
                  <div
                    className={`rounded-[6px] border-l-4 border border-line ${NODE_BORDER[s.category]} bg-elev px-3 py-2.5 ${
                      isFirstBeer ? "bg-go-bg" : ""
                    } ${isSkipped ? "opacity-45" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="erp-mono text-sm font-semibold text-navy uppercase">
                          {s.label}
                        </span>
                        <Badge tone={toneForCategory(s.category)}>
                          {CATEGORY_LABEL[s.category]}
                        </Badge>
                        {isFirstBeer && <Badge tone="go">First beer {isoToClock(s.startAt)}</Badge>}
                        {s.isTransfer && <Badge tone="neutral">Transfer</Badge>}
                        {s.optional && <Badge tone="warn">Optioneel</Badge>}
                      </div>
                      <div className="erp-mono text-[12px] text-muted whitespace-nowrap">
                        {isoToClock(s.startAt)} → {isoToClock(s.endAt)} ·{" "}
                        {formatDuration(s.durationMin)}
                      </div>
                    </div>
                    {s.optional && (
                      <div className="mt-1.5 pt-1.5 border-t border-line">
                        <Checkbox
                          checked={isSkipped}
                          onChange={(v) => setSkipped((prev) => ({ ...prev, [s.id]: v }))}
                          label="What if: deze stap overslaan (simulatie, niet opgeslagen)"
                        />
                      </div>
                    )}
                  </div>
                  {i < analysis.steps.length - 1 && (
                    <div className="flex items-center gap-1.5 pl-4 py-1 text-faint">
                      <span className="block w-px h-4 bg-line-strong" />
                      <ArrowDown size={13} />
                      <span className="erp-mono text-[11px]">
                        {analysis.steps[i + 1].durationMin}m
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}

        {simulated && (
          <div className="mt-3 rounded-[6px] border border-cobalt/40 bg-sunken px-3 py-2.5">
            <div className="erp-label">Simulatie · {skippedIds.length} stap(pen) overgeslagen</div>
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-1">
              <span className="erp-mono text-lg font-semibold text-navy">
                First beer{" "}
                {simulated.firstBeerAt ? isoToClock(simulated.firstBeerAt) : "—"}
              </span>
              <span className="erp-mono text-[12.5px] text-muted">
                was {analysis.firstBeerAt ? isoToClock(analysis.firstBeerAt) : "—"}
              </span>
              {simulatedSaving !== null && simulatedSaving > 0 && (
                <span className="erp-mono text-[12.5px] font-semibold text-go">
                  −{formatDuration(simulatedSaving)} tot het eerste bier
                </span>
              )}
              <span className="erp-mono text-[12.5px] text-muted">
                Totaal pad {formatDuration(simulated.totalMin)} (was{" "}
                {formatDuration(analysis.totalMin)})
              </span>
            </div>
            <button className="btn btn-sm mt-2" onClick={() => setSkipped({})}>
              Simulatie resetten
            </button>
          </div>
        )}
      </Card>

      {/* OPTIMIZATIONS --------------------------------------------------- */}
      <Card eyebrow="Optimizations" title="Waar zit de tijd die niemand wil" padded={false}>
        {analysis.optimizations.length === 0 && derivedHints.length === 0 ? (
          <div className="px-4 py-5 text-sm text-muted">
            Geen optionele stappen of waste op het pad: er valt niets te schrappen.
          </div>
        ) : (
          <div className="divide-y divide-line">
            {analysis.optimizations.map((o) => (
              <div key={o.stepId} className="px-4 py-2.5 flex flex-wrap items-start gap-3">
                <span className="erp-mono text-sm font-semibold text-go whitespace-nowrap w-[72px]">
                  −{o.savesMin}m
                </span>
                <div className="min-w-0 flex-1">
                  <div className="erp-mono text-[12.5px] font-semibold text-navy uppercase">
                    {o.label}
                  </div>
                  <div className="text-[12.5px] text-muted leading-snug">{o.detail}</div>
                </div>
              </div>
            ))}
            {derivedHints.map((h) => (
              <div key={h} className="px-4 py-2.5 flex flex-wrap items-start gap-3">
                <span className="erp-mono text-[11px] font-semibold text-faint whitespace-nowrap w-[72px] pt-0.5">
                  DERIVED
                </span>
                <div className="text-[12.5px] text-muted leading-snug min-w-0 flex-1">{h}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* EDITOR ---------------------------------------------------------- */}
      <Card
        eyebrow="Editor"
        title="Stappen op het critical path"
        padded={false}
        actions={
          <button className="btn btn-primary btn-sm" onClick={addStep}>
            <Plus size={13} /> Stap toevoegen
          </button>
        }
      >
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th className="w-[36px]">#</th>
                <th className="min-w-[180px]">Label</th>
                <th className="w-[90px]">Duur</th>
                <th className="min-w-[150px]">Categorie</th>
                <th className="w-[80px]">Optioneel</th>
                <th className="w-[80px]">Transfer</th>
                <th className="min-w-[220px]">Optimization hint</th>
                <th className="w-[110px]" />
              </tr>
            </thead>
            <tbody>
              {weekend.criticalPath.map((s, i) => (
                <tr key={s.id}>
                  <td className="erp-mono text-faint">{i + 1}</td>
                  <td>
                    <TextInput value={s.label} onChange={(v) => updateStep(s.id, { label: v })} />
                    {i === 0 && (
                      <span className="block text-[11px] text-faint mt-0.5">
                        Startpunt: {firstStepLabel}
                      </span>
                    )}
                  </td>
                  <td>
                    <NumberInput
                      value={s.durationMin}
                      onChange={(v) => updateStep(s.id, { durationMin: v })}
                    />
                  </td>
                  <td>
                    <Select
                      value={s.category}
                      onChange={(v) => updateStep(s.id, { category: v })}
                      options={CATEGORY_OPTIONS}
                    />
                  </td>
                  <td>
                    <Checkbox
                      checked={s.optional}
                      onChange={(v) => updateStep(s.id, { optional: v })}
                    />
                  </td>
                  <td>
                    <Checkbox
                      checked={!!s.isTransfer}
                      onChange={(v) => updateStep(s.id, { isTransfer: v })}
                    />
                  </td>
                  <td>
                    <TextInput
                      value={s.optimizationHint ?? ""}
                      onChange={(v) => updateStep(s.id, { optimizationHint: v })}
                    />
                  </td>
                  <td>
                    <div className="flex gap-1 justify-end">
                      <button
                        className="btn btn-sm"
                        onClick={() => moveStep(i, -1)}
                        disabled={i === 0}
                        aria-label="Stap omhoog"
                      >
                        <ChevronUp size={13} />
                      </button>
                      <button
                        className="btn btn-sm"
                        onClick={() => moveStep(i, 1)}
                        disabled={i === weekend.criticalPath.length - 1}
                        aria-label="Stap omlaag"
                      >
                        <ChevronDown size={13} />
                      </button>
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => removeStep(s)}
                        aria-label="Stap verwijderen"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
