"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Cloud, CloudOff, Download, Link2, Loader2, RotateCcw, Upload } from "lucide-react";
import { useHydrated, useWorkspace } from "@/stores/useWorkspace";
import { loadRemote, saveRemote } from "@/lib/workspace/sync";
import { WorkspaceSchema } from "@/lib/workspace/schema";
import { Button, downloadFile, slugify } from "@/components/ui";

const AUTOSAVE_DELAY_MS = 2000;

/** Loads `?w=<id>` into the store and auto-saves to the server once a workspace has a server id. */
export function WorkspaceSync() {
  const hydrated = useHydrated();
  const params = useSearchParams();
  const ws = useWorkspace((s) => s.ws);
  const serverId = useWorkspace((s) => s.serverId);
  const { replace, setServerState } = useWorkspace.getState();
  const [loadError, setLoadError] = useState<string>();
  const lastSaved = useRef<string | undefined>(undefined);

  // Load a shared workspace link.
  const linkId = params.get("w");
  useEffect(() => {
    if (!hydrated || !linkId || linkId === useWorkspace.getState().serverId) return;
    const local = useWorkspace.getState();
    if (local.ws.people.length > 0 && !local.serverId) {
      const ok = window.confirm("Open the shared workspace? Unsaved work in this browser that isn't saved to the server will be replaced.");
      if (!ok) return;
    }
    loadRemote(linkId).then((res) => {
      if (res.ok) {
        replace(res.workspace, linkId);
        lastSaved.current = res.workspace.updatedAt;
        setServerState({ saveState: "saved", lastSavedAt: new Date().toISOString(), saveError: undefined });
      } else setLoadError(res.error);
    });
  }, [hydrated, linkId, replace, setServerState]);

  // Debounced auto-save once the workspace lives on the server.
  useEffect(() => {
    if (!hydrated || !serverId || ws.updatedAt === lastSaved.current) return;
    const t = setTimeout(async () => {
      setServerState({ saveState: "saving" });
      const res = await saveRemote(ws, serverId);
      if (res.ok) {
        lastSaved.current = ws.updatedAt;
        setServerState({ saveState: "saved", lastSavedAt: res.updatedAt, saveError: undefined });
      } else setServerState({ saveState: "error", saveError: res.error });
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(t);
  }, [hydrated, serverId, ws, setServerState]);

  if (!loadError) return null;
  return (
    <div role="alert" className="fixed right-4 top-4 z-50 max-w-sm rounded-2xl border border-danger/50 bg-midnight px-4 py-3 text-sm text-sand shadow-elevated">
      Could not open the shared workspace: {loadError}
      <button className="ml-2 underline" onClick={() => setLoadError(undefined)}>
        Dismiss
      </button>
    </div>
  );
}

/** Save status, "save to server / copy link", JSON backup and reset. */
export function SaveControls() {
  const hydrated = useHydrated();
  const { ws, serverId, saveState, saveError, lastSavedAt } = useWorkspace();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!hydrated) return null;

  const saveToServer = async () => {
    setBusy(true);
    const res = await saveRemote(ws, serverId);
    setBusy(false);
    if (res.ok) useWorkspace.getState().setServerState({ serverId: res.id, saveState: "saved", lastSavedAt: res.updatedAt, saveError: undefined });
    else useWorkspace.getState().setServerState({ saveState: "error", saveError: res.error });
  };

  const copyLink = async () => {
    if (!serverId) return;
    await navigator.clipboard.writeText(`${window.location.origin}/workspace?w=${serverId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const exportJson = () => downloadFile(JSON.stringify(ws, null, 2), `smcr-${slugify(ws.firm.name)}.json`, "application/json");

  const importJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const parsed = WorkspaceSchema.parse(JSON.parse(await file.text()));
        if (window.confirm(`Replace the current workspace with "${parsed.firm.name || "imported workspace"}"?`)) useWorkspace.getState().replace(parsed, undefined);
      } catch {
        window.alert("That file is not a valid SM&CR workspace export.");
      }
    };
    input.click();
  };

  const reset = () => {
    if (window.confirm("Start a new, empty workspace? Export a backup first if you need this one.")) useWorkspace.getState().reset();
  };

  const status =
    saveState === "saving" ? (
      <span className="inline-flex items-center gap-1 text-sand/70"><Loader2 className="size-3.5 animate-spin" /> Saving…</span>
    ) : saveState === "error" ? (
      <span className="inline-flex items-center gap-1 text-warning" title={saveError}><CloudOff className="size-3.5" /> Server save failed — kept in this browser</span>
    ) : serverId ? (
      <span className="inline-flex items-center gap-1 text-emerald" title={lastSavedAt}><Cloud className="size-3.5" /> Saved to server</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-sand/70"><CloudOff className="size-3.5" /> Saved in this browser only</span>
    );

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span aria-live="polite">{status}</span>
      {serverId ? (
        <Button size="sm" variant="ghost" onClick={copyLink}><Link2 className="size-3.5" /> {copied ? "Link copied" : "Copy link"}</Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={saveToServer} disabled={busy || !ws.firm.name}>
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Cloud className="size-3.5" />} Save to server
        </Button>
      )}
      <Button size="sm" variant="ghost" onClick={exportJson} aria-label="Export backup"><Download className="size-3.5" /> Backup</Button>
      <Button size="sm" variant="ghost" onClick={importJson} aria-label="Import backup"><Upload className="size-3.5" /> Import</Button>
      <Button size="sm" variant="ghost" onClick={reset} aria-label="New workspace"><RotateCcw className="size-3.5" /> New</Button>
    </div>
  );
}
