"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Callout, Card, PageHeader, StatusBadge } from "@/components/ui";

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

const SPLIT_LEVELS: { level: string; example: string }[] = [
  { level: "LOW", example: "Iedereen kan lopen." },
  { level: "MEDIUM", example: "Twee auto’s nodig, maar de planning ligt vast." },
  { level: "HIGH", example: "Vier taxi’s nodig, niet gereserveerd." },
  { level: "CRITICAL", example: "Niemand weet hoe men terugkomt." },
];

const VIABILITY_FACTORS: { factor: string; max: string; detail: string }[] = [
  {
    factor: "BZT-window",
    max: "max 30",
    detail:
      "Tijd tussen geschatte aankomst en sluiting: ≥4u = 30, ≥3u = 24, ≥2u = 16, ≥1u = 8, anders 0. Sluit de zaak vóór aankomst, dan telt het window als 0.",
  },
  {
    factor: "Afstand",
    max: "max 20",
    detail:
      "≤10 min lopen zonder vervoer = 20, ≤20 min = 15, verder lopend = 10, vervoer nodig zonder taxi = 6, taxi nodig = 2.",
  },
  { factor: "Transfers", max: "max 10", detail: "10 − 4 per verplaatsing heen en terug, minimaal 0." },
  {
    factor: "Sluitingstijd",
    max: "max 10",
    detail: "Sluit tussen 00:00 en 05:00 = 10, vanaf 23:00 = 6, vanaf 22:00 = 3, eerder = 0.",
  },
  {
    factor: "Groep samen",
    max: "max 15",
    detail:
      "Groepsgeschikt én capaciteit ≥ groepsgrootte = 15, alleen groepsgeschikt = 9, alleen capaciteit = 7, anders 0.",
  },
  {
    factor: "Reservering",
    max: "−10 tot 10",
    detail: "Bevestigd = +10, niet nodig = +8, nodig maar niet bevestigd = −10.",
  },
  { factor: "Alternatief", max: "max 5", detail: "Fallback aanwezig = 5." },
  { factor: "Taxi niet geregeld", max: "−10", detail: "Taxi nodig maar niet vooraf geregeld = extra aftrek van 10." },
];

const PATH_CATEGORIES: { key: string; label: string; detail: string }[] = [
  { key: "valueAdding", label: "VALUE ADDING", detail: "Draagt direct bij aan het weekend: eten, activiteit, samen zijn." },
  { key: "bzt", label: "BZT", detail: "De stap waarin het team daadwerkelijk gezamenlijk zit met een biertje. De eerste BZT-stap is FIRST BEER." },
  { key: "logistics", label: "NECESSARY LOGISTICS", detail: "Onvermijdelijk: douchen, rijden, inchecken, lopen. Wel te minimaliseren, niet te schrappen." },
  { key: "waste", label: "PURE WASTE", detail: "Tijd zonder waarde: wachten op achterblijvers, ter plaatse bedenken wat je eet, een vol restaurant alsnog zoeken." },
];

const DEADLINES: { key: string; label: string; requires: string }[] = [
  { key: "T-7D", label: "Zeven dagen voor vertrek", requires: "Attendance, Accommodation" },
  {
    key: "T-72H",
    label: "Drie dagen voor vertrek",
    requires: "Attendance, Accommodation, Beds, Dinner, Nightlife, Drivers",
  },
  {
    key: "T-24H",
    label: "Eén dag voor vertrek",
    requires:
      "Attendance, Accommodation, Beds, Dinner, Nightlife, Reservations, Transport, Drivers, Seat capacity",
  },
  { key: "DEPARTURE", label: "Moment van vertrek", requires: "Alle gating checks" },
];

