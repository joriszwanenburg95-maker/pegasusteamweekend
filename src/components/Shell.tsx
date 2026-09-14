"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { CalendarRange, History, LayoutDashboard, Menu, X, BookOpen, Settings2 } from "lucide-react";
import { useStore } from "@/store/store";
import { formatDateTime } from "@/lib/engine";

const NAV = [
  { href: "/", label: "Control Room", icon: LayoutDashboard },
  { href: "/weekends", label: "Weekends", icon: CalendarRange },
  { href: "/history", label: "Lessons Learned", icon: History },
  { href: "/glossary", label: "Glossary", icon: BookOpen },
  { href: "/settings", label: "System", icon: Settings2 },
];

export function Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { state, now, hydrated } = useStore();

  const nav = (
    <nav className="flex flex-col gap-0.5 px-2">
      {NAV.map((n) => {
        const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} className={`nav-link ${active ? "active" : ""}`} onClick={() => setOpen(false)}>
            <Icon size={16} strokeWidth={2} />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col bg-navy text-white">
        <SidebarHeader />
        {nav}
        <SidebarFooter clock={state.clockOverride} now={now} hydrated={hydrated} />
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-64 bg-navy text-white flex flex-col">
            <div className="flex items-center justify-between pr-2">
              <SidebarHeader />
              <button className="p-2 text-white/70" onClick={() => setOpen(false)} aria-label="Sluit menu">
                <X size={18} />
              </button>
            </div>
            {nav}
            <SidebarFooter clock={state.clockOverride} now={now} hydrated={hydrated} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="lg:hidden flex items-center gap-3 bg-navy text-white px-4 py-3">
          <button onClick={() => setOpen(true)} aria-label="Open menu" className="p-1">
            <Menu size={20} />
          </button>
          <Image src="/pegasus-logo-256.png" alt="Pegasus" width={28} height={28} />
          <span className="font-bold text-sm tracking-wide">PEGASUS HS1 · CONTROL ROOM</span>
        </header>
        <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-6 max-w-[1400px] w-full mx-auto">{children}</main>
        <footer className="px-4 sm:px-6 lg:px-8 py-4 text-[11px] text-faint border-t border-line flex flex-wrap gap-x-4 gap-y-1">
          <span className="font-semibold text-muted">HUP BLAUW.</span>
          <span>Operational Excellence Since 1998.</span>
          <span className="ml-auto">Pegasus HS1 · Superdivisie Heren · Ark van Oost, Nijmegen · Seizoen 2026/2027</span>
        </footer>
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
        <div className="text-[10px] tracking-[0.18em] text-sky font-semibold">TEAMWEEKEND ERP</div>
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
      <div className="text-white/35">Hup blauw. Operational Excellence Since 1998.</div>
    </div>
  );
}
