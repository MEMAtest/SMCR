# MEMA SMCR Co-Build Workspace

This workspace tracks the design and build of a premium Senior Managers & Certification Regime (SMCR) assistant that will ship for free and plug into MEMA's internal tooling. Use this document as the high-level source of truth while we translate the prototype (`smcr1.html`) into a production-ready web application.

## Product Vision
- Give compliance teams a guided workflow to create SMCR maps, fitness & propriety assessments, FCA references, and certification packs without hiring consultants.
- Provide instant clarity through automated visuals (scorecards, charts, timelines) so outputs feel board-ready.
- Keep the UI aspirational—calm premium palette, generous white space, confident typography inspired by IvO and Fountain references.

## Initial Architecture Decisions
| Area | Direction |
| --- | --- |
| Framework | **Next.js (App Router) + TypeScript** for interactive experience, server actions, and Vercel-native deployment. |
| Styling | **Tailwind CSS** powered by shared tokens (`smcr-app/design/tokens.json`); Radix primitives can be layered in later for accessibility wins. |
| State | **Zustand** store for complex wizard state (firm profile, SMFs, PRs, F&P answers, certification status). |
| Data Layer | **Drizzle ORM** targeting **Neon Postgres**; API routes expose a typed contract that future MEMA services can consume. |
| Charts | **Recharts** (already used in prototype) wrapped in reusable `InsightCard` components. |
| Auth | Start with MEMA email magic-link placeholder; plan to swap in MEMA SSO when specs arrive. |
| Integrations | Configurable base URLs for `vulnerability.memaconsultants.com` and `fcafines.memaconsultants.com`, surfaced as contextual actions. |

## Workspace Layout
```
/README.md                  – quick orientation
/docs/architecture.md       – deeper technical + UX blueprint
/docs/roadmap.md            – phased delivery plan + task backlog
/smcr-app/                  – live Next.js + Tailwind workspace
/smcr-app/design/tokens.json – color, typography, spacing primitives
smcr1.html                  – original prototype snapshot for reference
```

## Next Steps
1. Confirm design tokens + typography choices in `smcr-app/design/tokens.json`.
2. Flesh out shared UI primitives (buttons, shell, chart cards) so the wizard can reuse consistent building blocks.
3. Componentize the prototype flows (Firm Profile → SMFs → Responsibilities → Fitness & Propriety → Reports).
4. Layer in mock API routes + Neon schema so the UI can hydrate from example data.
5. Connect to MEMA suite once endpoints and auth model are ready.

## Data Layer Quickstart
1. Duplicate `smcr-app/.env.example` to `smcr-app/.env` and paste your Neon connection string (never commit the real value).
2. From `smcr-app/`, run `npm run db:push` to sync the Drizzle schema (`src/lib/schema.ts`) into Neon.
3. Use `npm run db:studio` for a quick visual inspector while prototyping.
4. Import the database client via `getDb()` from `src/lib/db.ts` inside API routes or server components when you are ready to persist wizard data.

Refer to `/docs/architecture.md` and `/docs/roadmap.md` for details. Let me know if anything here should change before we scaffold the actual app.
