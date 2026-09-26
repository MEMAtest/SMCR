import { afterEach, describe, expect, it } from "vitest";
import { emptyWorkspace } from "@/lib/workspace/schema";
import { readWorkspace } from "./_shared";
import { POST } from "./route";
import { GET } from "./[id]/route";

const req = (body: string) => new Request("http://localhost/api/workspaces", { method: "POST", body });

describe("workspace API", () => {
  const original = process.env.DATABASE_URL;
  afterEach(() => {
    process.env.DATABASE_URL = original;
  });

  it("returns 503 (not 500) when no database is configured", async () => {
    delete process.env.DATABASE_URL;
    const res = await POST(req(JSON.stringify({ workspace: emptyWorkspace() })));
    expect(res.status).toBe(503);
  });

  it("rejects malformed JSON and invalid documents", async () => {
    const bad = await readWorkspace(req("{not json"));
    expect("error" in bad && bad.error.status).toBe(400);
    const invalid = await readWorkspace(req(JSON.stringify({ workspace: { people: [{ id: 1 }] } })));
    expect("error" in invalid && invalid.error.status).toBe(422);
  });

  it("accepts a valid document and applies defaults", async () => {
    const ok = await readWorkspace(req(JSON.stringify({ workspace: { firm: { name: "Acme" } } })));
    expect("ws" in ok && ok.ws.firm.name).toBe("Acme");
  });

  it("rejects oversized bodies", async () => {
    const huge = await readWorkspace(req("x".repeat(2_000_001)));
    expect("error" in huge && huge.error.status).toBe(413);
  });

  it("404s non-UUID ids without touching the database", async () => {
    process.env.DATABASE_URL = "postgres://unused";
    const res = await GET(new Request("http://localhost"), { params: { id: "ind-123" } });
    expect(res.status).toBe(404);
  });
});
