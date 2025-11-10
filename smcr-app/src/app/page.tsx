import Link from "next/link";
import Image from "next/image";
import { ArrowRight, ShieldCheck, PieChart, Sparkles } from "lucide-react";
import { HealthPreview } from "@/components/landing/HealthPreview";

const proofPoints = [
  {
    title: "Guided SMCR Builder",
    body: "Step-by-step workflow that mirrors the FCA playbook so teams stay confident from firm profile through certification reports.",
    icon: ShieldCheck,
  },
  {
    title: "Fitness & Propriety Lens",
    body: "Dynamic FIT questionnaires with evidence capture, reminders, and instant view of outstanding actions.",
    icon: PieChart,
  },
  {
    title: "Board-Ready Reports",
    body: "Premium scorecards, timelines, and references that export cleanly to PDF or push into the MEMA risk suite.",
    icon: Sparkles,
  },
];

const journey = [
  { label: "Profile", detail: "Select firm type, SMCR category, locations, and governance perimeter." },
  { label: "Assign", detail: "Map SMFs + prescribed responsibilities with live FCA references." },
  { label: "Assess", detail: "Run FIT questionnaires, attach evidence, flag remediation owners." },
  { label: "Report", detail: "Generate responsibilities maps, certification packs, and push to MEMA tools." },
];

export default function Home() {
  return (
    <main className="relative isolate overflow-hidden">
      <section className="hero-grid px-6 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-emerald mb-6">mema compliance studio</p>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl leading-tight">
              Streamline your Senior Managers & <span className="text-emerald">Certification Regime</span>
            </h1>
            <p className="mt-6 text-lg text-cloud/90 max-w-2xl">
              Orchestrate your Senior Managers & Certification Regime from firm profile through board-ready
              reporting. Built with the FCA handbook in mind, designed to feel like a concierge experience.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Link
                href="/builder"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald/90 px-8 py-4 text-midnight font-semibold transition hover:-translate-y-0.5 hover:bg-emerald"
              >
                Launch SMCR Builder
                <ArrowRight className="size-4" />
              </Link>
              <Link
                href="https://www.fca.org.uk/firms/senior-managers-certification-regime"
                target="_blank"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-white/30 px-8 py-4 text-sand/80"
              >
                FCA SMCR Guidance
              </Link>
            </div>
            <div className="mt-12 flex gap-10 text-sm text-sand/80">
              <div>
                <p className="text-3xl font-semibold text-sand">—</p>
                <p>responsibilities mapped</p>
              </div>
              <div>
                <p className="text-3xl font-semibold text-sand">—</p>
                <p>avg. time to completion</p>
              </div>
            </div>
          </div>
          <HealthPreview />
        </div>
      </section>

      <section className="bg-mist/5 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-6 md:grid-cols-3">
            {proofPoints.map((point) => (
              <div key={point.title} className="glass-panel p-6">
                <point.icon className="size-8 text-emerald" />
                <h3 className="mt-4 text-2xl text-sand">{point.title}</h3>
                <p className="mt-2 text-sm text-sand/80">{point.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <p className="text-sm uppercase tracking-[0.4em] text-emerald">fca-aligned flow</p>
          <h2 className="mt-4 text-4xl">A journey that mirrors how regulators think</h2>
          <p className="mt-4 text-sand/80 max-w-3xl mx-auto">
            Each step pairs the exact FCA reference material with interactive UI, so teams understand the
            why behind every data point while still moving quickly.
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
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald to-plumAccent"
                    style={{ width: `${(index + 1) * 20}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12">
            <Link href="/builder" className="inline-flex items-center gap-2 text-emerald font-semibold">
              Explore the builder
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
