/** Client-side fetch helper for the AI routes. Never handles credentials. */
import type { AiErrorBody, AiErrorCode } from "./schemas";

export type AiResult<T> = { ok: true; data: T } | { ok: false; status: number; code: AiErrorCode; error: string };

export async function postAi<T>(path: "/api/ai/sor-draft" | "/api/ai/ask" | "/api/ai/gap-review", body: unknown, signal?: AbortSignal): Promise<AiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    return { ok: false, status: 0, code: "network", error: "Could not reach the server. Check your connection and try again." };
  }
  let json: unknown = null;
  try {
    json = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) {
    const e = (json ?? {}) as Partial<AiErrorBody>;
    return {
      ok: false,
      status: res.status,
      code: e.code ?? (res.status === 429 ? "rate_limited" : "server_error"),
      error: e.error ?? `The AI request failed (HTTP ${res.status}).`,
    };
  }
  if (!json) return { ok: false, status: res.status, code: "bad_output", error: "The server returned an empty response." };
  return { ok: true, data: json as T };
}

/** ISO timestamp for AI log entries. */
export function nowIso(): string {
  return new Date().toISOString();
}

export function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
