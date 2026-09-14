"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Callout, Card, PageHeader, StatusBadge } from "@/components/ui";
import { PhaseStepper, ScoreScale, StackedBar, type Segment } from "@/components/viz";
import { WEEKEND_PHASES } from "@/lib/types";
import { nl } from "@/lib/labels";

function Term({ term, abbr, children }: { term: string; abbr?: string; children: ReactNode }) {
  return (
    <div className="px-4 py-3">
      <dt className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-bold text-navy">{term}</span>
        {abbr && <span className="erp-mono text-[11.5px] text-faint">{abbr}</span>}
      </dt>
      <dd className="text-[13px] text-muted leading-snug mt-1 space-y-1.5">{children}</dd>
    </div>
  );
}

function Defs({ children }: { children: ReactNode }) {
  return <dl className="divide-y divide-line">{children}</dl>;
}

const SPLIT_LEVELS: { level: string; example: string; penalty: number }[] = [
  { level: "LOW", example: "Iedereen kan lopen.", penalty: 0 },
  { level: "MEDIUM", example: "Twee auto’s nodig, planning ligt vast.", penalty: 10 },
  { level: "HIGH", example: "Vier taxi’s nodig, niet gereserveerd.", penalty: 25 },
  { level: "CRITICAL", example: "Niemand weet hoe men terugkomt.", penalty: 45 },
];

const VIABILITY_FACTORS: { factor: string; max: number; rule: string }[] = [
  { factor: "BZT-venster", max: 30, rule: "≥4u = 30 · ≥3u = 24 · ≥2u = 16 · ≥1u = 8" },
  { factor: "Afstand", max: 20, rule: "≤10 min lopen = 20 · taxi nodig = 2" },
  { factor: "Groep samen", max: 15, rule: "Groepsgeschikt én capaciteit = 15" },
  { factor: "Transfers", max: 10, rule: "10 − 4 per verplaatsing" },
  { factor: "Sluitingstijd", max: 10, rule: "Na middernacht = 10 · vanaf 22:00 = 3" },
  { factor: "Reservering", max: 10, rule: "Bevestigd +10 · nodig maar niet bevestigd −10" },
  { factor: "Alternatief", max: 5, rule: "Fallback aanwezig = 5" },
];

const PATH_EXAMPLE: Segment[] = [
  { label: nl("valueAdding"), value: 90, tone: "navy" },
  { label: nl("bzt"), value: 120, tone: "go" },
  { label: nl("logistics"), value: 48, tone: "neutral" },
  { label: nl("waste"), value: 35, tone: "nogo" },
];

const DEADLINES: { key: string; label: string; requires: string }[] = [
  { key: "T-7D", label: "Zeven dagen voor vertrek", requires: "Deelnemers, slaapplaats" },
  { key: "T-72H", label: "Drie dagen voor vertrek", requires: "+ bedden, eten, avondlocatie, chauffeurs" },
  { key: "T-24H", label: "Eén dag voor vertrek", requires: "+ reserveringen, vervoer, stoelcapaciteit" },
  { key: "DEPARTURE", label: "Moment van vertrek", requires: "Alle blokkerende checks" },
];

