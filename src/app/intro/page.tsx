"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  ArrowRight,
  Tent,
  BedDouble,
  ShieldCheck,
  Beer,
  Route,
  CarFront,
  Users,
  Utensils,
  ClipboardList,
  Cookie,
  Gauge as GaugeIcon,
} from "lucide-react";
import { useStore } from "@/store/store";
import { Badge, Callout, Card, PageHeader, StatusBadge, toneForPercent } from "@/components/ui";
import { Gauge, PhaseStepper } from "@/components/viz";
import { retrospectiveScores, evaluateReadiness, bobRiskIndex } from "@/lib/engine";
import { WEEKEND_PHASES } from "@/lib/types";
import { nl } from "@/lib/labels";
import { BobGauge } from "@/components/bob";

const LESSONS: { icon: ReactNode; text: string }[] = [
  { icon: <Tent size={18} />, text: "Eigen tent is geen slaapplaats" },
  { icon: <Utensils size={18} />, text: "Eten regel je vóór vertrek" },
  { icon: <Beer size={18} />, text: "Vroeg dicht is geen avond" },
  { icon: <CarFront size={18} />, text: "Stoelen minus bagage is capaciteit" },
  { icon: <Users size={18} />, text: "Reserveren zonder aantal is gokken" },
  { icon: <Cookie size={18} />, text: "Onbewaakte chips van Rik verdwijnen" },
];

