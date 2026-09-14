"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CalendarRange, History, LayoutDashboard, Menu, X, BookOpen, Settings2, Compass, Trophy } from "lucide-react";
import { useStore } from "@/store/store";
import { formatDateTime } from "@/lib/engine";

const NAV = [
  { href: "/", label: "Controlekamer", short: "Home", icon: LayoutDashboard, bottom: true },
  { href: "/intro", label: "Introductie", short: "Intro", icon: Compass, bottom: false },
  { href: "/matches", label: "Wedstrijden", short: "Wedstrijden", icon: Trophy, bottom: true },
  { href: "/weekends", label: "Weekenden", short: "Weekenden", icon: CalendarRange, bottom: true },
  { href: "/history", label: "Geleerde lessen", short: "Lessen", icon: History, bottom: true },
  { href: "/glossary", label: "Begrippen", short: "Begrippen", icon: BookOpen, bottom: false },
  { href: "/settings", label: "Systeem", short: "Systeem", icon: Settings2, bottom: false },
];

function isActive(href: string, pathname: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { state, now, hydrated } = useStore();

  // Lade sluit bij routewissel en op Escape; body scrolt niet mee zolang de lade open is.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const nav = (
    <nav className="flex flex-col gap-0.5 px-2" aria-label="Hoofdmenu">
      {NAV.map((n) => {
        const active = isActive(n.href, pathname);
        const Icon = n.icon;
        return (
          <Link
            key={n.href}
            href={n.href}
            className={`nav-link ${active ? "active" : ""}`}
            aria-current={active ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            <Icon size={16} strokeWidth={2} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <a href="#inhoud" className="skip-link">Naar inhoud</a>

      {/* Sidebar (desktop) */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-navy text-white">
        <SidebarHeader />
        {nav}
        <SidebarFooter clock={state.clockOverride} now={now} hydrated={hydrated} />
      </aside>

      {/* Lade (mobiel) */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-navy text-white flex flex-col shadow-2xl">
            <div className="flex items-center justify-between pr-2">
              <SidebarHeader />
              <button className="p-2.5 text-white/70 hover:text-white" onClick={() => setOpen(false)} aria-label="Sluit menu">
                <X size={20} />
              </button>
            </div>
            {nav}
            <SidebarFooter clock={state.clockOverride} now={now} hydrated={hydrated} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Vaste kop (mobiel) */}
        <header className="mobile-header lg:hidden sticky top-0 z-30 flex items-center gap-2 bg-navy text-white px-3">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-2 -ml-1 rounded hover:bg-white/10">
            <Menu size={22} />
          </button>
          <Link href="/" className="flex items-center gap-2 min-w-0">
            <Image src="/pegasus-logo-256.png" alt="Pegasus" width={28} height={28} />
            <span className="font-bold text-[13px] tracking-wide truncate">PEGASUS HS1 · CONTROLEKAMER</span>
          </Link>
          {state.clockOverride && (
            <Link href="/settings" className="ml-auto erp-mono text-[10px] font-bold text-warn shrink-0" title="Simulatieklok actief">
              SIM
            </Link>
          )}
        </header>

        <main id="inhoud" className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6 pb-24 lg:pb-6 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
        <footer className="px-4 sm:px-6 lg:px-8 py-4 pb-24 lg:pb-4 text-[11px] text-faint border-t border-line flex flex-wrap gap-x-4 gap-y-1">
          <span className="font-semibold text-muted">HUP BLAUW.</span>
          <span>Operationele excellentie sinds 1998.</span>
          <span className="ml-auto">Pegasus HS1 · Superdivisie Heren · Ark van Oost, Nijmegen · Seizoen 2026/2027</span>
        </footer>

        {/* Onderbalk (mobiel) */}
        <nav className="bottom-nav lg:hidden" aria-label="Snelmenu">
          {NAV.filter((n) => n.bottom).map((n) => {
            const active = isActive(n.href, pathname);
            const Icon = n.icon;
            return (
              <Link key={n.href} href={n.href} className={`bottom-nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined}>
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                <span>{n.short}</span>
              </Link>
            );
          })}
          <button type="button" className="bottom-nav-item" onClick={() => setOpen(true)} aria-label="Meer opties">
            <Menu size={20} />
            <span>Meer</span>
          </button>
        </nav>
      </div>
    </div>
  );
}

function SidebarHeader() {
  return (
    <Link href="/" className="flex items-center gap-3 px-4 pt-5 pb-4">
      <Image src="/pegasus-logo-256.png" alt="Pegasus Volleybal" width={44} height={44} className="rounded bg-white/95 p-0.5" priority />
      <div className="leading-tight">
        <div className="font-extrabold tracking-wide text-[13px]">PEGASUS HS1</div>
        <div className="text-[10px] tracking-[0.18em] text-sky font-semibold">TEAMWEEKEND-ERP</div>
      </div>
    </Link>
  );
}

function SidebarFooter({ clock, now, hydrated }: { clock: string | null; now: string; hydrated: boolean }) {
  return (
    <div className="mt-auto px-4 py-4 text-[11px] text-white/55 space-y-1 border-t border-white/10">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${clock ? "bg-warn" : "bg-go live-dot"}`} />
        <span className="erp-mono">{hydrated ? formatDateTime(now) : "…"}</span>
        {clock && <span className="text-warn font-semibold">SIM</span>}
      </div>
      <div>Superdivisie Heren · Nijmegen</div>
      <div className="text-white/35">Hup blauw. Operationele excellentie sinds 1998.</div>
    </div>
  );
}
