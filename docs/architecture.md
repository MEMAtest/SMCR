# Architecture & Experience Blueprint

## 1. Experience Pillars
- **Premium Calm** – Deep teal + warm neutral palette, serif display headers (Playfair Display) with modern sans body (Inter). Subtle gradients + glass panels for hero/report sections.
- **Guided Compliance** – Multi-step wizard with clear "what" + "why" copy, always referencing FCA SMCR guidance links (SYSC, FIT, COND).
- **Explainable Outputs** – Every chart/table has context ("Based on SYSC 24.2.6R") and actionable next steps (export, share, push to MEMA tools).

Hero layout inspiration from IvO; dashboard/insight tiles adopt Fountain's clean cards and purple accent for charts.

## 2. Application Layers
1. **Presentation (Next.js + Tailwind)**
   - `app/(marketing)` – landing + storytelling, invites to start SMCR builder.
   - `app/(tool)/builder` – wizard shell (layout with steps, progress, contextual help).
   - `app/api/*` – REST endpoints for saving drafts, generating reports, eventually calling Neon + MEMA APIs.
2. **State Management**
   - `stores/firmProfile.ts` – firm metadata, SMCR category, solo vs. dual regulated.
   - `stores/responsibilities.ts` – assigned SMFs, responsibilities, audit trail.
   - `stores/fitness.ts` – answers to FIT questions, supporting docs, risk flags.
3. **Data Layer**
   - `src/lib/schema.ts` with tables: `firms`, `individuals`, `responsibilities`, `fitness_assessments`, `certifications` (expandable later to SMF matrix + reports).
   - Seed script with FCA reference data (PR list, SMF library, certification functions, FIT question bank).
   - `drizzle.config.ts` + `src/lib/db.ts` wire Neon to the app + CLI.
4. **Integration Layer**
   - `lib/http.ts` – fetch wrapper injecting MEMA auth headers.
   - `lib/mema.ts` – helper functions to deep-link to vulnerability + FCA fines tools with context (firm id, risk summary).

## 3. Component System
| Component | Purpose |
| --- | --- |
| `HeroGradient`, `ValuePropositionCard` | Marketing page hero with CTA + proof points. |
| `WizardShell` | Layout with sticky stepper, breadcrumb, save-state indicator. |
| `FirmProfileForm` | Step 1; selects firm type, category, location, CASS status. |
| `SMFMatrix` | Step 2; grid for mapping SMFs to individuals, includes tooltips + FCA refs. |
| `ResponsibilityBoard` | Step 3; drag-to-assign prescribed responsibilities, highlight gaps. |
| `FitnessChecklist` | Step 4; dynamic question accordions with evidence upload. |
| `CertificationTracker` | Step 5; timeline + status chips, export buttons. |
| `ReportCanvas` | Final; renders PDF-quality layout with charts (pie, stacked bar, timeline) using Recharts. |
| `InsightCard` | Reusable card with metric, mini-chart, action menu (share/download). |

### Schema Snapshot
- `firms` – perimeter info (type, SMCR category, jurisdictions, CASS flag).
- `individuals` – SMF holders tied to each firm.
- `responsibilities` – prescribed responsibilities, owners, and statuses.
- `fitness_assessments` – FIT questionnaire answers + evidence references.
- `certifications` – validity windows and document links.

`src/lib/db.ts` memoises a Neon HTTP client so API routes call `getDb()` without recreating a pool.

## 4. Design Tokens (see `smcr-app/design/tokens.json`)
- Colors derived from MEMA logo: `deepTeal`, `forestGreen`, `sand`, `mist`, `plumAccent` for charts.
- Spacing scale (4px base) and radii (soft 16px on hero cards, 12px on forms).
- Elevation levels (shadow steps) for premium depth.

## 5. Accessibility & Compliance
- WCAG AA minimum contrast; Tailwind tokens encoded in `tokens.json`.
- Keyboard navigation for wizard; `aria-live` announcements on validation errors.
- Inline citations referencing FCA sections (SYSC 24, FIT 2.*, COND). Use tooltip/popover for definitions.

## 6. Deployment Blueprint
1. **Local Dev** – `.env.local` for Neon connection string + MEMA endpoints.
2. **Neon** – Branch per environment; migrations via `drizzle-kit push` from CI.
3. **Vercel** – Monorepo deployment with preview branches; environment secrets stored in Vercel dashboard.
4. **Monitoring** – Enable Vercel Analytics + simple error logging (Sentry or Logtail) for compliance audit trail.

## 7. Open Questions
- Confirm authentication model (temporary magic link vs. MEMA SSO?).
- Determine export format requirements (PDF w/ FCA footer, CSV, DOCX?).
- Clarify whether vulnerability + FCA fines tools expect inbound webhooks or deep-links with query params.

This blueprint should unlock scaffolding the actual Next.js project; update as integration details emerge.
