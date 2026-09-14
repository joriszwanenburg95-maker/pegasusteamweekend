"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useWeekend } from "@/store/store";
import { PhaseBadge, EmptyState, StatusBadge } from "@/components/ui";
import { evaluateReadiness, bobRiskIndex, formatDateTime } from "@/lib/engine";

const TABS: { seg: string; label: string }[] = [
  { seg: "", label: "Overview" },
  { seg: "readiness", label: "Readiness" },
  { seg: "headcount", label: "Headcount" },
  { seg: "logistics", label: "Stay & Food" },
  { seg: "nightlife", label: "Nightlife" },
  { seg: "transport", label: "Transport" },
  { seg: "critical-path", label: "Critical Path" },
  { seg: "runbook", label: "Runbook" },
  { seg: "retrospective", label: "Retrospective" },
  { seg: "settings", label: "Settings" },
];

export default function WeekendLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ slug: string }>();
  const pathname = usePathname();
  const { weekend, now } = useWeekend(params.slug);

  if (!weekend) {
    return (
      <EmptyState title="Weekend niet gevonden">
        <Link href="/weekends" className="underline">Terug naar weekends</Link>
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
            <div className="erp-label">Teamweekend · {weekend.season} · {weekend.city || "locatie n.t.b."}</div>
            <h1 className="text-lg sm:text-xl font-extrabold tracking-tight mt-0.5">{weekend.name}</h1>
            <div className="text-[12px] text-white/65 mt-1 erp-mono">
              Departure {formatDateTime(weekend.departureAt)} · Return {formatDateTime(weekend.returnAt)}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <PhaseBadge phase={weekend.phase} />
            <StatusBadge status={readiness.gate} />
            <span className="erp-mono text-[12px] text-white/80" title="Readiness">
              READINESS {readiness.percent}%
            </span>
            <span className="erp-mono text-[12px] text-white/80" title={bob.tooltip}>
              BOB {bob.score}
            </span>
          </div>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-line mb-5 -mx-4 px-4 sm:mx-0 sm:px-0">
        {TABS.map((t) => {
          const href = t.seg ? `${base}/${t.seg}` : base;
          const active = t.seg ? pathname.startsWith(href) : pathname === base;
          return (
            <Link key={t.seg} href={href} className={`tab ${active ? "active" : ""}`}>
              {t.label}
            </Link>
          );
        })}
      </div>
      {children}
    </div>
  );
}
