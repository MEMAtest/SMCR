"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { BadgeCheck, Download, FileBadge, Printer } from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  Checkbox,
  EmptyState,
  Field,
  LoadingPanel,
  PageHeader,
  Panel,
  SectionTitle,
  Segmented,
  SeverityIcon,
  TextArea,
  TextInput,
  VerifyBadge,
  slugify,
} from "@/components/ui";
import { CERTIFICATION_FUNCTIONS, DEADLINES, RULES_META } from "@/lib/rules/fca-solo";
import { addMonths, daysBetween, formatDate } from "@/lib/workspace/dates";
import { certifiedPeople, fitnessStatus, getPerson } from "@/lib/workspace/derive";
import { newId, type Certificate, type Person, type Workspace } from "@/lib/workspace/schema";
import { useHydrated, useToday, useWorkspace } from "@/stores/useWorkspace";
import { downloadCSV } from "./csv";
import { FlashMessage, RegisterTable, Refs, sortByDateDesc, useFlash, usePrintable } from "./shared";

type CertStatus = "current" | "due_soon" | "expired" | "none" | "not_certified";

const STATUS_META: Record<CertStatus, { label: string; tone: "good" | "warn" | "bad" | "neutral" }> = {
  current: { label: "Current", tone: "good" },
  due_soon: { label: "Due within 30 days", tone: "warn" },
  expired: { label: "Expired", tone: "bad" },
  none: { label: "No certificate", tone: "bad" },
  not_certified: { label: "Not certified", tone: "bad" },
};

function functionTitle(id: string) {
  return CERTIFICATION_FUNCTIONS.find((f) => f.id === id)?.title ?? id;
}

function certsFor(ws: Workspace, personId: string): Certificate[] {
  return sortByDateDesc(
    ws.certificates.filter((c) => c.personId === personId),
    (c) => c.issuedOn,
  );
}

function certSummary(ws: Workspace, personId: string, today: string) {
  const all = certsFor(ws, personId);
  const latest = all[0];
  const latestCertified = all.find((c) => c.outcome === "certified");
  const expiresOn = latestCertified ? addMonths(latestCertified.issuedOn, DEADLINES.annualAssessmentMonths) : undefined;
  let status: CertStatus = "none";
  if (latest?.outcome === "not_certified") status = "not_certified";
  else if (expiresOn) {
    const days = daysBetween(today, expiresOn);
    status = days < 0 ? "expired" : days <= 30 ? "due_soon" : "current";
  }
  return { all, latest, latestCertified, expiresOn, status };
}

interface Check {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  href?: string;
}

function preflightChecks(ws: Workspace, person: Person): Check[] {
  const fit = fitnessStatus(ws, person.id);
  const outcome = ws.fitness[person.id]?.outcome;
  const fitOk = fit.complete && outcome !== "not_fit";
  const refs = ws.references.filter((r) => r.direction === "outgoing" && r.personId === person.id);
  const received = refs.filter((r) => r.status === "received");
  const outstanding = refs.filter((r) => r.status === "pending" || r.status === "chased");
  const adverse = received.filter((r) => r.adverse);
  const trained = ws.training.some((t) => t.personId === person.id && (t.topic === "conduct_rules" || t.topic === "senior_conduct_rules"));
  return [
    {
      id: "fit",
      label: "Fitness and propriety assessment complete, outcome recorded",
      ok: fitOk,
      detail: fit.complete
        ? outcome === "not_fit"
          ? "The recorded outcome is 'not fit' — a certificate should not normally be issued."
          : `Outcome: ${outcome === "fit_with_conditions" ? "fit with conditions" : "fit"} (assessed ${formatDate(ws.fitness[person.id]?.assessedOn)}).`
        : `${fit.answered}/${fit.total} questions answered${fit.unexplainedAdverse ? `, ${fit.unexplainedAdverse} adverse answer(s) unexplained` : ""}${fit.outcomeRecorded ? "" : ", outcome/assessor/date not recorded"}.`,
      href: `/builder?step=fitness&person=${person.id}`,
    },
    {
      id: "refs",
      label: "Regulatory references received (SYSC 22)",
      ok: received.length > 0 && outstanding.length === 0,
      detail: refs.length
        ? `${received.length} received, ${outstanding.length} outstanding${adverse.length ? `; ${adverse.length} contain adverse information — reflect in the F&P assessment` : ""}.`
        : "No reference requests recorded. If the person has no previous regulated employer, record why in the override note.",
      href: "/workspace/references",
    },
    {
      id: "training",
      label: "Conduct Rules training recorded",
      ok: trained,
      detail: trained ? "Training record found." : "No Conduct Rules training recorded for this person.",
      href: "/workspace/conduct?tab=training",
    },
  ];
}