export default function GlossaryPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow="Referentie"
        title="Glossary"
        subtitle="De begrippen die dit systeem gebruikt, met de exacte rekenregels erachter."
      />

      <Callout tone="neutral" title="Lees dit eerst">
        Een deel van deze begrippen is werkdefinitie van deze applicatie en geen officiële volleybalterminologie. Waar
        dat zo is, staat het er expliciet bij.
      </Callout>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <Card eyebrow="Kernbegrippen" title="Meeteenheden" padded={false}>
          <Defs>
            <Term term="BZT" abbr="Beschikbare Zuip Tijd">
              <p>
                De tijd waarin het team daadwerkelijk gezamenlijk kan zijn: van FIRST BEER tot het moment dat de
                primaire avondlocatie sluit, gecorrigeerd voor Group Split Risk.
              </p>
              <p className="text-faint">
                Werkdefinitie van deze applicatie. Netto BZT = bruto BZT − (bruto × splitsingsfactor). De factor is 0
                bij LOW, 0,10 bij MEDIUM, 0,25 bij HIGH en 0,45 bij CRITICAL.
              </p>
            </Term>
            <Term term="BOB / Bob Risk Index" abbr="0–100">
              <p>
                Ludieke secundaire KPI die uit echte planningdata een risicoscore afleidt: geen bed, geen reservering,
                taxi niet geregeld en last-minute wijzigingen verhogen de score; een bevestigd hotel, een gereserveerd
                diner en een kroeg op loopafstand verlagen hem. Basis 35.
              </p>
              <p>
                Niveaus: NEGLIGIBLE &lt;25, MODERATE 25–49, ELEVATED 50–69, SEVERE 70–89, CATASTROPHIC ≥90.
              </p>
              <p className="text-nogo font-semibold">
                Nooit gebruiken voor GO/NO GO. De gate beslist, de Bob Risk Index becommentarieert.
              </p>
              <p className="text-faint italic">“One Bob is enough.”</p>
            </Term>
            <Term term="BOB lead time">
              <p>
                Het aantal uren tussen het moment dat het plan definitief is en het moment van vertrek. Kwalificatie:
                &lt;24u “Extreem kort”, &lt;72u “Kort”, &lt;168u “Acceptabel”, daarboven “Ruim”. Zonder definitief plan:
                “Plan nog niet definitief”.
              </p>
              <p>Hoe korter de lead time, hoe groter de kans dat besluiten last-minute zijn en BZT kosten.</p>
            </Term>
            <Term term="Operational Quality" abbr="0–100">
              <p>
                Kwaliteit van het <em>proces</em>. Start op 100 en trekt punten af voor last-minute beslissingen, open
                punten bij vertrek, onnodige reistijd, wachten, groepssplitsingen, reserverings- en transportproblemen,
                BZT-verlies en overrides.
              </p>
            </Term>
            <Term term="Weekend Outcome" abbr="0–10">
              <p>
                Kwaliteit van de <em>beleving</em>: gewogen gemiddelde van gezelligheid (×2), gerealiseerde BZT (×1,5),
                locatie (×1), avond (×1,5), accommodatie (×1), activiteit (×1) en algemeen (×2).
              </p>
              <p className="font-semibold text-navy">
                De twee assen zijn onafhankelijk. Goede uitkomst bij zwak proces betekent geluk, geen governance.
              </p>
            </Term>
          </Defs>
        </Card>

        <Card eyebrow="Governance" title="Gate, fases en deadlines" padded={false}>
          <Defs>
            <Term term="Readiness gate">
              <p>
                Elke check levert punten: PASS = 1, WARNING = 0,5, FAIL en UNKNOWN = 0. Het percentage is het gemiddelde
                over alle checks.
              </p>
              <p>
                <StatusBadge status="GO" /> alle gating checks PASS én readiness ≥ 80%. {" "}
                <StatusBadge status="NO GO" /> drie of meer FAILs, of minder dan 24 uur tot vertrek met openstaande
                blockers. <StatusBadge status="CONDITIONAL GO" /> al het overige.
              </p>
              <p>Een gating check die op FAIL of UNKNOWN staat blokkeert de overgang naar LOCKED.</p>
            </Term>
            <Term term="Fases">
              <div className="flex flex-wrap gap-1.5 mt-1">
                {["DRAFT", "PLANNING", "READY", "LOCKED", "LIVE", "COMPLETED"].map((p) => (
                  <Badge key={p} tone="neutral">{p}</Badge>
                ))}
              </div>
              <p>
                DRAFT is een leeg dossier, PLANNING het werkende weekend, READY voldoet aan de gate, LOCKED is
                vastgezet, LIVE loopt en COMPLETED is afgerond met retrospective.
              </p>
            </Term>
            <Term term="Headcount lock">
              <p>
                Het moment waarop het aantal deelnemers definitief wordt vastgezet. Zolang de headcount niet gelocked
                is, is elke reservering een gok: reserveren op een onbekend aantal veroorzaakt capacity mismatches.
              </p>
            </Term>
            <Term term="Capacity mismatch">
              <p>
                Gereserveerde capaciteit is kleiner dan het bevestigde aantal: te weinig stoelen in het restaurant, te
                weinig bedden, te weinig plek bij de avondlocatie. Andersom (meer dan twee te veel) heet OVERBOOKED.
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
                    <th>Moet PASS zijn</th>
                  </tr>
                </thead>
                <tbody>
                  {DEADLINES.map((d) => (
                    <tr key={d.key}>
                      <td className="erp-mono font-semibold text-navy whitespace-nowrap">{d.key}</td>
                      <td className="whitespace-nowrap text-[12px]">{d.label}</td>
                      <td className="text-[12px] text-muted">{d.requires}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[11.5px] text-faint mt-1.5">
              Status per deadline: OK (verstreken zonder ontbrekende items), MISSED (verstreken met ontbrekende items),
              AT RISK (binnen 48 uur met ontbrekende items), UPCOMING (verder weg).
            </p>
          </div>
        </Card>
      </div>

      <Card eyebrow="Avondprogramma" title="Group Split Risk" padded={false}>
        <div className="overflow-x-auto">
          <table className="erp">
            <thead>
              <tr>
                <th>Niveau</th>
                <th>Voorbeeld</th>
                <th className="text-right">BZT-aftrek</th>
              </tr>
            </thead>
            <tbody>
              {SPLIT_LEVELS.map((s, i) => (
                <tr key={s.level}>
                  <td><StatusBadge status={s.level} /></td>
                  <td className="text-[13px]">{s.example}</td>
                  <td className="text-right erp-mono">{[0, 10, 25, 45][i]}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 text-[12px] text-muted border-t border-line">
          Extra verzwaring: drie of meer transfers op één avond, of een locatie die de hele groep niet aankan.
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
        <Card eyebrow="Scoring" title="Nightlife Viability Score" padded={false}>
          <div className="overflow-x-auto">
            <table className="erp">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th>Gewicht</th>
                  <th>Regel</th>
                </tr>
              </thead>
              <tbody>
                {VIABILITY_FACTORS.map((f) => (
                  <tr key={f.factor}>
                    <td className="font-semibold text-navy whitespace-nowrap">{f.factor}</td>
                    <td className="erp-mono whitespace-nowrap">{f.max}</td>
                    <td className="text-[12px] text-muted">{f.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-line text-[12px] text-muted">
            Eindscore wordt geklemd op 0–100. Cijfers: EXCELLENT ≥85, GOOD ≥70, MARGINAL ≥50, POOR ≥30, daaronder
            UNVIABLE. Dichtbij maar vroeg dicht is geen goede locatie: nabijheid maakt een korte avond niet goed.
          </div>
        </Card>

        <Card eyebrow="Planning" title="Critical Drinking Path" padded={false}>
          <Defs>
            {PATH_CATEGORIES.map((c) => (
              <Term key={c.key} term={c.label}>
                <p>{c.detail}</p>
              </Term>
            ))}
            <Term term="Effective passenger capacity">
              <p>
                min(beschikbare stoelen, nominale stoelen) − bagagepenalty, met een ondergrens van 0. Stoelen zijn
                exclusief de chauffeur.
              </p>
              <div className="overflow-x-auto mt-1">
                <table className="erp">
                  <thead>
                    <tr>
                      <th>Cargo</th>
                      <th className="text-right">Bagage laag</th>
                      <th className="text-right">Gemiddeld</th>
                      <th className="text-right">Hoog</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td>Klein</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">−1</td><td className="text-right erp-mono">−2</td></tr>
                    <tr><td>Middel</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">−1</td></tr>
                    <tr><td>Groot</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">0</td><td className="text-right erp-mono">0</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-faint">
                Reken met cargo, niet met stoelen: een kleine auto vol kampeerspullen levert twee stoelen in, een grote
                station niets.
              </p>
            </Term>
          </Defs>
        </Card>
      </div>

      <div className="card px-4 py-3 flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-muted">
          Zien hoe deze begrippen op een echte case uitpakken?
        </span>
        <Link href="/history" className="btn btn-sm">Lessons Learned</Link>
        <Link href="/" className="btn btn-sm">Control Room</Link>
      </div>
    </div>
  );
}
