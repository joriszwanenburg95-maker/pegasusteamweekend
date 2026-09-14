# Pegasus HS1 · Teamweekend Control Room

Next.js 16 (App Router, `src/`), Tailwind v4, TypeScript strict, lucide-react, vitest.
Alle UI-tekst is Nederlands (interne enum-codes blijven Engels; vertaal via `nl()` in `src/lib/labels.ts`). Visuals: `src/components/viz.tsx` (Gauge, CountUp, StackedBar, TimeWindowBar, SeatGrid, DotRow, PhaseStepper) + CSS-animaties `.rise`, `.viz-*` in globals.css.
Alle data is client-side (React context + localStorage, seed in `src/data/seed.ts`). Geen backend.

- Domein-types: `src/lib/types.ts`
- Rekenengine (pure functies, getest): `src/lib/engine/*` — importeer via `@/lib/engine`
- Store: `useStore()`, `useWeekend(slug)`, `useCurrentWeekend()` in `src/store/`
- UI-primitives: `src/components/ui` (Badge, StatusBadge, PhaseBadge, Card, Kpi, Progress, Field, inputs…)
- Design tokens: `src/app/globals.css` (Pegasus navy `#000d44`, sky `#77aadf`, cobalt/royal fallback). Groen = alleen GO/success, amber = warning, rood = NO GO/blocker. Geen paarse gradients.

Scripts: `npm run dev`, `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`.
Commit direct op `main` en push.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
