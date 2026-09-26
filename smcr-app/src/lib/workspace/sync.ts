import type { Workspace } from "./schema";

export type SyncResult = { ok: true; id: string; updatedAt: string } | { ok: false; error: string; status?: number };

async function call(url: string, init: RequestInit): Promise<SyncResult> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error ?? `HTTP ${res.status}`, status: res.status };
    return { ok: true, id: body.id, updatedAt: body.updatedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Creates the workspace on the server if it has no id yet, otherwise updates it. */
export function saveRemote(ws: Workspace, serverId?: string): Promise<SyncResult> {
  return serverId
    ? call(`/api/workspaces/${serverId}`, { method: "PUT", body: JSON.stringify({ workspace: ws }) })
    : call("/api/workspaces", { method: "POST", body: JSON.stringify({ workspace: ws }) });
}

export async function loadRemote(id: string): Promise<{ ok: true; workspace: Workspace } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/workspaces/${id}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: body.error ?? `HTTP ${res.status}` };
    return { ok: true, workspace: body.workspace };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export async function deleteRemote(id: string): Promise<boolean> {
  const res = await fetch(`/api/workspaces/${id}`, { method: "DELETE" }).catch(() => null);
  return !!res?.ok;
}
