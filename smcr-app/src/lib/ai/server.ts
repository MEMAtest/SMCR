/**
 * Server-only helpers for the AI routes: credentials, abuse limits, and a
 * single structured-output call wrapper with robust error handling.
 *
 * Do not import from client components — it reads server environment variables.
 */
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { MAX_BODY_CHARS, type AiErrorBody, type AiErrorCode } from "./schemas";

export const DEFAULT_MODEL = "claude-opus-5";

export function aiModel(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

export function isAiConfigured(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY?.trim() || process.env.ANTHROPIC_AUTH_TOKEN?.trim());
}

let cachedClient: Anthropic | null = null;
function getClient(): Anthropic {
  // new Anthropic() resolves ANTHROPIC_API_KEY / ANTHROPIC_AUTH_TOKEN from the environment.
  cachedClient ??= new Anthropic({ timeout: 110_000, maxRetries: 2 });
  return cachedClient;
}

export function aiError(status: number, code: AiErrorCode, error: string, model?: string) {
  const body: AiErrorBody = { error, code, ...(model ? { model } : {}) };
  return NextResponse.json(body, { status });
}

export function notConfigured() {
  return aiError(
    503,
    "ai_not_configured",
    "AI features are not configured on this server. Set ANTHROPIC_API_KEY in the server environment to enable them.",
  );
}

/* ----------------------------- Rate limiting ----------------------------- */

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 20;
const hits = new Map<string, number[]>();

function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Simple in-memory sliding window per IP (per server instance). Returns seconds to wait, or 0. */
export function checkRateLimit(request: Request, now = Date.now()): number {
  const ip = clientIp(request);
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_REQUESTS) {
    hits.set(ip, recent);
    return Math.max(1, Math.ceil((WINDOW_MS - (now - recent[0])) / 1000));
  }
  recent.push(now);
  hits.set(ip, recent);
  // Opportunistic cleanup so the map cannot grow without bound.
  if (hits.size > 5000) {
    for (const [k, v] of hits) if (!v.some((t) => now - t < WINDOW_MS)) hits.delete(k);
  }
  return 0;
}

export function rateLimited(retryAfter: number) {
  const res = aiError(429, "rate_limited", `Too many AI requests. Please wait about ${Math.ceil(retryAfter / 60)} minute(s) and try again.`);
  res.headers.set("Retry-After", String(retryAfter));
  return res;
}

/* ----------------------------- Body parsing ------------------------------ */

export async function readJsonBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ data: z.infer<T> } | { error: NextResponse }> {
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return { error: aiError(400, "invalid_request", "Could not read the request body.") };
  }
  if (raw.length > MAX_BODY_CHARS) return { error: aiError(413, "too_large", "The request is too large.") };
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: aiError(400, "invalid_request", "Invalid JSON.") };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const where = first?.path?.length ? ` (${first.path.join(".")})` : "";
    return { error: aiError(400, "invalid_request", `${first?.message ?? "Invalid request"}${where}`) };
  }
  return { data: parsed.data };
}

/* --------------------------- Structured call ----------------------------- */

export interface StructuredCallArgs<T extends z.ZodType> {
  /** Large stable text (rules pack) — cached. */
  cachedSystem: string;
  /** Short task instructions placed after the cached block. */
  instructions: string;
  user: string;
  schema: T;
  maxTokens?: number;
}

export type StructuredCallResult<T> = { ok: true; data: T; model: string } | { ok: false; response: NextResponse };

function fallbacksEnabled(): boolean {
  return (process.env.ANTHROPIC_FALLBACKS ?? "default").trim().toLowerCase() !== "off";
}

export async function callStructured<T extends z.ZodType>(args: StructuredCallArgs<T>): Promise<StructuredCallResult<z.infer<T>>> {
  const model = aiModel();
  let message: Anthropic.Beta.BetaMessage;
  try {
    const client = getClient();
    // Non-streaming create (not .parse) so stop_reason can be checked before
    // any attempt to parse output — .parse throws on truncated/refused text.
    message = await client.beta.messages.create({
      model,
      max_tokens: args.maxTokens ?? 16000,
      thinking: { type: "adaptive" },
      ...(fallbacksEnabled() ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
      system: [
        // Rules pack first and byte-stable, so it is served from the prompt cache.
        { type: "text", text: args.cachedSystem, cache_control: { type: "ephemeral" } },
        { type: "text", text: args.instructions },
      ],
      messages: [{ role: "user", content: args.user }],
      output_config: { format: betaZodOutputFormat(args.schema) },
    });
  } catch (err) {
    return { ok: false, response: mapError(err, model) };
  }

  const servedBy = message.model || model;

  if (message.stop_reason === "refusal") {
    return {
      ok: false,
      response: aiError(422, "refused", "The AI declined to answer this request. Try rephrasing it, or consult the FCA Handbook directly.", servedBy),
    };
  }
  if (message.stop_reason === "max_tokens") {
    return { ok: false, response: aiError(502, "truncated", "The AI response was cut off before it finished. Try a narrower request.", servedBy) };
  }

  // With fallbacks, the served answer is the last text block.
  const texts = message.content.filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text");
  const text = texts[texts.length - 1]?.text;
  if (!text) return { ok: false, response: aiError(502, "bad_output", "The AI returned no usable output. Please try again.", servedBy) };

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, response: aiError(502, "bad_output", "The AI returned malformed output. Please try again.", servedBy) };
  }
  const parsed = args.schema.safeParse(json);
  if (!parsed.success) {
    return { ok: false, response: aiError(502, "bad_output", "The AI output did not match the expected format. Please try again.", servedBy) };
  }
  return { ok: true, data: parsed.data, model: servedBy };
}

function mapError(err: unknown, model: string): NextResponse {
  // Most specific first — all of these extend Anthropic.APIError.
  if (err instanceof Anthropic.AuthenticationError || err instanceof Anthropic.PermissionDeniedError) {
    console.error("[ai] authentication failed", err.status);
    return aiError(503, "ai_auth_failed", "The server's AI credentials were rejected. An administrator needs to check ANTHROPIC_API_KEY.", model);
  }
  if (err instanceof Anthropic.RateLimitError) {
    return aiError(429, "upstream_rate_limited", "The AI service is busy right now. Please try again in a minute.", model);
  }
  if (err instanceof Anthropic.BadRequestError) {
    console.error("[ai] bad request", err.message);
    return aiError(502, "upstream_error", "The AI service rejected the request. Check the configured model (ANTHROPIC_MODEL).", model);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    console.error("[ai] connection error", err.message);
    return aiError(502, "upstream_error", "Could not reach the AI service. Please try again.", model);
  }
  if (err instanceof Anthropic.APIError) {
    console.error("[ai] API error", err.status, err.message);
    return aiError(502, "upstream_error", "The AI service returned an error. Please try again shortly.", model);
  }
  if (err instanceof Anthropic.AnthropicError) {
    // e.g. missing credentials detected by the SDK itself
    console.error("[ai] SDK error", err.message);
    return aiError(503, "ai_not_configured", "AI features are not configured correctly on this server.", model);
  }
  console.error("[ai] unexpected error", err);
  return aiError(500, "server_error", "Something went wrong generating the AI response.", model);
}

/* ------------------------------ Utilities -------------------------------- */

export function clampText(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}
