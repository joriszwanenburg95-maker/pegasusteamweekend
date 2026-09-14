"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Tent, BedDouble, ShieldCheck, Beer, Route, CarFront, Users, Utensils, ClipboardList, Gauge } from "lucide-react";
import { useStore } from "@/store/store";
import { Badge, Callout, Card, PageHeader, StatusBadge } from "@/components/ui";
import { retrospectiveScores, evaluateReadiness, bobRiskIndex } from "@/lib/engine";
import { WEEKEND_PHASES } from "@/lib/types";
import { nl } from "@/lib/labels";

export default function IntroPage() {
  const { state, now } = useStore();
  const maaseik = state.weekends.find((w) => w.slug === "maaseik" || w.id === "w-maaseik");
  const maaseikScores = maaseik?.retrospective.filled ? retrospectiveScores(maaseik.retrospective, maaseik) : null;
  const maaseikBob = maaseik ? bobRiskIndex(maaseik, maaseik.departureAt) : null;
  const maaseikLead = maaseik ? evaluateReadiness(maaseik, maaseik.departureAt).bobLeadTimeHours : null;
  const next = state.weekends
    .filter((w) => w.phase !== "COMPLETED")
    .sort((a, b) => a.departureAt.localeCompare(b.departureAt))[0];
  const nextReadiness = next ? evaluateReadiness(next, now) : null;

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Module 0 · Onboarding"
        title="Introductie"
        subtitle="Waarom Pegasus Heren 1 een ERP heeft voor een weekendje weg, en hoe je het gebruikt."
        actions={
          <Link href="/" className="btn btn-primary">
            Naar de Control Room <ArrowRight size={14} />
          </Link>
        }
      />

      {/* Mission statement */}
      <section className="card-navy stripe px-5 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <Image src="/pegasus-logo-256.png" alt="Pegasus Volleybal" width={96} height={96} className="rounded bg-white/95 p-1 shrink-0" />
          <div className="min-w-0">
            <div className="erp-label">Mission statement</div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
              Nooit meer een teamweekend op een camping.
            </h2>
            <p className="text-white/80 text-sm mt-3 leading-relaxed max-w-3xl">
              Dit systeem is in het leven geroepen na het teamweekend in Maaseik: zeven tentplaatsen, twee man per
              tent, maximaal circa drie vierkante meter per tent, tenten en ontbijt zelf regelen. Het werd een
              geweldig weekend. Het was ook een operationele ramp. Die twee dingen mogen nooit meer met elkaar
              verward worden.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge tone="nogo">
                <Tent size={11} /> Camping = FAIL op Beds
              </Badge>
              <Badge tone="go">
                <BedDouble size={11} /> Daadwerkelijk bed = PASS
              </Badge>
              <Badge tone="navy">Hup blauw.</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Why */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card eyebrow="Waarom" title="Het probleem" className="lg:col-span-2">
          <div className="text-sm text-muted space-y-3 leading-relaxed">
            <p>
              Een teamweekend organiseren gaat in de praktijk zo: iemand vindt een goedkope slaapplek, de groepsgrootte
              blijft tot vlak voor vertrek onduidelijk, eten en avondprogramma zijn “wel te regelen ter plaatse”, en
              de autoverdeling wordt op de parkeerplaats bij Ark van Oost bedacht. Soms loopt dat goed af. In Maaseik
              liep het gezellig af, maar niet goed: het restaurant was vol, de lokale horeca sloot vroeg, de stad
              vereiste een taxirit en de kampeerspullen halveerden de autocapaciteit.
            </p>
            <p>
              De kern van het probleem is dat één cijfer (“was het leuk?”) alle organisatorische zonden wegpoetst.
              Daarom meet dit systeem twee dingen apart:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div className="card px-4 py-3">
                <div className="erp-label">Weekend Outcome Score</div>
                <div className="erp-mono text-2xl font-semibold text-navy mt-1">
                  {maaseikScores ? maaseikScores.out.score.toFixed(1) : "—"}
                  <span className="text-sm text-faint font-medium"> / 10</span>
                </div>
                <div className="text-[12px] text-muted mt-1">Hoe was het? Gezelligheid, avond, accommodatie, activiteit.</div>
              </div>
              <div className="card px-4 py-3">
                <div className="erp-label">Operational Quality Score</div>
                <div className="erp-mono text-2xl font-semibold text-nogo mt-1">
                  {maaseikScores ? maaseikScores.ops.score : "—"}
                  <span className="text-sm text-faint font-medium"> / 100</span>
                </div>
                <div className="text-[12px] text-muted mt-1">Hoe is het georganiseerd? Last-minute besluiten, wachten, splitsingen.</div>
              </div>
            </div>
            {maaseikScores && (
              <p className="font-semibold text-navy">
                Maaseik: “{maaseikScores.classification}” — en precies daarom bestaat dit systeem.
              </p>
            )}
          </div>
        </Card>

        <Card eyebrow="De les van Maaseik" title="GOOD WEEKEND OUTCOME ≠ GOOD OPERATIONAL PLANNING">
          <ul className="text-[13px] text-muted space-y-2">
            <li className="flex gap-2"><Tent size={14} className="mt-0.5 shrink-0 text-nogo" /> Zelf een tent regelen is geen slaapplaats. Het is een risico dat je meeneemt.</li>
            <li className="flex gap-2"><Utensils size={14} className="mt-0.5 shrink-0 text-nogo" /> “Wat eten we eigenlijk?” hoort niet op zaterdagavond ter plaatse gesteld te worden.</li>
            <li className="flex gap-2"><Beer size={14} className="mt-0.5 shrink-0 text-nogo" /> Een kroeg op loopafstand die vroeg sluit is geen avondprogramma.</li>
            <li className="flex gap-2"><CarFront size={14} className="mt-0.5 shrink-0 text-nogo" /> Stoelen zijn geen capaciteit. Stoelen minus bagage is capaciteit.</li>
            <li className="flex gap-2"><Users size={14} className="mt-0.5 shrink-0 text-nogo" /> Reserveren met een onbekende groepsgrootte is gokken.</li>
          </ul>
          {maaseik && (
            <div className="mt-3 pt-3 border-t border-line grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <div className="erp-label">BOB lead time</div>
                <div className="erp-mono font-semibold text-nogo">{maaseikLead !== null ? `${Math.round(maaseikLead)}u` : "—"}</div>
              </div>
              <div>
                <div className="erp-label">Bob Risk Index</div>
                <div className="erp-mono font-semibold text-nogo">{maaseikBob ? `${maaseikBob.score} · ${maaseikBob.level}` : "—"}</div>
              </div>
            </div>
          )}
          <Link href="/history" className="btn btn-sm mt-3">
            Volledige retrospective <ArrowRight size={12} />
          </Link>
        </Card>
      </div>

      {/* How it works */}
      <Card eyebrow="Hoe het werkt" title="Van DRAFT naar COMPLETED in zes fases" padded={false}>
        <div className="px-4 py-4">
          <div className="flex flex-wrap gap-1.5 mb-4">
            {WEEKEND_PHASES.map((p, i) => (
              <div key={p} className="flex items-center gap-1.5">
                <Badge tone={p === "LOCKED" ? "navy" : p === "LIVE" || p === "READY" ? "go" : p === "PLANNING" ? "warn" : "unknown"}>{nl(p)}</Badge>
                {i < WEEKEND_PHASES.length - 1 && <ArrowRight size={12} className="text-faint" />}
              </div>
            ))}
          </div>
          <ol className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px]">
            <Step n={1} icon={<Users size={15} />} title="Headcount" href="headcount">
              Elke deelnemer krijgt aparte status voor wedstrijd, weekend, overnachting, zondag en diner. Pas als niemand
              meer “unknown” is, wordt de headcount gelocked. Reserveringen worden daarna live tegen dat aantal gecontroleerd.
            </Step>
            <Step n={2} icon={<BedDouble size={15} />} title="Stay & Food" href="logistics">
              Accommodatie met daadwerkelijke bedden, check-in en toegangscode. Eten is geen vrije tekst maar een plan met
              locatie, reservering, tijd en keukensluiting. Onbekend eten geeft direct een FAIL.
            </Step>
            <Step n={3} icon={<Beer size={15} />} title="Nightlife" href="nightlife">
              Elke avondbestemming krijgt een Nightlife Viability Score en een Group Split Risk. Het systeem rekent de
              BZT uit: Bier Zuip Tijd, de tijd waarin het team daadwerkelijk samen kan zijn.
            </Step>
            <Step n={4} icon={<CarFront size={15} />} title="Transport" href="transport">
              Per auto: chauffeur, stoelen, cargo en bagage. Effectieve capaciteit moet de reizigers dekken, anders
              waarschuwt het systeem. Kampeerspullen zijn hier bewust de slechtst denkbare bagage.
            </Step>
            <Step n={5} icon={<Route size={15} />} title="Critical Drinking Path" href="critical-path">
              Zaterdagavond als critical path: van MATCH END tot FIRST BEER, met elke stap gelabeld als value adding,
              BZT, logistiek of pure waste. Het systeem toont welke stap overslaan hoeveel minuten oplevert.
            </Step>
            <Step n={6} icon={<ShieldCheck size={15} />} title="Readiness gate" href="readiness">
              Twaalf checks, vier deadlines (T-7D, T-72H, T-24H, DEPARTURE) en een BOB lead time. LOCKED kan alleen als
              alle gating checks PASS zijn. Wie toch wil, doet een governance-override die in het decision log komt.
            </Step>
            <Step n={7} icon={<ClipboardList size={15} />} title="Runbook" href="runbook">
              Eén compacte operationele pagina voor onderweg: checklist met owner, status en deadline, toegangsgegevens
              en teamspullen. Geen paklijst van drie pagina&apos;s.
            </Step>
            <Step n={8} icon={<Gauge size={15} />} title="Retrospective" href="retrospective">
              Na afloop twee losse scores: Weekend Outcome (hoe was het) en Operational Quality (hoe was het geregeld).
              De classificatie zegt de rest. Lessen komen in Lessons Learned.
            </Step>
          </ol>
        </div>
      </Card>

      {/* Two KPIs explained */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card eyebrow="Serieuze KPI" title="Readiness">
          <p className="text-[13px] text-muted leading-relaxed">
            Het percentage gating checks dat PASS is (WARNING telt half). Onder 80% of met een FAIL of UNKNOWN op een
            gating check mag een weekend niet LOCKED worden. De gate wordt niet automatisch NO GO omdat planning nog niet
            af is; hij laat wel zien welk risico ontstaat als beslissingen te laat vallen.
          </p>
          {next && nextReadiness && (
            <div className="mt-3 card px-3 py-2 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="font-semibold text-navy">{next.name}</span>
              <StatusBadge status={nextReadiness.gate} />
              <span className="erp-mono">READINESS {nextReadiness.percent}%</span>
              <Link href={`/weekends/${next.slug}/readiness`} className="btn btn-sm ml-auto">
                Open gate <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </Card>
        <Card eyebrow="Ludieke KPI" title="Bob Risk Index">
          <p className="text-[13px] text-muted leading-relaxed">
            Van 0 tot 100, uitsluitend op basis van echte planningdata: zelf een tent regelen, eten onbekend, headcount
            niet gelocked, taxi niet geregeld. Verlagend: hotel bevestigd, eten gereserveerd, kroeg op loopafstand, plan
            meer dan 72 uur vooraf compleet. De index telt nooit mee in GO/NO GO.
          </p>
          <Callout tone="unknown" title="Tooltip">One Bob is enough.</Callout>
        </Card>
      </div>

      <Callout tone="neutral" title="Werkwijze">
        Alle data staat in deze browser (localStorage). Exporteer via <Link href="/settings" className="underline">System</Link> als
        je een plan wilt delen, en gebruik daar de simulatieklok om te zien hoe de deadlines eruitzien op T-24H.
        Begrippen staan in de <Link href="/glossary" className="underline">Glossary</Link>.
      </Callout>
    </div>
  );
}

function Step({ n, icon, title, href, children }: { n: number; icon: React.ReactNode; title: string; href: string; children: React.ReactNode }) {
  return (
    <li className="card px-4 py-3 flex gap-3">
      <div className="shrink-0 w-8 h-8 rounded bg-navy text-white flex items-center justify-center">{icon}</div>
      <div className="min-w-0">
        <div className="font-bold text-navy text-sm">
          <span className="erp-mono text-faint mr-1.5">{String(n).padStart(2, "0")}</span>
          {title}
        </div>
        <p className="text-muted mt-0.5 leading-snug">{children}</p>
        <div className="text-[11px] text-faint mt-1">Tab: {href}</div>
      </div>
    </li>
  );
}
