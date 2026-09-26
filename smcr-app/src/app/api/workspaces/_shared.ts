import { NextResponse } from "next/server";
import { WorkspaceSchema, type Workspace } from "@/lib/workspace/schema";

export const MAX_BODY_BYTES = 2_000_000;
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function hasDatabase(): boolean {
  return !!process.env.DATABASE_URL;
}

export function noDatabase() {
  return NextResponse.json(
    { error: "Server storage is not configured (DATABASE_URL). Your work is still saved in this browser." },
    { status: 503 },
  );
}

export async function readWorkspace(request: Request): Promise<{ ws: Workspace } | { error: NextResponse }> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return { error: NextResponse.json({ error: "Workspace is too large" }, { status: 413 }) };
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { error: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
  const parsed = WorkspaceSchema.safeParse((body as { workspace?: unknown })?.workspace);
  if (!parsed.success) {
    return {
      error: NextResponse.json(
        { error: "Workspace failed validation", issues: parsed.error.issues.slice(0, 10) },
        { status: 422 },
      ),
    };
  }
  return { ws: parsed.data };
}