/* --------------------------------- Issue form --------------------------------- */

function IssueForm({ person, onDone }: { person: Person; onDone: (msg: string) => void }) {
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const checks = preflightChecks(ws, person);
  const failed = checks.filter((c) => !c.ok);
  const [issuedOn, setIssuedOn] = useState(today);
  const [issuedBy, setIssuedBy] = useState("");
  const [outcome, setOutcome] = useState<"certified" | "not_certified">("certified");
  const [functionIds, setFunctionIds] = useState<string[]>(person.certificationFunctions);
  const [notes, setNotes] = useState("");
  const [override, setOverride] = useState(false);
  const [overrideNote, setOverrideNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const needsOverride = outcome === "certified" && failed.length > 0;

  const submit = () => {
    if (!issuedOn) return setError("Enter the date of the decision.");
    if (!issuedBy.trim()) return setError("Record who made the decision.");
    if (outcome === "certified" && functionIds.length === 0) return setError("Select at least one certification function covered.");
    if (needsOverride && (!override || overrideNote.trim().length < 10))
      return setError("Pre-flight checks failed. Tick the override box and explain why (at least 10 characters).");
    const noteParts = [notes.trim()];
    if (needsOverride) noteParts.push(`Pre-flight override (${failed.map((f) => f.id).join(", ")}): ${overrideNote.trim()}`);
    update((draft) => {
      draft.certificates.push({
        id: newId("cert"),
        personId: person.id,
        functionIds,
        issuedOn,
        issuedBy: issuedBy.trim(),
        outcome,
        notes: noteParts.filter(Boolean).join("\n").slice(0, 2000),
      });
    });
    onDone(outcome === "certified" ? `Certificate recorded for ${person.name}.` : `Decision not to certify ${person.name} recorded.`);
  };

  return (
    <div className="space-y-5 rounded-2xl border border-emerald/30 bg-midnight/40 p-4 sm:p-5">
      <h3 className="text-xl">Certification decision — {person.name}</h3>

      <div className="space-y-2">
        <p className="text-sm font-semibold text-sand">Pre-flight checks</p>
        <ul className="space-y-2">
          {checks.map((c) => (
            <li key={c.id} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm">
              <SeverityIcon severity={c.ok ? "ok" : "warning"} className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sand">{c.label}</p>
                <p className="text-xs text-sand/60">
                  {c.detail}{" "}
                  {!c.ok && c.href && (
                    <Link href={c.href} className="text-emerald underline underline-offset-2">
                      Fix this
                    </Link>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Decision date">
          <TextInput type="date" value={issuedOn} onChange={(e) => setIssuedOn(e.target.value)} />
        </Field>
        <Field label="Decision made by" hint="Name and role of the person signing off">
          <TextInput value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} placeholder="e.g. Jane Smith, Head of Compliance" />
        </Field>
      </div>

      <div className="space-y-1">
        <p className="text-sm text-sand/80">Outcome</p>
        <Segmented
          name={`outcome-${person.id}`}
          ariaLabel="Certification outcome"
          value={outcome}
          onChange={setOutcome}
          options={[
            { value: "certified", label: "Certified — fit and proper", tone: "good" },
            { value: "not_certified", label: "Not certified", tone: "bad" },
          ]}
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm text-sand/80">Functions covered</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CERTIFICATION_FUNCTIONS.filter((f) => person.certificationFunctions.includes(f.id) || functionIds.includes(f.id)).map((f) => (
            <Checkbox
              key={f.id}
              label={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {f.title} {f.verify && <VerifyBadge />}
                </span>
              }
              checked={functionIds.includes(f.id)}
              onChange={(v) => setFunctionIds((ids) => (v ? [...ids, f.id] : ids.filter((x) => x !== f.id)))}
            />
          ))}
        </div>
      </fieldset>

      <Field label="Notes" hint="Basis for the decision, conditions, evidence reviewed">
        <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} />
      </Field>

      {needsOverride && (
        <div className="space-y-3">
          <Callout tone="warn" title={`${failed.length} pre-flight check(s) not met`}>
            You can still record the certificate, but the reason must be documented. The FCA expects the firm to be satisfied the person is fit and proper
            before certifying (SYSC 27.2).
          </Callout>
          <Checkbox label="Issue despite the failed checks" checked={override} onChange={setOverride} />
          {override && (
            <Field label="Override note (required)">
              <TextArea value={overrideNote} onChange={(e) => setOverrideNote(e.target.value)} placeholder="e.g. No previous regulated employer — references not applicable" />
            </Field>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={submit}>
          <BadgeCheck className="size-4" aria-hidden /> Record decision
        </Button>
        <Button variant="ghost" onClick={() => onDone("")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

/* ---------------------------------- Print ---------------------------------- */

function PrintableCertificate({ ws, cert }: { ws: Workspace; cert: Certificate }) {
  const person = getPerson(ws, cert.personId);
  return (
    <div>
      <p className="muted">{ws.firm.name || "Firm name"}{ws.firm.frn ? ` · FRN ${ws.firm.frn}` : ""}</p>
      <h1>{cert.outcome === "certified" ? "Certificate of fitness and propriety" : "Record of decision not to certify"}</h1>
      <p className="muted">Certification Regime — SYSC 27 / FSMA s63F</p>
      <h2>Individual</h2>
      <p>{person?.name ?? "Unknown"}{person?.jobTitle ? ` — ${person.jobTitle}` : ""}</p>
      <h2>Certification functions</h2>
      <ul>
        {cert.functionIds.map((f) => (
          <li key={f}>{functionTitle(f)}</li>
        ))}
        {cert.functionIds.length === 0 && <li>None recorded</li>}
      </ul>
      <h2>Decision</h2>
      <table>
        <tbody>
          <tr>
            <th>Outcome</th>
            <td>{cert.outcome === "certified" ? "Certified" : "Not certified"}</td>
          </tr>
          <tr>
            <th>Date issued</th>
            <td>{formatDate(cert.issuedOn)}</td>
          </tr>
          {cert.outcome === "certified" && (
            <tr>
              <th>Valid until</th>
              <td>{formatDate(addMonths(cert.issuedOn, DEADLINES.annualAssessmentMonths))}</td>
            </tr>
          )}
          <tr>
            <th>Decision made by</th>
            <td>{cert.issuedBy || "—"}</td>
          </tr>
        </tbody>
      </table>
      {cert.outcome === "certified" && (
        <p>
          The firm is satisfied that the individual named above is a fit and proper person to perform the functions listed. This certificate is valid for
          12 months from the date of issue.
        </p>
      )}
      {cert.notes && (
        <>
          <h2>Notes</h2>
          <pre>{cert.notes}</pre>
        </>
      )}
      <p style={{ marginTop: "36pt" }}>Signed: ______________________________ &nbsp; Date: ______________</p>
    </div>
  );
}

/* ---------------------------------- Page ---------------------------------- */

export function CertificationPage() {
  const hydrated = useHydrated();
  const ws = useWorkspace((s) => s.ws);
  const update = useWorkspace((s) => s.update);
  const today = useToday();
  const params = useSearchParams();
  const [issuingFor, setIssuingFor] = useState<string | null>(params.get("person"));
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "attention">("all");
  const [flash, setFlash] = useFlash();
  const { print, portal } = usePrintable();

  const rows = useMemo(() => certifiedPeople(ws).map((p) => ({ person: p, ...certSummary(ws, p.id, today) })), [ws, today]);
  const visible = filter === "all" ? rows : rows.filter((r) => r.status !== "current");
  const phase2 = RULES_META.pending.find((p) => p.toLowerCase().includes("certification"));
  const issuingPerson = issuingFor ? getPerson(ws, issuingFor) : undefined;

  if (!hydrated) return <LoadingPanel />;

  const exportCsv = () => {
    const headers = ["Person", "Job title", "Certification functions", "Certificate date", "Outcome", "Valid until", "Decision by", "Current status", "Notes"];
    const out = rows.flatMap((r) => {
      const fns = r.person.certificationFunctions.map(functionTitle).join("; ");
      if (r.all.length === 0) return [[r.person.name, r.person.jobTitle, fns, "", "", "", "", STATUS_META[r.status].label, ""]];
      return r.all.map((c, i) => [
        r.person.name,
        r.person.jobTitle,
        c.functionIds.map(functionTitle).join("; "),
        c.issuedOn,
        c.outcome === "certified" ? "Certified" : "Not certified",
        c.outcome === "certified" ? addMonths(c.issuedOn, DEADLINES.annualAssessmentMonths) : "",
        c.issuedBy,
        i === 0 ? STATUS_META[r.status].label : "Superseded",
        c.notes,
      ]);
    });
    downloadCSV(`certification-register-${slugify(ws.firm.name)}-${today}`, headers, out);
  };

  const removeCert = (c: Certificate) => {
    if (!window.confirm(`Delete the certificate dated ${formatDate(c.issuedOn)}? This cannot be undone.`)) return;
    update((d) => {
      d.certificates = d.certificates.filter((x) => x.id !== c.id);
    });
  };

  const due = rows.filter((r) => r.status !== "current").length;

  return (
    <div className="space-y-6">
      {portal}
      <PageHeader
        eyebrow="Registers"
        title="Certification"
        description={
          <>
            Staff performing certification functions must be assessed as fit and proper and certified by the firm before they start, then re-certified at
            least every 12 months. Keep the decision, who made it and the evidence reviewed.
            <Refs>SYSC 27; FIT 1.2; FSMA s63F</Refs>
          </>
        }
        actions={
          <Button onClick={exportCsv} disabled={rows.length === 0}>
            <Download className="size-4" aria-hidden /> Export CSV
          </Button>
        }
      />

      {phase2 && (
        <Callout tone="info" title="Change ahead">
          {phase2}. The register format here is expected to remain useful; check the rules pack for updates. <VerifyBadge />
        </Callout>
      )}

      {issuingPerson && (
        <IssueForm
          key={issuingPerson.id}
          person={issuingPerson}
          onDone={(msg) => {
            setIssuingFor(null);
            if (msg) {
              setFlash(msg);
              setHistoryFor(issuingPerson.id);
            }
          }}
        />
      )}
      <FlashMessage message={flash} />

      <Panel>
        <SectionTitle
          title="Certified staff"
          description={rows.length ? `${rows.length} people in certification functions · ${due} need attention` : undefined}
          actions={
            rows.length > 0 && (
              <Segmented
                name="cert-filter"
                ariaLabel="Filter certified staff"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All" },
                  { value: "attention", label: "Needs attention" },
                ]}
              />
            )
          }
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={<FileBadge className="size-8" aria-hidden />}
            title="No one is in a certification function yet"
            description="Assign certification functions to people in the builder and they will appear here."
            action={
              <Link href="/builder?step=people" className="text-sm text-emerald underline underline-offset-2">
                Go to People
              </Link>
            }
          />
        ) : visible.length === 0 ? (
          <p className="text-sm text-sand/60">No gaps found — every certificate is current.</p>
        ) : (
          <RegisterTable
            caption="Certification register"
            rows={visible}
            rowKey={(r) => r.person.id}
            columns={[
              {
                header: "Person",
                cell: (r) => (
                  <div>
                    <p className="font-medium text-sand">{r.person.name}</p>
                    {r.person.jobTitle && <p className="text-xs text-sand/60">{r.person.jobTitle}</p>}
                  </div>
                ),
              },
              {
                header: "Functions",
                cell: (r) => (
                  <div className="flex flex-wrap gap-1">
                    {r.person.certificationFunctions.map((f) => (
                      <Badge key={f} tone="info">
                        {functionTitle(f)}
                        {CERTIFICATION_FUNCTIONS.find((x) => x.id === f)?.verify ? " *" : ""}
                      </Badge>
                    ))}
                  </div>
                ),
              },
              {
                header: "Latest certificate",
                cell: (r) =>
                  r.latest ? (
                    <span>
                      {formatDate(r.latest.issuedOn)}
                      <span className="block text-xs text-sand/60">{r.latest.issuedBy || "—"}</span>
                    </span>
                  ) : (
                    <span className="text-sand/50">None</span>
                  ),
              },
              { header: "Valid until", cell: (r) => formatDate(r.expiresOn) },
              { header: "Status", cell: (r) => <Badge tone={STATUS_META[r.status].tone}>{STATUS_META[r.status].label}</Badge> },
              {
                header: "Actions",
                hideLabelOnMobile: true,
                cell: (r) => (
                  <div className="flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" onClick={() => setIssuingFor(r.person.id)}>
                      {r.latestCertified ? "Re-certify" : "Issue certificate"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setHistoryFor(historyFor === r.person.id ? null : r.person.id)} aria-expanded={historyFor === r.person.id}>
                      History ({r.all.length})
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        )}
        {rows.some((r) => r.person.certificationFunctions.some((f) => CERTIFICATION_FUNCTIONS.find((x) => x.id === f)?.verify)) && (
          <p className="mt-3 flex items-center gap-2 text-xs text-sand/60">
            * Function definition to be confirmed against the Handbook <VerifyBadge />
          </p>
        )}
      </Panel>

      {historyFor && (
        <Panel>
          <SectionTitle
            title={`Certificate history — ${getPerson(ws, historyFor)?.name ?? ""}`}
            actions={
              <Button size="sm" variant="ghost" onClick={() => setHistoryFor(null)}>
                Close
              </Button>
            }
          />
          {certsFor(ws, historyFor).length === 0 ? (
            <p className="text-sm text-sand/60">No certificates recorded yet.</p>
          ) : (
            <ol className="space-y-3">
              {certsFor(ws, historyFor).map((c) => (
                <li key={c.id} className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={c.outcome === "certified" ? "good" : "bad"}>{c.outcome === "certified" ? "Certified" : "Not certified"}</Badge>
                    <span className="font-medium">{formatDate(c.issuedOn)}</span>
                    {c.outcome === "certified" && <span className="text-sand/60">valid until {formatDate(addMonths(c.issuedOn, DEADLINES.annualAssessmentMonths))}</span>}
                  </div>
                  <p className="mt-2 text-sand/80">Decision by: {c.issuedBy || "—"}</p>
                  <p className="text-sand/80">Functions: {c.functionIds.map(functionTitle).join(", ") || "—"}</p>
                  {c.notes && <p className="mt-1 whitespace-pre-wrap text-sand/60">{c.notes}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" onClick={() => print(<PrintableCertificate ws={ws} cert={c} />)}>
                      <Printer className="size-4" aria-hidden /> Print certificate
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => removeCert(c)}>
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      )}
    </div>
  );
}