const STEPS: { icon: ReactNode; title: string; seg: string; line: string }[] = [
  { icon: <Users size={15} />, title: "Deelnemers", seg: "headcount", line: "Vijf losse statussen per persoon, daarna vergrendelen." },
  { icon: <BedDouble size={15} />, title: "Slapen & eten", seg: "logistics", line: "Echt bed, check-in, reservering en keukensluiting." },
  { icon: <Beer size={15} />, title: "Avondprogramma", seg: "nightlife", line: "Haalbaarheidsscore, BZT en groepssplitsingsrisico." },
  { icon: <CarFront size={15} />, title: "Vervoer", seg: "transport", line: "Effectieve stoelen = stoelen min bagage." },
  { icon: <Route size={15} />, title: "Kritiek Bierpad", seg: "critical-path", line: "Van EINDE WEDSTRIJD tot EERSTE BIER, stap voor stap." },
  { icon: <ShieldCheck size={15} />, title: "Gereedheid", seg: "readiness", line: "Checks, vier deadlines en de GO / NO GO-poort." },
  { icon: <ClipboardList size={15} />, title: "Draaiboek", seg: "runbook", line: "Eén pagina voor onderweg, met eigenaar en deadline." },
  { icon: <GaugeIcon size={15} />, title: "Terugblik", seg: "retrospective", line: "Beleving en operationele kwaliteit los van elkaar." },
];

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
  const nextBob = next ? bobRiskIndex(next, now) : null;
  const tabHref = (seg: string) => (next ? `/weekends/${next.slug}/${seg}` : "/weekends");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Module 0 · Inwerken"
        title="Introductie"
        subtitle="Waarom Pegasus Heren 1 een ERP heeft voor een weekendje weg — en hoe je het gebruikt."
        actions={
          <Link href="/" className="btn btn-primary">
            Naar de Controlekamer <ArrowRight size={14} />
          </Link>
        }
      />

      {/* Missie */}
      <section className="card-navy stripe px-5 py-6 sm:px-8 sm:py-7 rise rise-1">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <Image src="/pegasus-logo-256.png" alt="Pegasus Volleybal" width={96} height={96} className="rounded bg-white/95 p-1 shrink-0" />
          <div className="min-w-0">
            <div className="erp-label">Missie</div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight mt-1">
              Nooit meer een teamweekend op een camping.
            </h2>
            <p className="text-white/80 text-sm mt-2.5 leading-relaxed max-w-2xl">
              Maaseik werd een geweldig weekend én een operationele ramp. Die twee dingen mogen nooit meer met elkaar
              verward worden.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Badge tone="nogo">
                <Tent size={11} /> Camping = {nl("FAIL")} op bedden
              </Badge>
              <Badge tone="go">
                <BedDouble size={11} /> Echt bed = {nl("PASS")}
              </Badge>
              <Badge tone="navy">HUP BLAUW.</Badge>
            </div>
          </div>
        </div>
      </section>

      {/* Het probleem, visueel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
        <Card eyebrow="Waarom" title="Twee assen, niet één cijfer" className="lg:col-span-2 rise rise-2">
          <div className="flex flex-wrap items-center justify-center gap-6 py-1">
            <Gauge
              value={maaseikScores ? maaseikScores.out.score : 0}
              max={10}
              size={128}
              decimals={1}
              tone={maaseikScores && maaseikScores.out.score >= 7.5 ? "go" : "warn"}
              label="Weekendbeleving"
              sublabel="/ 10"
            />
            <Gauge
              value={maaseikScores ? maaseikScores.ops.score : 0}
              max={100}
              size={128}
              tone={maaseikScores ? toneForPercent(maaseikScores.ops.score) : "unknown"}
              label="Operationele kwaliteit"
              sublabel="/ 100"
            />
            <p className="text-[13px] text-muted leading-snug flex-1 min-w-[200px]">
              Maaseik, dezelfde 48 uur, twee heel verschillende cijfers. Eén score (&ldquo;was het leuk?&rdquo;) poetst
              elke organisatorische zonde weg, dus meet dit systeem beleving en proces apart.
              {maaseikScores && (
                <span className="block font-semibold text-navy mt-1.5">{maaseikScores.classification}</span>
              )}
            </p>
          </div>
        </Card>

        <Card eyebrow="De les van Maaseik" title="EEN GOED WEEKEND ≠ EEN GOED GEORGANISEERD WEEKEND" className="rise rise-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {LESSONS.map((l) => (
              <div key={l.text} className="flex items-center gap-2.5 rounded-[6px] border border-line bg-sunken px-2.5 py-2">
                <span className="shrink-0 w-8 h-8 rounded bg-nogo-bg text-nogo flex items-center justify-center">{l.icon}</span>
                <span className="text-[12.5px] font-semibold text-navy leading-snug">{l.text}</span>
              </div>
            ))}
          </div>
          {maaseik && (
            <div className="mt-3 pt-3 border-t border-line grid grid-cols-2 gap-2 text-[12px]">
              <div>
                <div className="erp-label">Bob-aanlooptijd</div>
                <div className="erp-mono font-semibold text-nogo">{maaseikLead !== null ? `${Math.round(maaseikLead)}u` : "—"}</div>
              </div>
              <div>
                <div className="erp-label">Bob-risico-index</div>
                <div className="erp-mono font-semibold text-nogo">{maaseikBob ? `${maaseikBob.score} · ${nl(maaseikBob.level)}` : "—"}</div>
              </div>
            </div>
          )}
          <Link href="/history" className="btn btn-sm mt-3">
            Volledige terugblik <ArrowRight size={12} />
          </Link>
        </Card>
      </div>

      {/* Hoe het werkt */}
      <Card eyebrow="Hoe het werkt" title="Van CONCEPT naar AFGEROND in zes fases" padded={false} className="rise rise-4">
        <div className="px-4 py-4">
          <PhaseStepper phases={WEEKEND_PHASES} current={next?.phase ?? "PLANNING"} labels={nl} />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 mt-5">
            {STEPS.map((s, i) => (
              <Link key={s.seg} href={tabHref(s.seg)} className="card card-hover px-3 py-2.5 flex gap-2.5">
                <span className="shrink-0 w-8 h-8 rounded bg-navy text-white flex items-center justify-center">{s.icon}</span>
                <span className="min-w-0">
                  <span className="block font-bold text-navy text-[13px]">
                    <span className="erp-mono text-faint mr-1.5">{String(i + 1).padStart(2, "0")}</span>
                    {s.title}
                  </span>
                  <span className="block text-[11.5px] text-muted leading-snug mt-0.5">{s.line}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </Card>

      {/* De twee KPI's */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Card eyebrow="Serieuze KPI" title="Gereedheid" className="rise rise-5">
          <div className="flex items-center gap-4">
            <Gauge
              value={nextReadiness?.percent ?? 0}
              size={104}
              suffix="%"
              tone={toneForPercent(nextReadiness?.percent ?? 0)}
            />
            <p className="text-[13px] text-muted leading-snug">
              Aandeel checks op {nl("PASS")} ({nl("WARNING")} telt half). Onder 80% of met één {nl("FAIL")} of{" "}
              {nl("UNKNOWN")} op een blokkerende check kan een weekend niet {nl("LOCKED")} worden.
            </p>
          </div>
          {next && nextReadiness && (
            <div className="mt-3 rounded-[6px] border border-line bg-sunken px-3 py-2 flex flex-wrap items-center gap-2 text-[12px]">
              <span className="font-semibold text-navy">{next.name}</span>
              <StatusBadge status={nextReadiness.gate} />
              <Link href={`/weekends/${next.slug}/readiness`} className="btn btn-sm ml-auto">
                Open poort <ArrowRight size={12} />
              </Link>
            </div>
          )}
        </Card>
        <Card eyebrow="Ludieke KPI" title="Bob-risico-index" className="rise rise-6">
          <div className="flex items-center gap-4">
            {nextBob ? (
              <BobGauge bob={nextBob} size={104} />
            ) : (
              <Gauge value={0} size={104} tone="unknown" />
            )}
            <p className="text-[13px] text-muted leading-snug">
              0–100 op basis van échte planningdata: geen bed, eten onbekend, taxi niet geregeld omhoog; hotel
              bevestigd, eten gereserveerd, kroeg op loopafstand omlaag. Telt nooit mee in GO / NO GO.
            </p>
          </div>
          <Callout tone="unknown" title="Tooltip">Eén Bob is genoeg.</Callout>
        </Card>
      </div>

      <Callout tone="neutral" title="Werkwijze">
        Alle data staat in deze browser. Exporteren en de simulatieklok vind je bij{" "}
        <Link href="/settings" className="underline">Systeem</Link>; uitleg van de termen bij{" "}
        <Link href="/glossary" className="underline">Begrippen</Link>.
      </Callout>
    </div>
  );
}
