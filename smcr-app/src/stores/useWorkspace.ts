"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useEffect, useState } from "react";
import {
  emptyFitAssessment,
  emptyWorkspace,
  newId,
  PersonSchema,
  WorkspaceSchema,
  type FitAnswerRecord,
  type Firm,
  type Person,
  type Workspace,
} from "@/lib/workspace/schema";
import { todayISO } from "@/lib/workspace/dates";

export type SaveState = "local" | "saving" | "saved" | "error";

type WorkspaceStore = {
  ws: Workspace;
  /** Server row id once the workspace has been saved to the database. */
  serverId?: string;
  lastSavedAt?: string;
  saveState: SaveState;
  saveError?: string;

  /** Generic mutation — use for anything without a dedicated action. */
  update: (recipe: (draft: Workspace) => void) => void;
  replace: (ws: Workspace, serverId?: string) => void;
  reset: () => void;
  setServerState: (patch: { serverId?: string; lastSavedAt?: string; saveState?: SaveState; saveError?: string }) => void;

  setFirm: (patch: Partial<Firm>) => void;
  addPerson: (init?: Partial<Person>) => string;
  updatePerson: (id: string, recipe: (p: Person) => void) => void;
  removePerson: (id: string) => void;
  setPrOwner: (prId: string, ownerId: string | undefined) => void;
  setFitAnswer: (personId: string, questionId: string, patch: Partial<FitAnswerRecord>) => void;
  markObligationDone: (key: string, done: boolean) => void;
};

function touch(draft: Workspace) {
  draft.updatedAt = new Date().toISOString();
}

export const useWorkspace = create<WorkspaceStore>()(
  persist(
    immer((set) => ({
      ws: emptyWorkspace(),
      serverId: undefined,
      lastSavedAt: undefined,
      saveState: "local",
      saveError: undefined,

      update: (recipe) =>
        set((state) => {
          recipe(state.ws);
          touch(state.ws);
        }),

      replace: (ws, serverId) =>
        set((state) => {
          state.ws = WorkspaceSchema.parse(ws);
          if (serverId !== undefined) state.serverId = serverId;
        }),

      reset: () =>
        set((state) => {
          state.ws = emptyWorkspace();
          state.serverId = undefined;
          state.lastSavedAt = undefined;
          state.saveState = "local";
          state.saveError = undefined;
        }),

      setServerState: (patch) =>
        set((state) => {
          Object.assign(state, patch);
        }),

      setFirm: (patch) =>
        set((state) => {
          Object.assign(state.ws.firm, patch);
          touch(state.ws);
        }),

      addPerson: (init) => {
        const id = newId("person");
        set((state) => {
          state.ws.people.push(PersonSchema.parse({ name: "", ...init, id }));
          touch(state.ws);
        });
        return id;
      },

      updatePerson: (id, recipe) =>
        set((state) => {
          const p = state.ws.people.find((x) => x.id === id);
          if (p) recipe(p);
          touch(state.ws);
        }),

      removePerson: (id) =>
        set((state) => {
          const ws = state.ws;
          ws.people = ws.people.filter((p) => p.id !== id);
          for (const alloc of Object.values(ws.responsibilities)) {
            if (alloc.ownerId === id) alloc.ownerId = undefined;
            alloc.sharedWithIds = alloc.sharedWithIds.filter((x) => x !== id);
          }
          for (const o of ws.otherResponsibilities) if (o.ownerId === id) o.ownerId = undefined;
          for (const c of ws.mrm.committees) {
            if (c.chairId === id) c.chairId = undefined;
            c.memberIds = c.memberIds.filter((x) => x !== id);
          }
          delete ws.fitness[id];
          delete ws.sors[id];
          ws.certificates = ws.certificates.filter((c) => c.personId !== id);
          ws.training = ws.training.filter((t) => t.personId !== id);
          ws.breaches = ws.breaches.filter((b) => b.personId !== id);
          ws.reasonableSteps = ws.reasonableSteps.filter((r) => r.personId !== id);
          ws.references = ws.references.filter((r) => r.personId !== id);
          ws.handovers = ws.handovers.filter((h) => h.fromPersonId !== id);
          for (const h of ws.handovers) if (h.toPersonId === id) h.toPersonId = undefined;
          touch(ws);
        }),

      setPrOwner: (prId, ownerId) =>
        set((state) => {
          const alloc = (state.ws.responsibilities[prId] ??= { sharedWithIds: [], notes: "" });
          alloc.ownerId = ownerId;
          alloc.sharedWithIds = alloc.sharedWithIds.filter((x) => x !== ownerId);
          touch(state.ws);
        }),

      setFitAnswer: (personId, questionId, patch) =>
        set((state) => {
          const assessment = (state.ws.fitness[personId] ??= emptyFitAssessment());
          const rec = (assessment.answers[questionId] ??= { details: "", evidence: "" });
          Object.assign(rec, patch);
          touch(state.ws);
        }),

      markObligationDone: (key, done) =>
        set((state) => {
          if (done) state.ws.obligationsDone[key] = todayISO();
          else delete state.ws.obligationsDone[key];
          touch(state.ws);
        }),
    })),
    {
      name: "smcr-workspace-v2",
      version: 2,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({ ws: s.ws, serverId: s.serverId, lastSavedAt: s.lastSavedAt }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<WorkspaceStore>;
        const parsed = WorkspaceSchema.safeParse(p.ws ?? {});
        return {
          ...current,
          ws: parsed.success ? parsed.data : current.ws,
          serverId: p.serverId,
          lastSavedAt: p.lastSavedAt,
          saveState: p.serverId ? "saved" : "local",
        };
      },
    },
  ),
);

let hydrationStarted = false;

/** The persist API only exists in the browser (no localStorage on the server). */
function persistApi() {
  return typeof window === "undefined" ? undefined : useWorkspace.persist;
}

/**
 * Returns true once the persisted workspace has been loaded from localStorage.
 * Render placeholders until then to avoid SSR hydration mismatches.
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const api = persistApi();
    if (!api) return;
    const unsub = api.onFinishHydration(() => setHydrated(true));
    if (!hydrationStarted) {
      hydrationStarted = true;
      void api.rehydrate();
    }
    if (api.hasHydrated()) setHydrated(true);
    return unsub;
  }, []);
  return hydrated;
}

/** Stable "today" for the session (ISO date). */
export function useToday(): string {
  const [today] = useState(todayISO);
  return today;
}
