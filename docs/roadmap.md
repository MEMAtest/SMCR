# Delivery Roadmap

## Phase 0 – Foundation (Today → +2 days)
- ✅ Create workspace and capture prototype (`smcr1.html`).
- Finalize design tokens + branding guardrails.
- Approve tech stack + architecture blueprint.

## Phase 1 – Experience Scaffold (Week 1)
- Scaffold Next.js + Tailwind + Radix project.
- Implement marketing hero + onboarding CTA referencing MEMA logo + palette.
- Build WizardShell with persistent sidebar stepper + autosave indicator bar.
- Stub Zustand stores and sample JSON so UI renders without backend.

## Phase 2 – Core Flows (Week 2)
- `FirmProfileForm` with validation + FCA guidance tooltips.
- `SMFMatrix` + `ResponsibilityBoard` with drag-to-assign interactions and gap warnings.
- `FitnessChecklist` dynamic accordions w/ evidence uploads (local mock storage initially).
- `CertificationTracker` with timeline + due-date logic; integrate Recharts for visuals.

## Phase 3 – Data & Reporting (Week 3)
- ✅ Drizzle config + base Neon schema scaffolding (`src/lib/schema.ts`, `drizzle.config.ts`).
- API routes for saving drafts, generating summaries, and packaging report JSON.
- `ReportCanvas` that exports PDF (using `@react-pdf/renderer` or server-side PDF service) + share link stubs.

## Phase 4 – Integrations & Polish (Week 4)
- Add MEMA tool shortcuts (vulnerability + FCA fines) with context payloads.
- Hook up auth (interim email magic link) and role-based access.
- Accessibility + responsive QA, Lighthouse + a11y scans.
- Deploy to Vercel (preview + production), connect Neon production branch.

## Backlog / Enhancements
- AI assistant for drafting Reasonable Steps + fitness rationales.
- Workspace collaboration (comments, approvals, audit timeline).
- Bulk import/export for SMF data via CSV/Excel.

Use this roadmap to prioritize upcoming work; adjust timelines once dependencies (auth, integrations) are defined.
