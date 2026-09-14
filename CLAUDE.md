# Pegasus HS1 · Teamweekend Control Room

Next.js 16 (App Router, `src/`), Tailwind v4, TypeScript strict, lucide-react, vitest.
Alle data is client-side (React context + localStorage, seed in `src/data/seed.ts`). Geen backend.

- Domein-types: `src/lib/types.ts`
- Rekenengine (pure functies, getest): `src/lib/engine/*` — importeer via `@/lib/engine`
- Store: `useStore()`, `useWeekend(slug)`, `useCurrentWeekend()` in `src/store/`
- UI-primitives: `src/components/ui` (Badge, StatusBadge, PhaseBadge, Card, Kpi, Progress, Field, inputs…)
- Design tokens: `src/app/globals.css` (Pegasus navy `#000d44`, sky `#77aadf`, cobalt/royal fallback). Groen = alleen GO/success, amber = warning, rood = NO GO/blocker. Geen paarse gradients.

Scripts: `npm run dev`, `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`.
Commit direct op `main` en push.
