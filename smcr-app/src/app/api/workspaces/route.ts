import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { workspaces } from "@/lib/schema";
import { hasDatabase, noDatabase, readWorkspace } from "./_shared";

/** POST /api/workspaces — create a workspace; returns its id. */
export async function POST(request: Request) {
  if (!hasDatabase()) return noDatabase();
  const result = await readWorkspace(request);
  if ("error" in result) return result.error;
  const { ws } = result;

  try {
    const [row] = await getDb()
      .insert(workspaces)
      .values({ firmName: ws.firm.name, rulesVersion: ws.rulesVersion, data: ws })
      .returning({ id: workspaces.id, updatedAt: workspaces.updatedAt });
    return NextResponse.json({ id: row.id, updatedAt: row.updatedAt.toISOString() }, { status: 201 });
  } catch (error) {
    console.error("Failed to create workspace", error);
    return NextResponse.json({ error: "Failed to save workspace" }, { status: 500 });
  }
}
