import Link from "next/link";
import { ArrowRight, CalendarDays, FileText, ShieldCheck, UserCheck } from "lucide-react";
import { HealthPreview } from "@/components/landing/HealthPreview";
import { RULES_META } from "@/lib/rules/fca-solo";
import { formatDate } from "@/lib/workspace/dates";

const proofPoints = [
  {
    title: "Guided setup",
    body: "Work out your SM&CR category, record senior managers and certified staff, and allocate only the prescribed responsibilities that apply to your firm — with the reasons shown.",
    icon: ShieldCheck,
  },
  {
    title: "Fitness & propriety",
    body: "FIT 2 questionnaires that flag potential concerns, require an explanation and date for each, and record the assessor, outcome and next review date.",
    icon: UserCheck,
  },
  {
    title: "Documents",
    body: "Statements of Responsibilities, a management responsibilities map for Enhanced firms and a board pack, generated from the same data. AI drafts are always marked for human review.",
    icon: FileText,
  },
  {
    title: "Year-round modules",
    body: "Certification, Conduct Rules training and breaches, regulatory references, reasonable-steps evidence, handovers and a deadline calendar with .ics export.",
    icon: CalendarDays,
  },
];

const journey = [
  { label: "Profile", detail: "Confirm the firm is FCA solo-regulated and work out whether it is Limited Scope, Core or Enhanced." },
  { label: "People", detail: "Record SMF holders, approval status, criminal records checks and certification functions." },
  { label: "Responsibilities", detail: "Allocate the prescribed responsibilities that apply, with warnings for unusual allocations." },
  { label: "Assess & document", detail: "Complete F&P assessments and produce SoRs, the responsibilities map and a board pack." },
];

export default function Home() {
  return (
    <main className="relative isolate overflow-hidden">
      <section className="hero-grid px-4 py-20 sm:px-6 sm:py-32">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="min-w-0">
            <p className="mb-6 text-sm uppercase tracking-[0.4em] text-emerald">mema compliance studio</p>
            <h1 className="text-4xl leading-tight sm:text-5xl lg:text-6xl">
              SM&amp;CR for FCA solo-regulated firms, <span className="text-emerald">kept current</span> all year
            </h1>
            <p className="mt-6 max-w-2xl text-lg text-cloud/90">
              Set up your Senior Managers &amp; Certification Regime arrangements, then keep them up to date: certificates, Conduct Rules, references and
              deadlines in one place. Built for compliance officers at small and mid-sized firms.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row">
              <Link
                href="/builder"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald/90 px-8 py-4 font-semibold text-midnight transition hover:-translate-y-0.5 hover:bg-emerald"
              >
                Start setup
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link
                href="https://www.fca.org.uk/firms/senior-managers-certification-regime"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 text-sand/80"
              >
                FCA SM&amp;CR guidance
              </Link>
            </div>
            <div className="mt-12 grid gap-6 text-sm text-sand/80 sm:grid-cols-2">
              <div>
                <p className="text-2xl font-semibold text-sand">PS26/6</p>
                <p>
                  Rules pack {RULES_META.id}, as of {formatDate(RULES_META.asOf)}, including the Phase 1 reforms and the non-financial misconduct rules.
                </p>
              </div>
              <div>
                <p className="text-2xl font-semibold text-sand">No login</p>
                <p>Your work is saved in this browser. You can optionally save it to the server to get a shareable link.</p>
              </div>
            </div>
          </div>
          <div className="min-w-0">
            <HealthPreview />
          </div>
        </div>
      </section>

      <section className="bg-mist/5 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {proofPoints.map((point) => (
              <div key={point.title} className="glass-panel p-6">
                <point.icon className="size-8 text-emerald" aria-hidden />
                <h3 className="mt-4 text-2xl text-sand">{point.title}</h3>
                <p className="mt-2 text-sm text-sand/80">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 text-center sm:px-6">
          <p className="text-sm uppercase tracking-[0.4em] text-emerald">how setup works</p>
          <h2 className="mt-4 text-4xl">Four steps, one source of truth</h2>
          <p className="mx-auto mt-4 max-w-3xl text-sand/80">
            Each step cites the relevant Handbook provisions and explains why a requirement applies to your firm. Items that could not be confirmed
            against the live Handbook are marked &ldquo;verify&rdquo;. The tool supports, but does not replace, professional compliance advice.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {journey.map((stage, index) => (
              <div key={stage.label} className="glass-panel p-6 text-left">
                <div className="flex items-center justify-between text-sm text-cloud/70">
                  <span>Step {index + 1}</span>
                  <span>{stage.label}</span>
                </div>
                <p className="mt-3 text-lg text-sand">{stage.detail}</p>
                <div className="mt-4 h-1 w-full rounded-full bg-white/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald to-plumAccent" style={{ width: `${(index + 1) * 25}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <Link href="/builder" className="inline-flex items-center gap-2 font-semibold text-emerald">
              Start setup
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
