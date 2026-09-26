import { NextResponse } from "next/server";
import { ASK_INSTRUCTIONS, CACHED_SYSTEM } from "@/lib/ai/prompts";
import { normaliseSourceId } from "@/lib/ai/rulesContext";
import { AskOutputSchema, AskRequestSchema, type AskResponse } from "@/lib/ai/schemas";
import { callStructured, checkRateLimit, clampText, isAiConfigured, notConfigured, rateLimited, readJsonBody } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /api/ai/ask — answer a question from the rules pack + a name-free workspace summary. */
export async function POST(request: Request) {
  if (!isAiConfigured()) return notConfigured();
  const wait = checkRateLimit(request);
  if (wait) return rateLimited(wait);

  const body = await readJsonBody(request, AskRequestSchema);
  if ("error" in body) return body.error;
  const { question, context } = body.data;

  const result = await callStructured({
    cachedSystem: CACHED_SYSTEM,
    instructions: ASK_INSTRUCTIONS,
    user: `${context}\n\n<question>\n${question}\n</question>`,
    schema: AskOutputSchema,
  });
  if (!result.ok) return result.response;

  // Keep only citations that resolve to a real rules-pack entry (deduplicated).
  const seen = new Set<string>();
  let unverifiedCitations = 0;
  const citations: AskResponse["citations"] = [];
  for (const c of result.data.citations) {
    const id = normaliseSourceId(c.sourceId);
    if (!id) {
      unverifiedCitations++;
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    citations.push({ sourceId: id, note: clampText(c.note, 400) });
  }

  const response: AskResponse = {
    answer: clampText(result.data.answer.trim(), 8000),
    citations: citations.slice(0, 20),
    confidence: result.data.confidence,
    outOfScope: result.data.outOfScope,
    followUps: result.data.followUps.slice(0, 3).map((f) => clampText(f, 200)),
    unverifiedCitations,
    model: result.model,
  };
  return NextResponse.json(response);
}
