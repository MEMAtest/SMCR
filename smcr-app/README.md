# SM&CR Studio

A workspace for FCA solo-regulated firms to set up and run the Senior Managers & Certification Regime: firm categorisation, senior managers and prescribed responsibilities, fitness & propriety, Statements of Responsibilities and the responsibilities map, and the year-round registers (certification, Conduct Rules, regulatory references, reasonable steps, handovers) with an obligations calendar. Claude-powered drafting and a handbook assistant are built in.

> The regulatory reference data is a **versioned rules pack** (`src/lib/rules/fca-solo.ts`, currently `fca-solo-2026.09`, reflecting PS26/6). Items that could not be confirmed against the live FCA Handbook are flagged `verify` in the data and shown with a "verify" badge in the UI. Have the pack reviewed by a compliance professional before relying on it.

## Getting started

```bash
npm install
cp .env.example .env   # all settings optional
npm run dev            # http://localhost:3000
```

| Setting | Effect |
|---|---|
| none | Fully usable; the workspace is saved in the browser (localStorage). Use **Backup / Import** to move it. |
| `DATABASE_URL` | Enables **Save to server**, auto-save and shareable links (`/workspace?w=<id>`). Run `npm run db:push` once to create the `workspaces` table. |
| `ANTHROPIC_API_KEY` | Enables AI SoR drafting, the handbook assistant and gap review. `ANTHROPIC_MODEL` overrides the default model. |

There is **no login**. A saved workspace is reachable by anyone who has its link (an unguessable UUID); there is no endpoint that lists workspaces. Don't share links beyond the people who should see the data, and note that F&P answers can contain special-category personal data.

## Scripts

- `npm run dev` / `npm run build` / `npm start`
- `npm test` — unit tests for categorisation, PR applicability, F&P logic, deadlines and the API
- `npm run typecheck`, `npm run lint`
- `npm run db:push` — sync the Drizzle schema (`src/lib/schema.ts`)

## Architecture

- **One document per firm.** `src/lib/workspace/schema.ts` defines the whole workspace as a zod schema. The client store (`src/stores/useWorkspace.ts`, Zustand + immer + persist) holds it; the API stores it as one JSONB row (`/api/workspaces`, `/api/workspaces/[id]`), so every save is atomic and validated.
- **Rules as data.** `src/lib/rules/fca-solo.ts` holds categories and thresholds, PRs, SMFs, certification functions, Conduct Rules, FIT questions (each with its adverse answer) and deadlines. Update the pack, not the UI, when rules change.
- **Derived logic.** `src/lib/workspace/derive.ts` (applicable PRs/SMFs, F&P status, SoR model), `health.ts` (gap checks and wizard step validation), `obligations.ts` (dated obligations and `.ics` export).
- **AI.** `src/app/api/ai/*` calls Claude with the rules pack as grounded context and structured outputs. Personal F&P answers are never sent; AI drafts must be accepted by a named reviewer and are logged.

## Upgrading from the earlier prototype

The old `firms` / `individuals` / `responsibilities` / `fitness_assessments` / `certifications` tables are no longer used. `npm run db:push` will offer to drop them; earlier drafts could not be saved reliably, so there is nothing to migrate.
