"use client";

import { useMemo, useState } from "react";
import { Download, RotateCcw, Upload } from "lucide-react";
import { SEED_VERSION } from "@/data/seed";
import { useStore } from "@/store/store";
import type { AppState } from "@/lib/types";
import { formatDateTime } from "@/lib/engine";
import {
  Badge,
  Callout,
  Card,
  DateTimeInput,
  Field,
  PageHeader,
} from "@/components/ui";

interface BrandToken {
  token: string;
  hex: string;
  official: boolean;
  note: string;
}

const BRAND_TOKENS: BrandToken[] = [
  { token: "navy", hex: "#000d44", official: true, note: "custom-prussian-blue van pegasusvolleybal.com — koppen, nav, footer." },
  { token: "sky", hex: "#77aadf", official: true, note: "Accent lichtblauw van pegasusvolleybal.com — links en knoppen." },
  { token: "silver", hex: "#b5bdbc", official: true, note: "Logo-grijs (accent-5 op de clubsite)." },
  { token: "navy-2", hex: "#001a6e", official: false, note: "Fallback: verloop-partner van navy in dashboards." },
  { token: "cobalt", hex: "#0a3fb8", official: false, note: "Fallback: dominant cobalt blue voor primaire knoppen." },
  { token: "royal", hex: "#2563eb", official: false, note: "Fallback: royal blue voor focusstates." },
];

