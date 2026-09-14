"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
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
import { CountUp, Gauge, StackedBar, toneColor } from "@/components/viz";

const CATEGORIES = Object.keys(CATEGORY_LABEL) as PathCategory[];

const CATEGORY_OPTIONS: { value: PathCategory; label: string }[] = CATEGORIES.map((c) => ({
  value: c,
  label: CATEGORY_LABEL[c],
}));

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

export default function CriticalPathPage() {
  const { weekend, patch } = useCurrentWeekend();
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});

  if (!weekend) return null;

  const analysis = analyzeCriticalPath(weekend);
  const bzt = estimateBzt(weekend);
  const primary = primaryNightlife(weekend);
  const firstBeerId = analysis.steps.find((s) => s.category === "bzt")?.id ?? null;
  const longest = Math.max(1, ...analysis.steps.map((s) => s.durationMin));
  const bztShare =
    analysis.totalMin > 0 ? Math.round((analysis.byCategory.bzt / analysis.totalMin) * 100) : 0;

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
      "Eten op een locatie waar het biermoment kan starten schrapt één verplaatsing.",
    );
  if (primary?.taxiRequired)
    derivedHints.push("Een taxi naar een andere stad kost naar schatting 90 minuten team-BZT.");

  const firstStepLabel = weekend.match.hasMatch ? "EINDE WEDSTRIJD" : "AANKOMST";

  return (
    <div className="space-y-5">
      {/* KPI’S ------------------------------------------------------------ */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Kpi
          label="Tijd tot eerste bier"
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
              ? `EERSTE BIER om ${isoToClock(analysis.firstBeerAt)} · pad start bij ${firstStepLabel}`
              : "Geen BZT-stap op het kritieke pad"
          }
          className="rise rise-1"
        />
        <Kpi
          label="Totale doorlooptijd"
          value={formatDuration(analysis.totalMin)}
          sub={`${analysis.steps.length} stappen vanaf ${firstStepLabel}`}
          className="rise rise-1"
        />
        <Kpi
          label="BZT netto"
          value={formatDuration(bzt.netMin)}
          tone={bzt.netMin > 0 ? "go" : "nogo"}
          sub={
            bzt.splitPenaltyMin > 0
              ? `−${formatDuration(bzt.splitPenaltyMin)} door groepssplitsingsrisico`
              : "Geen splitsingsaftrek"
          }
          className="rise rise-2"
        />
      </div>

      {/* VERDELING -------------------------------------------------------- */}
      <Card eyebrow="Verdeling" title="Waar gaat de tijd heen?" className="rise rise-2">
        <div className="flex flex-wrap items-center gap-4">
          <Gauge
            value={bztShare}
            size={104}
            stroke={10}
            suffix="%"
            tone={bztShare >= 40 ? "go" : bztShare >= 20 ? "warn" : "nogo"}
            label="BZT-aandeel"
          />
          <div className="min-w-[220px] flex-1">
            <StackedBar
              height={18}
              segments={CATEGORIES.map((c) => ({
                label: CATEGORY_LABEL[c],
                value: analysis.byCategory[c],
                tone: toneForCategory(c),
              }))}
              formatValue={(v) => formatDuration(v)}
            />
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((c) => (
                <div key={c} className="rounded-[4px] border border-line px-2 py-1.5">
                  <div className="erp-label truncate" title={CATEGORY_LABEL[c]}>
                    {CATEGORY_LABEL[c]}
                  </div>
                  <div className="erp-mono text-[13px] font-semibold text-navy">
                    {formatDuration(analysis.byCategory[c])}
                    <span className="text-faint text-[11px] ml-1">
                      {Math.round(
                        analysis.totalMin > 0
                          ? (analysis.byCategory[c] / analysis.totalMin) * 100
                          : 0,
                      )}
                      %
                    </span>
                  </div>
                </div>
              ))}
              <div className="rounded-[4px] border border-line px-2 py-1.5">
                <div className="erp-label">Verplaatsingen</div>
                <div
                  className={`erp-mono text-[13px] font-semibold ${
                    analysis.transfers >= 3
                      ? "text-nogo"
                      : analysis.transfers >= 2
                        ? "text-warn"
                        : "text-go"
                  }`}
                >
                  <CountUp value={analysis.transfers} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* TIJDLIJN --------------------------------------------------------- */}
      <Card eyebrow="Kritiek Bierpad" title={`Van ${firstStepLabel.toLowerCase()} tot eerste bier`} className="rise rise-3">
        {analysis.steps.length === 0 ? (
          <EmptyState title="Geen stappen op het kritieke pad">
            Voeg stappen toe in de tabel hieronder om het pad door te rekenen.
          </EmptyState>
        ) : (
          <ol className="relative pl-7">
            <span className="absolute left-[10px] top-2 bottom-2 w-[2px] bg-line" aria-hidden />
            {analysis.steps.map((s) => {
              const isFirstBeer = s.id === firstBeerId;
              const isSkipped = !!skipped[s.id];
              const color = toneColor(toneForCategory(s.category));
              const width = `${Math.max(8, (s.durationMin / longest) * 100)}%`;
              return (
                <li key={s.id} className="relative pb-2.5">
                  <span
                    className={`absolute -left-6 top-[9px] w-3.5 h-3.5 rounded-full border-[3px] bg-elev ${
                      isFirstBeer ? "viz-pulse" : ""
                    }`}
                    style={{ borderColor: color }}
                    aria-hidden
                  />
                  <div
                    className={`rounded-[6px] border border-line bg-elev px-3 py-2 ${
                      isFirstBeer ? "bg-go-bg border-go/40" : ""
                    } ${isSkipped ? "opacity-45" : ""}`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
                      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <span className="erp-mono text-[13px] font-semibold text-navy uppercase">
                          {s.label}
                        </span>
                        {isFirstBeer && <Badge tone="go">EERSTE BIER {isoToClock(s.startAt)}</Badge>}
                        {s.isTransfer && <Badge tone="neutral">Verplaatsing</Badge>}
                        {s.optional && <Badge tone="warn">Optioneel</Badge>}
                      </div>
                      <div className="erp-mono text-[11.5px] text-muted whitespace-nowrap">
                        {isoToClock(s.startAt)} → {isoToClock(s.endAt)}
                      </div>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-2.5 rounded-sm bg-sunken flex-1 overflow-hidden">
                        <div
                          className="h-full rounded-sm viz-grow-x"
                          style={{ width, background: color }}
                          title={`${CATEGORY_LABEL[s.category]} · ${formatDuration(s.durationMin)}`}
                        />
                      </div>
                      <span className="erp-mono text-[11.5px] font-semibold text-navy w-[54px] text-right shrink-0">
                        {formatDuration(s.durationMin)}
                      </span>
                    </div>
                    {s.optional && (
                      <div className="mt-1.5 pt-1.5 border-t border-line">
                        <Checkbox
                          checked={isSkipped}
                          onChange={(v) => setSkipped((prev) => ({ ...prev, [s.id]: v }))}
                          label="Wat als: deze stap overslaan (simulatie, niet opgeslagen)"
                        />
                      </div>
                    )}
                  </div>
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
                Eerste bier {simulated.firstBeerAt ? isoToClock(simulated.firstBeerAt) : "—"}
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
              Simulatie herstellen
            </button>
          </div>
        )}
      </Card>

      {/* OPTIMALISATIES --------------------------------------------------- */}
      <Card
        eyebrow="Optimalisaties"
        title="Waar zit de tijd die niemand wil"
        padded={false}
        className="rise rise-4"
      >
        {analysis.optimizations.length === 0 && derivedHints.length === 0 ? (
          <div className="px-4 py-5 text-sm text-muted">
            Geen optionele stappen of verspilling op het pad: er valt niets te schrappen.
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
                  AFGELEID
                </span>
                <div className="text-[12.5px] text-muted leading-snug min-w-0 flex-1">{h}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* BEWERKEN --------------------------------------------------------- */}
      <Card
        eyebrow="Bewerken"
        title="Stappen op het kritieke pad"
        padded={false}
        className="rise rise-5"
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
                <th className="min-w-[180px]">Stap</th>
                <th className="w-[90px]">Duur</th>
                <th className="min-w-[150px]">Categorie</th>
                <th className="w-[80px]">Optioneel</th>
                <th className="w-[90px]">Verplaatsing</th>
                <th className="min-w-[220px]">Optimalisatiehint</th>
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
