// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { emptyWorkspace, type Workspace } from "@/lib/workspace/schema";
import { richWorkspace } from "./fixture";

/* ---------- Next.js shims ---------- */
const nav = vi.hoisted(() => ({ search: "", path: "/workspace" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => nav.path,
  useRouter: () => ({
    push: (href: string) => {
      const [p, q] = href.split("?");
      nav.path = p || nav.path;
      nav.search = q ?? "";
    },
    replace: (href: string) => {
      const [p, q] = href.split("?");
      nav.path = p || nav.path;
      nav.search = q ?? "";
    },
    back: () => {},
    prefetch: () => {},
    refresh: () => {},
  }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, scroll, prefetch, replace, ...rest }: { href: string; children: ReactNode; scroll?: boolean; prefetch?: boolean; replace?: boolean }) => {
    void [scroll, prefetch, replace];
    return (
    <a href={typeof href === "string" ? href : "#"} {...rest}>
      {children}
    </a>
    );
  },
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));

/* ---------- helpers ---------- */
const errors: string[] = [];
beforeEach(() => {
  errors.length = 0;
  vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
    errors.push(args.map(String).join(" "));
  });
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

async function seed(ws: Workspace) {
  localStorage.setItem("smcr-workspace-v2", JSON.stringify({ state: { ws }, version: 2 }));
  const { useWorkspace } = await import("@/stores/useWorkspace");
  await act(async () => {
    await useWorkspace.persist.rehydrate();
  });
}

async function renderPage(Page: ComponentType, path: string, search = "") {
  nav.path = path;
  nav.search = search;
  const { AppShell } = await import("@/components/shell/AppShell");
  const utils = render(
    <AppShell>
      <Page />
    </AppShell>,
  );
  await waitFor(() => expect(screen.queryByLabelText("Loading workspace")).toBeNull());
  return utils;
}

const reactErrors = () => errors.filter((e) => !e.includes("not wrapped in act"));

const PAGES: [string, string, () => Promise<ComponentType>][] = [
  ["/workspace", "", async () => (await import("@/components/dashboard/Dashboard")).Dashboard],
  ["/workspace/documents", "tab=sor&person=ceo", async () => (await import("@/components/documents/DocumentsPage")).DocumentsPage],
  ["/workspace/documents", "tab=mrm", async () => (await import("@/components/documents/DocumentsPage")).DocumentsPage],
  ["/workspace/documents", "tab=board", async () => (await import("@/components/documents/DocumentsPage")).DocumentsPage],
  ["/workspace/certification", "", async () => (await import("@/components/registers/CertificationPage")).CertificationPage],
  ["/workspace/conduct", "", async () => (await import("@/components/registers/ConductPage")).ConductPage],
  ["/workspace/conduct", "tab=breaches", async () => (await import("@/components/registers/ConductPage")).ConductPage],
  ["/workspace/references", "", async () => (await import("@/components/registers/ReferencesPage")).ReferencesPage],
  ["/workspace/reasonable-steps", "", async () => (await import("@/components/registers/ReasonableStepsPage")).ReasonableStepsPage],
  ["/workspace/handover", "", async () => (await import("@/components/registers/HandoverPage")).HandoverPage],
  ["/workspace/calendar", "", async () => (await import("@/components/dashboard/CalendarPage")).CalendarPage],
  ["/workspace/assistant", "", async () => (await import("@/components/ai/AssistantPage")).AssistantPage],
  ...(["firm", "people", "responsibilities", "fitness", "documents"] as const).map(
    (step) => ["/builder", `step=${step}${step === "fitness" ? "&person=cfo" : ""}`, async () => (await import("@/components/builder/BuilderWizard")).BuilderWizard] as [string, string, () => Promise<ComponentType>],
  ),
];

describe("every page renders with a rich workspace", () => {
  it.each(PAGES)("%s?%s", async (path, search, load) => {
    await seed(richWorkspace());
    await renderPage(await load(), path, search);
    expect(document.body.textContent).toContain("Harbour & Vale");
    expect(reactErrors()).toEqual([]);
  });
});

describe("every page renders with an empty workspace", () => {
  it.each(PAGES)("%s?%s", async (path, search, load) => {
    await seed(emptyWorkspace());
    await renderPage(await load(), path, search);
    expect(reactErrors()).toEqual([]);
  });
});

describe("key flows", () => {
  it("wizard gates Continue on the firm step until the firm is described", async () => {
    await seed(emptyWorkspace());
    const { BuilderWizard } = await import("@/components/builder/BuilderWizard");
    await renderPage(BuilderWizard, "/builder", "step=firm");
    const cont = screen.getAllByRole("button", { name: /continue/i })[0];
    expect(cont).toHaveProperty("disabled", true);
    const { useWorkspace } = await import("@/stores/useWorkspace");
    act(() => useWorkspace.getState().setFirm({ name: "Test Firm", sector: "financial_adviser" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: /continue/i })[0]).toHaveProperty("disabled", false));
  });

  it("F&P shows an adverse 'yes' to convictions as needing an explanation", async () => {
    await seed(richWorkspace());
    const { BuilderWizard } = await import("@/components/builder/BuilderWizard");
    await renderPage(BuilderWizard, "/builder", "step=fitness&person=cfo");
    expect(document.body.textContent?.toLowerCase()).toMatch(/explain|explanation/);
  });

  it("the responsibilities step lists only PRs that apply", async () => {
    const ws = richWorkspace();
    ws.firm.aumGbpBn = null;
    ws.firm.holdsClientAssets = false;
    ws.firm.isAfm = false;
    await seed(ws);
    const { BuilderWizard } = await import("@/components/builder/BuilderWizard");
    await renderPage(BuilderWizard, "/builder", "step=responsibilities");
    const text = document.body.textContent ?? "";
    expect(text).toContain("Financial crime");
    expect(text).not.toContain("Business model");
    expect(text).not.toContain("Client assets (CASS)");
  });

  it("calendar marks an obligation done", async () => {
    await seed(richWorkspace());
    const { CalendarPage } = await import("@/components/dashboard/CalendarPage");
    await renderPage(CalendarPage, "/workspace/calendar");
    const buttons = screen.getAllByRole("button", { name: /mark .*done/i });
    const { useWorkspace } = await import("@/stores/useWorkspace");
    const before = Object.keys(useWorkspace.getState().ws.obligationsDone).length;
    fireEvent.click(buttons[0]);
    expect(Object.keys(useWorkspace.getState().ws.obligationsDone).length).toBe(before + 1);
  });
});