export default function SystemSettingsPage() {
  const { state, now, dispatch } = useStore();
  const exportJson = useMemo(() => JSON.stringify(state, null, 2), [state]);
  const [importText, setImportText] = useState("");
  const [message, setMessage] = useState<{ tone: "go" | "nogo"; text: string } | null>(null);

  function download() {
    const blob = new Blob([exportJson], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pegasus-teamweekend-export-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function runImport() {
    setMessage(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setMessage({ tone: "nogo", text: "Geen geldige JSON." });
      return;
    }
    if (typeof parsed !== "object" || parsed === null) {
      setMessage({ tone: "nogo", text: "JSON is geen object." });
      return;
    }
    const candidate = parsed as Partial<AppState>;
    if (typeof candidate.version !== "number") {
      setMessage({ tone: "nogo", text: "Veld “version” ontbreekt of is geen getal." });
      return;
    }
    if (candidate.version !== SEED_VERSION) {
      setMessage({
        tone: "nogo",
        text: `Versie ${candidate.version} komt niet overeen met de verwachte versie ${SEED_VERSION}.`,
      });
      return;
    }
    if (!Array.isArray(candidate.weekends)) {
      setMessage({ tone: "nogo", text: "Veld “weekends” ontbreekt of is geen array." });
      return;
    }
    const next: AppState = {
      version: candidate.version,
      weekends: candidate.weekends,
      clockOverride: typeof candidate.clockOverride === "string" ? candidate.clockOverride : null,
    };
    dispatch({ type: "hydrate", state: next });
    setImportText("");
    setMessage({ tone: "go", text: `Geïmporteerd: ${next.weekends.length} weekend(s).` });
  }

  function resetToSeed() {
    if (!window.confirm("Alle lokale wijzigingen worden verwijderd en vervangen door de seeddata. Doorgaan?")) return;
    dispatch({ type: "reset" });
    setMessage({ tone: "go", text: "Teruggezet naar seeddata." });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="System"
        title="Systeeminstellingen"
        subtitle="Simulatieklok, databeheer en colofon. Alles draait client-side; er is geen backend."
      />

      {message && (
        <Callout tone={message.tone} title={message.tone === "go" ? "Gelukt" : "Mislukt"}>
          {message.text}
        </Callout>
      )}

      <Card eyebrow="Simulation" title="Klok">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
          <div>
            <div className="erp-label">Huidige app-tijd</div>
            <div className="erp-mono text-lg font-semibold text-navy mt-1">{formatDateTime(now)}</div>
            <div className="mt-1">
              {state.clockOverride ? (
                <Badge tone="warn">SIMULATIE ACTIEF</Badge>
              ) : (
                <Badge tone="go">ECHTE KLOK</Badge>
              )}
            </div>
          </div>
          <Field label="Clock override" hint="Zet de app-tijd op een gekozen moment.">
            <DateTimeInput
              value={state.clockOverride ?? now}
              onChange={(iso) => dispatch({ type: "setClock", iso })}
            />
          </Field>
          <button
            className="btn"
            onClick={() => dispatch({ type: "setClock", iso: null })}
            disabled={!state.clockOverride}
          >
            <RotateCcw size={14} /> Terug naar echte klok
          </button>
        </div>
        <p className="text-[12px] text-muted mt-3 leading-snug">
          De simulatieklok raakt uitsluitend de tijdgebonden berekeningen: deadlines (T-7D, T-72H, T-24H, DEPARTURE),
          countdowns, de risk narrative en daarmee de gate-uitkomst. Opgeslagen gegevens, attendance, reserveringen en
          retrospectives veranderen er niet door.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <Card
          eyebrow="Data"
          title="Export"
          actions={
            <button className="btn btn-sm" onClick={download}>
              <Download size={13} /> Download JSON
            </button>
          }
        >
          <textarea
            className="input erp-mono text-[11px] h-48 resize-y"
            readOnly
            value={exportJson}
            spellCheck={false}
            aria-label="Export JSON"
          />
          <p className="text-[11.5px] text-faint mt-2">
            {state.weekends.length} weekend(s) · versie {state.version} · {Math.ceil(exportJson.length / 1024)} kB.
          </p>
        </Card>

        <Card
          eyebrow="Data"
          title="Import"
          actions={
            <button className="btn btn-sm btn-primary" onClick={runImport} disabled={importText.trim() === ""}>
              <Upload size={13} /> Importeer
            </button>
          }
        >
          <textarea
            className="input erp-mono text-[11px] h-48 resize-y"
            value={importText}
            spellCheck={false}
            placeholder='{"version": 1, "weekends": [...], "clockOverride": null}'
            aria-label="Import JSON"
            onChange={(e) => setImportText(e.target.value)}
          />
          <p className="text-[11.5px] text-faint mt-2">
            Gecontroleerd wordt of <span className="erp-mono">version</span> gelijk is aan {SEED_VERSION} en of{" "}
            <span className="erp-mono">weekends</span> een array is. De huidige staat wordt volledig vervangen.
          </p>
        </Card>
      </div>

      <Card eyebrow="Danger zone" title="Reset">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-danger" onClick={resetToSeed}>
            <RotateCcw size={14} /> Reset naar seed
          </button>
          <span className="text-[12px] text-muted">
            Vervangt alles door de meegeleverde seeddata (Maaseik + het planningsweekend). Niet terug te draaien.
          </span>
        </div>
      </Card>

      <Card eyebrow="Colofon" title="Brand tokens" padded={false}>
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th>Token</th>
                <th>Hex</th>
                <th>Herkomst</th>
                <th>Gebruik</th>
              </tr>
            </thead>
            <tbody>
              {BRAND_TOKENS.map((t) => (
                <tr key={t.token}>
                  <td className="whitespace-nowrap">
                    <span className="inline-flex items-center gap-2">
                      <span
                        className="inline-block w-4 h-4 rounded-[3px] border border-line-strong"
                        style={{ background: t.hex }}
                      />
                      <span className="erp-mono font-semibold text-navy">{t.token}</span>
                    </span>
                  </td>
                  <td className="erp-mono whitespace-nowrap">{t.hex}</td>
                  <td className="whitespace-nowrap">
                    {t.official ? <Badge tone="go">OFFICIEEL</Badge> : <Badge tone="unknown">FALLBACK</Badge>}
                  </td>
                  <td className="text-[12px] text-muted">{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-line text-[12px] text-muted space-y-1.5">
          <p>
            Officieel = overgenomen uit het thema van pegasusvolleybal.com. Fallback = niet-officiële ERP-tint, gekozen
            omdat de club er geen gepubliceerde hexcode voor heeft. Groen, amber en rood zijn statuskleuren, geen
            clubkleuren: groen uitsluitend voor GO/PASS, amber voor warnings, rood voor NO GO.
          </p>
          <p>
            Typografie: Poppins (clubsite) voor tekst, JetBrains Mono voor cijfers en codes.
          </p>
        </div>
      </Card>

      <Callout tone="neutral" title="Opslag">
        Alle gegevens staan uitsluitend in de localStorage van deze browser (sleutel{" "}
        <span className="erp-mono">pegasus-teamweekend-erp-v1</span>). Er is geen server, geen account en geen
        synchronisatie: een andere browser of een geleegde cache betekent een lege staat. Gebruik Export voor een
        back-up.
      </Callout>
    </div>
  );
}
