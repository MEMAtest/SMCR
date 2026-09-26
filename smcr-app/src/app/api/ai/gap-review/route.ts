import { NextResponse } from "next/server";
import { CACHED_SYSTEM, GAP_REVIEW_INSTRUCTIONS } from "@/lib/ai/prompts";
import { normaliseSourceId } from "@/lib/ai/rulesContext";
import { GapReviewOutputSchema, GapReviewRequestSchema, MAX_CONTEXT_CHARS, type GapReviewResponse } from "@/lib/ai/schemas";
import { aiError, callStructured, checkRateLimit, clampText, isAiConfigured, notConfigured, rateLimited, readJsonBody } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/ai/gap-review — prioritised action plan from name-free health issues and obligations. */
export async function POST(request: Request) {
  if (!isAiConfigured()) return notConfigured();
  const wait = checkRateLimit(request);
  if (wait) return rateLimited(wait);

  const body = await readJsonBody(request, GapReviewRequestSchema);
  if ("error" in body) return body.error;
  const serialised = JSON.stringify(body.data, null, 1);
  if (serialised.length > MAX_CONTEXT_CHARS) return aiError(413, "too_large", "There are too many open items to review at once.");

  const result = await callStructured({
    cachedSystem: CACHED_SYSTEM,
    instructions: GAP_REVIEW_INSTRUCTIONS,
    user: `<workspace_gaps>\n${serialised}\n</workspace_gaps>\n\nProduce the prioritised action plan.`,
    schema: GapReviewOutputSchema,
  });
  if (!result.ok) return result.response;

  let unverifiedCitations = 0;
  const order = { now: 0, next: 1, later: 2 } as const;
  const actions = result.data.actions
    .slice(0, 15)
    .map((a) => {
      const ids: string[] = [];
      for (const raw of a.sourceIds) {
        const id = normaliseSourceId(raw);
        if (!id) unverifiedCitations++;
        else if (!ids.includes(id)) ids.push(id);
      }
      return { title: clampText(a.title, 200), why: clampText(a.why, 800), sourceIds: ids.slice(0, 8), priority: a.priority, area: a.area };
    })
    .sort((a, b) => order[a.priority] - order[b.priority]);

  const response: GapReviewResponse = {
    summary: clampText(result.data.summary.trim(), 1500),
    actions,
    unverifiedCitations,
    model: result.model,
  };
  return NextResponse.json(response);
}
