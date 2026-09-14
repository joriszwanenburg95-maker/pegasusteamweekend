# Pegasus HS1 · Teamweekend Control Room

> HUP BLAUW. Operational Excellence Since 1998.

ERP-achtige planningsapplicatie voor de teamweekenden van **Pegasus Heren 1** (Superdivisie Heren, Nijmegen).
Volkomen overdreven corporate governance voor een weekend weg met het team.

## Wat het doet

- **Readiness gate** (DRAFT → PLANNING → READY → LOCKED → LIVE → COMPLETED) met checks op attendance,
  accommodatie, bedden, avondlocatie, eten, reserveringen, transport, chauffeurs, stoel- en bagagecapaciteit,
  toegangsinformatie en zondagprogramma. Deadlines T-7D / T-72H / T-24H / DEPARTURE. **BOB lead time**.
- **Nightlife Viability Score** (BZT-window, afstand, transfers, sluitingstijd, groep samen, reservering, fallback).
- **Group Split Risk** (LOW / MEDIUM / HIGH / CRITICAL) als negatieve factor in BZT en Operational Quality.
- **Transport Capacity 2.0**: effectieve passagierscapaciteit per auto op basis van cargo en bagage.
- **Headcount lock** met aparte attendance voor wedstrijd, weekend, overnachting, zondag en diner; capacity mismatch.
- **Food control**, **local event fallback**, compacte **runbook** met owner/status/deadline.
- **Critical Drinking Path**: MATCH END → … → FIRST BEER met VALUE ADDING / BZT / LOGISTICS / WASTE en optimalisaties.
- **Operational Quality Score** vs **Weekend Outcome Score** (Maaseik: "Questionable process. Acceptable result.").
- **Bob Risk Index** (0-100, puur ludiek, nooit GO/NO GO).

## Stack

Next.js 16 · React 19 · Tailwind v4 · TypeScript · vitest. Alle data client-side in localStorage (seed in `src/data/seed.ts`).

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # engine unit tests
npm run build
```

## Huisstijl

Kleuren en font afgeleid van pegasusvolleybal.com: navy `#000d44`, accent lichtblauw `#77aadf`, Poppins.
Overige blauwtinten zijn ERP-fallbacks, geen officiële brand-codes. Logo: Pegasus Volleybal (clublogo).
