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
  { token: "navy", hex: "#000d44", official: true, note: "custom-prussian-blue van pegasusvolleybal.com — koppen, navigatie, voettekst." },
  { token: "sky", hex: "#77aadf", official: true, note: "Accent lichtblauw van pegasusvolleybal.com — links en knoppen." },
  { token: "silver", hex: "#b5bdbc", official: true, note: "Logo-grijs (accent-5 op de clubsite)." },
  { token: "navy-2", hex: "#001a6e", official: false, note: "Terugvaloptie: verloop-partner van navy in dashboards." },
  { token: "cobalt", hex: "#0a3fb8", official: false, note: "Terugvaloptie: dominant kobaltblauw voor primaire knoppen." },
  { token: "royal", hex: "#2563eb", official: false, note: "Terugvaloptie: koningsblauw voor focusstaten." },
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
    setMessage({ tone: "go", text: `Ingelezen: ${next.weekends.length} weekend(s).` });
  }

  function resetToSeed() {
    if (!window.confirm("Alle lokale wijzigingen worden verwijderd en vervangen door de startgegevens. Doorgaan?")) return;
    dispatch({ type: "reset" });
    setMessage({ tone: "go", text: "Teruggezet naar de startgegevens." });
  }

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Beheer"
        title="Systeem"
        subtitle="Simulatieklok, gegevensbeheer en colofon. Alles draait in de browser; er is geen server."
      />

      {message && (
        <Callout tone={message.tone} title={message.tone === "go" ? "Gelukt" : "Mislukt"}>
          {message.text}
        </Callout>
      )}

      <Card eyebrow="Simulatie" title="Klok" className="rise rise-1">
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
          <Field label="Afwijkende app-tijd" hint="Zet de app-tijd op een gekozen moment.">
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
          De simulatieklok raakt alleen tijdgebonden berekeningen: deadlines (T-7 dagen, T-72 uur, T-24 uur, vertrek),
          afteltijden, de risicotekst en daarmee de poortuitkomst. Opgeslagen gegevens veranderen er niet door.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <Card
          eyebrow="Gegevens"
          title="Exporteren"
          className="rise rise-2"
          actions={
            <button className="btn btn-sm" onClick={download}>
              <Download size={13} /> Bewaar JSON
            </button>
          }
        >
          <textarea
            className="input erp-mono text-[11px] h-48 resize-y"
            readOnly
            value={exportJson}
            spellCheck={false}
            aria-label="Uitvoer in JSON"
          />
          <p className="text-[11.5px] text-faint mt-2">
            {state.weekends.length} weekend(s) · versie {state.version} · {Math.ceil(exportJson.length / 1024)} kB.
          </p>
        </Card>

        <Card
          eyebrow="Gegevens"
          title="Inlezen"
          className="rise rise-3"
          actions={
            <button className="btn btn-sm btn-primary" onClick={runImport} disabled={importText.trim() === ""}>
              <Upload size={13} /> Inlezen
            </button>
          }
        >
          <textarea
            className="input erp-mono text-[11px] h-48 resize-y"
            value={importText}
            spellCheck={false}
            placeholder='{"version": 1, "weekends": [...], "clockOverride": null}'
            aria-label="Invoer in JSON"
            onChange={(e) => setImportText(e.target.value)}
          />
          <p className="text-[11.5px] text-faint mt-2">
            Gecontroleerd wordt of <span className="erp-mono">version</span> gelijk is aan {SEED_VERSION} en of{" "}
            <span className="erp-mono">weekends</span> een array is. De huidige staat wordt volledig vervangen.
          </p>
        </Card>
      </div>

      <Card eyebrow="Gevarenzone" title="Terugzetten" className="rise rise-4">
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn btn-danger" onClick={resetToSeed}>
            <RotateCcw size={14} /> Terug naar startgegevens
          </button>
          <span className="text-[12px] text-muted">
            Vervangt alles door de meegeleverde startgegevens (Maaseik + het planningsweekend). Niet terug te draaien.
          </span>
        </div>
      </Card>

      <Card eyebrow="Colofon" title="Merkkleuren" padded={false} className="rise rise-5">
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th>Naam</th>
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
                    {t.official ? <Badge tone="go">OFFICIEEL</Badge> : <Badge tone="unknown">TERUGVAL</Badge>}
                  </td>
                  <td className="text-[12px] text-muted">{t.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-line text-[12px] text-muted space-y-1.5">
          <p>
            Officieel = overgenomen van pegasusvolleybal.com. Terugval = niet-officiële tint, omdat de club er geen
            gepubliceerde hexcode voor heeft. Groen, amber en rood zijn statuskleuren, geen clubkleuren: groen alleen
            voor GO, amber voor waarschuwingen, rood voor NO GO.
          </p>
          <p>Typografie: Poppins voor tekst, JetBrains Mono voor cijfers en codes.</p>
        </div>
      </Card>

      <Callout tone="neutral" title="Opslag">
        Alle gegevens staan alleen in de localStorage van deze browser (sleutel{" "}
        <span className="erp-mono">pegasus-teamweekend-erp-v1</span>). Geen server, geen account, geen synchronisatie:
        een andere browser of een geleegde cache betekent een lege staat. Maak een reservekopie via Exporteren.
      </Callout>
    </div>
  );
}
