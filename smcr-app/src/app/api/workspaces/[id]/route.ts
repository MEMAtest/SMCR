import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/schema";
import { WorkspaceSchema } from "@/lib/workspace/schema";
import { hasDatabase, noDatabase, readWorkspace, UUID_RE } from "../_shared";

type Params = { params: { id: string } };

function badId() {
  return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
}

export async function GET(_request: Request, { params }: Params) {
  if (!hasDatabase()) return noDatabase();
  if (!UUID_RE.test(params.id)) return badId();
  try {
    const [row] = await getDb().select().from(workspaces).where(eq(workspaces.id, params.id));
    if (!row) return badId();
    // Re-parse so documents saved by older versions gain new defaults.
    const parsed = WorkspaceSchema.safeParse(row.data);
    if (!parsed.success) return NextResponse.json({ error: "Stored workspace is invalid" }, { status: 500 });
    return NextResponse.json({ id: row.id, workspace: parsed.data, updatedAt: row.updatedAt.toISOString() });
  } catch (error) {
    console.error("Failed to load workspace", error);
    return NextResponse.json({ error: "Failed to load workspace" }, { status: 500 });
  }
}

/** PUT replaces the whole document in a single statement. */
export async function PUT(request: Request, { params }: Params) {
  if (!hasDatabase()) return noDatabase();
  if (!UUID_RE.test(params.id)) return badId();
  const result = await readWorkspace(request);
  if ("error" in result) return result.error;
  const { ws } = result;
  try {
    const rows = await getDb()
      .update(workspaces)
      .set({ data: ws, firmName: ws.firm.name, rulesVersion: ws.rulesVersion, updatedAt: new Date() })
      .where(eq(workspaces.id, params.id))
      .returning({ id: workspaces.id, updatedAt: workspaces.updatedAt });
    if (!rows.length) return badId();
    return NextResponse.json({ id: rows[0].id, updatedAt: rows[0].updatedAt.toISOString() });
  } catch (error) {
    console.error("Failed to update workspace", error);
    return NextResponse.json({ error: "Failed to save workspace" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  if (!hasDatabase()) return noDatabase();
  if (!UUID_RE.test(params.id)) return badId();
  try {
    await getDb().delete(workspaces).where(eq(workspaces.id, params.id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete workspace", error);
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}