export default function GlossaryPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Referentie"
        title="Begrippen"
        subtitle="De termen van dit systeem, met de rekenregel erachter."
      />

      <Callout tone="neutral" title="Let op">
        Een deel van deze termen is werkdefinitie van deze applicatie, geen officiële volleybalterminologie.
      </Callout>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <Card eyebrow="Kernbegrippen" title="Meeteenheden" padded={false} className="rise rise-1">
          <Defs>
            <Term term="BZT" abbr="Bier Zuip Tijd">
              <p>
                Van EERSTE BIER tot sluiting van de primaire avondlocatie, gecorrigeerd voor het
                groepssplitsingsrisico.
              </p>
              <p className="text-faint">Netto = bruto − (bruto × splitsingsfactor).</p>
            </Term>
            <Term term="Bob-risico-index" abbr="0–100">
              <p>
                Ludieke KPI uit echte planningdata. Basis 35; geen bed, geen reservering en last-minute wijzigingen
                verhogen, een bevestigd hotel en een kroeg op loopafstand verlagen.
              </p>
              <p className="flex flex-wrap gap-1.5">
                {["NEGLIGIBLE", "MODERATE", "ELEVATED", "SEVERE", "CATASTROPHIC"].map((lvl) => (
                  <StatusBadge key={lvl} status={lvl} />
                ))}
              </p>
              <p className="text-faint">&lt;25 · 25–49 · 50–69 · 70–89 · ≥90</p>
              <p className="text-nogo font-semibold">Telt nooit mee in GO / NO GO.</p>
              <p className="text-faint italic">&ldquo;Eén Bob is genoeg.&rdquo;</p>
            </Term>
            <Term term="Bob-aanlooptijd">
              <p>
                Uren tussen definitief plan en vertrek: &lt;24u &ldquo;Extreem kort&rdquo;, &lt;72u &ldquo;Kort&rdquo;,
                &lt;168u &ldquo;Acceptabel&rdquo;, daarboven &ldquo;Ruim&rdquo;. Korter = meer last-minute besluiten en
                minder BZT.
              </p>
            </Term>
            <Term term="Operationele kwaliteit" abbr="0–100">
              <p>
                Kwaliteit van het <em>proces</em>. Start op 100, met aftrek voor last-minute besluiten, open punten bij
                vertrek, onnodige reistijd, wachten, splitsingen, reserverings- en vervoersproblemen, BZT-verlies en
                overrides.
              </p>
            </Term>
            <Term term="Weekendbeleving" abbr="0–10">
              <p>
                Gewogen gemiddelde van gezelligheid (×2), gerealiseerde BZT (×1,5), locatie, avond (×1,5),
                accommodatie, activiteit en algemeen (×2).
              </p>
              <p className="font-semibold text-navy">
                De twee assen zijn onafhankelijk: goede uitkomst bij zwak proces is geluk, geen sturing.
              </p>
            </Term>
          </Defs>
        </Card>

        <Card eyebrow="Besturing" title="Poort, fases en deadlines" padded={false} className="rise rise-2">
          <div className="px-4 pt-4">
            <PhaseStepper phases={WEEKEND_PHASES} current="LOCKED" labels={nl} />
          </div>
          <Defs>
            <Term term="Gereedheidspoort">
              <p>
                Punten per check: {nl("PASS")} = 1, {nl("WARNING")} = 0,5, {nl("FAIL")} en {nl("UNKNOWN")} = 0. Het
                percentage is het gemiddelde.
              </p>
              <p>
                <StatusBadge status="GO" /> alles blokkerend op {nl("PASS")} én ≥ 80%.{" "}
                <StatusBadge status="NO GO" /> drie of meer {nl("FAIL")}, of &lt; 24 uur tot vertrek met blokkades.{" "}
                <StatusBadge status="CONDITIONAL GO" /> al het overige.
              </p>
            </Term>
            <Term term="Fases">
              <p>
                {nl("DRAFT")} is een leeg dossier, {nl("PLANNING")} het werkende weekend, {nl("READY")} voldoet aan de
                poort, {nl("LOCKED")} is vastgezet, {nl("LIVE")} loopt en {nl("COMPLETED")} heeft een terugblik.
              </p>
            </Term>
            <Term term="Deelnemersaantal vergrendelen">
              <p>
                Tot dat moment is elke reservering een gok: reserveren op een onbekend aantal veroorzaakt
                capaciteitsconflicten.
              </p>
            </Term>
            <Term term="Capaciteitsconflict">
              <p>
                Gereserveerde capaciteit kleiner dan het bevestigde aantal: te weinig stoelen, bedden of plek. Meer dan
                twee te veel heet {nl("OVERBOOKED")}.
              </p>
            </Term>
          </Defs>
          <div className="px-4 pb-4">
            <div className="erp-label mb-1.5">Deadlines</div>
            <div className="overflow-x-auto">
              <table className="erp">
                <thead>
                  <tr>
                    <th>Deadline</th>
                    <th>Moment</th>
                    <th>Moet {nl("PASS")} zijn</th>
                  </tr>
                </thead>
                <tbody>
                  {DEADLINES.map((d) => (
                    <tr key={d.key}>
                      <td className="erp-mono font-semibold text-navy whitespace-nowrap">{nl(d.key)}</td>
                      <td className="whitespace-nowrap text-[12px]">{d.label}</td>
                      <td className="text-[12px] text-muted">{d.requires}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11.5px] text-faint mt-1.5">
              Status per deadline: {nl("OK")}, {nl("MISSED")}, {nl("AT RISK")} (binnen 48 uur) of {nl("UPCOMING")}.
            </p>
          </div>
        </Card>
      </div>

      <Card eyebrow="Avondprogramma" title="Groepssplitsingsrisico" className="rise rise-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
          {SPLIT_LEVELS.map((s) => (
            <div key={s.level}>
              <div className="flex items-center gap-2">
                <StatusBadge status={s.level} />
                <span className="text-[12.5px] text-muted flex-1 min-w-0">{s.example}</span>
                <span className="erp-mono text-[12px] font-semibold text-nogo shrink-0">−{s.penalty}%</span>
              </div>
              <ScoreScale
                value={s.penalty}
                max={45}
                ticks={3}
                tone={s.penalty === 0 ? "go" : s.penalty <= 10 ? "warn" : "nogo"}
                height={7}
              />
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted mt-3">
          Extra verzwaring: drie of meer transfers op één avond, of een locatie die de hele groep niet aankan. De
          aftrek gaat rechtstreeks van de BZT af.
        </p>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <Card eyebrow="Scoring" title="Haalbaarheid avondlocatie" className="rise rise-4">
          <div className="space-y-2">
            {VIABILITY_FACTORS.map((f) => (
              <div key={f.factor}>
                <div className="flex items-baseline gap-2 text-[12.5px]">
                  <span className="font-semibold text-navy w-[108px] shrink-0">{f.factor}</span>
                  <span className="erp-mono text-[11.5px] text-faint">max {f.max}</span>
                  <span className="text-muted text-[11.5px] truncate min-w-0">{f.rule}</span>
                </div>
                <div className="h-2 rounded-full bg-sunken overflow-hidden mt-0.5">
                  <div
                    className="h-full bg-cobalt viz-grow-x rounded-full"
                    style={{ width: `${(f.max / 30) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="text-[12px] text-muted mt-3">
            Taxi nodig maar niet geregeld: −10. Eindscore 0–100 → {nl("EXCELLENT")} ≥85, {nl("GOOD")} ≥70,{" "}
            {nl("MARGINAL")} ≥50, {nl("POOR")} ≥30, daaronder {nl("UNVIABLE")}. Dichtbij maar vroeg dicht blijft een
            korte avond.
          </p>
        </Card>

        <Card eyebrow="Planning" title="Kritiek Bierpad" className="rise rise-5">
          <div className="erp-label mb-1.5">Voorbeeldavond in minuten</div>
          <StackedBar segments={PATH_EXAMPLE} height={18} formatValue={(v) => `${v} min`} />
          <dl className="mt-3 space-y-1.5 text-[12.5px]">
            <div>
              <dt className="font-bold text-navy inline">{nl("valueAdding")} — </dt>
              <dd className="text-muted inline">draagt direct bij: eten, activiteit, samen zijn.</dd>
            </div>
            <div>
              <dt className="font-bold text-navy inline">{nl("bzt")} — </dt>
              <dd className="text-muted inline">het team zit samen met een biertje; de eerste stap is EERSTE BIER.</dd>
            </div>
            <div>
              <dt className="font-bold text-navy inline">{nl("logistics")} — </dt>
              <dd className="text-muted inline">douchen, rijden, inchecken, lopen: minimaliseren, niet schrappen.</dd>
            </div>
            <div>
              <dt className="font-bold text-navy inline">{nl("waste")} — </dt>
              <dd className="text-muted inline">wachten op achterblijvers, ter plaatse bedenken wat je eet.</dd>
            </div>
          </dl>
          <div className="mt-3 pt-3 border-t border-line">
            <div className="erp-label mb-1">Effectieve stoelcapaciteit</div>
            <p className="text-[12.5px] text-muted">
              min(beschikbare, nominale) stoelen − bagagepenalty, exclusief de chauffeur.
            </p>
            <div className="overflow-x-auto mt-1.5">
              <table className="erp">
                <thead>
                  <tr>
                    <th>Bagageruimte</th>
                    <th className="text-right">Lading {nl("low")}</th>
                    <th className="text-right">{nl("medium")}</th>
                    <th className="text-right">{nl("high")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr><td>{nl("small")}</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">−1</td><td className="text-right erp-mono text-nogo">−2</td></tr>
                  <tr><td>{nl("medium")}</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">−1</td></tr>
                  <tr><td>{nl("large")}</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">0</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      </div>

      <div className="card px-4 py-3 flex flex-wrap items-center gap-3 rise rise-6">
        <span className="text-[13px] text-muted">Zien hoe dit op een echte casus uitpakt?</span>
        <Link href="/history" className="btn btn-sm">Geleerde lessen</Link>
        <Link href="/" className="btn btn-sm">Controlekamer</Link>
      </div>
    </div>
  );
}
