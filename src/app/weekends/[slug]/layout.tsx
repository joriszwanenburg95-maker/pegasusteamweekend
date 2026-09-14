"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft } from "lucide-react";
import { useWeekend } from "@/store/store";
import { PhaseBadge, EmptyState, StatusBadge } from "@/components/ui";
import { BobAvatar } from "@/components/bob";
import { evaluateReadiness, bobRiskIndex, formatDateTime } from "@/lib/engine";

const TABS: { seg: string; label: string }[] = [
  { seg: "", label: "Overzicht" },
  { seg: "readiness", label: "Gereedheid" },
  { seg: "headcount", label: "Deelnemers" },
  { seg: "logistics", label: "Slapen & eten" },
  { seg: "nightlife", label: "Avond" },
  { seg: "transport", label: "Vervoer" },
  { seg: "critical-path", label: "Kritiek pad" },
  { seg: "runbook", label: "Draaiboek" },
  { seg: "retrospective", label: "Terugblik" },
  { seg: "settings", label: "Instellingen" },
];

export default function WeekendLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ slug: string }>();
  const pathname = usePathname();
  const { weekend, now } = useWeekend(params.slug);

  if (!weekend) {
    return (
      <EmptyState title="Weekend niet gevonden">
        <Link href="/weekends" className="underline">Terug naar weekenden</Link>
      </EmptyState>
    );
  }

  const base = `/weekends/${weekend.slug}`;
  const readiness = evaluateReadiness(weekend, now);
  const bob = bobRiskIndex(weekend, now);

  return (
    <div>
      <div className="card-navy px-4 sm:px-5 py-4 mb-4 stripe">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href="/weekends" className="inline-flex items-center gap-0.5 text-[11px] text-sky hover:text-white mb-1 -ml-1 py-1 pr-2">
              <ChevronLeft size={14} /> Alle weekenden
            </Link>
            <div className="erp-label">Teamweekend · {weekend.season} · {weekend.city || "locatie n.t.b."}</div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight mt-0.5">{weekend.name}</h1>
            <div className="text-[12px] text-white/65 mt-1 erp-mono">
              Vertrek {formatDateTime(weekend.departureAt)} · Terug {formatDateTime(weekend.returnAt)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={weekend.phase} />
            <StatusBadge status={readiness.gate} />
            <span className="erp-mono text-[12px] text-white/80" title="Gereedheid">
              GEREEDHEID {readiness.percent}%
            </span>
            <span className="erp-mono text-[12px] text-white/80 inline-flex items-center gap-1.5" title={bob.tooltip}>
              <BobAvatar bob={bob} size={20} /> BOB {bob.score}
            </span>
          </div>
        </div>
      </div>
      <TabStrip base={base} pathname={pathname} />
      {children}
    </div>
  );
}

/** Horizontale tabbalk: sticky onder de mobiele kop, actieve tab automatisch in beeld, randvervaging als er meer is. */
function TabStrip({ base, pathname }: { base: string; pathname: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const updateEdges = () => {
    const el = scroller.current;
    if (!el) return;
    setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    const active = el.querySelector<HTMLElement>('[aria-current="page"]');
    if (active) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      active.scrollIntoView({ inline: "center", block: "nearest", behavior: reduce ? "auto" : "smooth" });
    }
    updateEdges();
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pathname]);

  return (
    <div className="tab-strip -mx-4 px-4 sm:mx-0 sm:px-0 mb-5" data-more-left={edges.left} data-more-right={edges.right}>
      <div ref={scroller} onScroll={updateEdges} className="tab-scroller flex gap-1 overflow-x-auto border-b border-line" role="tablist" aria-label="Weekendonderdelen">
        {TABS.map((t) => {
          const href = t.seg ? `${base}/${t.seg}` : base;
          const active = t.seg ? pathname.startsWith(href) : pathname === base;
          return (
            <Link key={t.seg} href={href} className={`tab ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
