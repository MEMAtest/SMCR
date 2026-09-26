import { NextResponse } from "next/server";
import { CACHED_SYSTEM, SOR_DRAFT_INSTRUCTIONS } from "@/lib/ai/prompts";
import { MAX_CONTEXT_CHARS, SorDraftOutputSchema, SorDraftRequestSchema, type SorDraftResponse } from "@/lib/ai/schemas";
import { aiError, callStructured, checkRateLimit, clampText, isAiConfigured, notConfigured, rateLimited, readJsonBody } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/ai/sor-draft — propose "additional responsibilities" wording for one SoR. */
export async function POST(request: Request) {
  if (!isAiConfigured()) return notConfigured();
  const wait = checkRateLimit(request);
  if (wait) return rateLimited(wait);

  const body = await readJsonBody(request, SorDraftRequestSchema);
  if ("error" in body) return body.error;
  const input = body.data;
  const serialised = JSON.stringify(input, null, 1);
  if (serialised.length > MAX_CONTEXT_CHARS) return aiError(413, "too_large", "This Statement of Responsibilities is too long to draft from. Shorten the existing text and try again.");

  const result = await callStructured({
    cachedSystem: CACHED_SYSTEM,
    instructions: SOR_DRAFT_INSTRUCTIONS,
    user: `<sor_input>\n${serialised}\n</sor_input>\n\nDraft the additional responsibilities / scope wording for this senior manager's SoR.`,
    schema: SorDraftOutputSchema,
  });
  if (!result.ok) return result.response;

  const response: SorDraftResponse = {
    draft: clampText(result.data.draft.trim(), 8000),
    rationale: result.data.rationale.slice(0, 10).map((r) => clampText(r, 600)),
    gaps: result.data.gaps.slice(0, 20).map((g) => clampText(g, 600)),
    model: result.model,
  };
  return NextResponse.json(response);
}
