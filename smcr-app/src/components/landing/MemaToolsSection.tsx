import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

const memaTools = [
  {
    name: "Vulnerability heatmap",
    href: process.env.NEXT_PUBLIC_MEMA_VULNERABILITY_URL || "https://vulnerability.memaconsultants.com",
    description: "Push flagged SMFs for deeper conduct analytics.",
  },
  {
    name: "FCA fines tracker",
    href: process.env.NEXT_PUBLIC_MEMA_FINES_URL || "https://fcafines.memaconsultants.com",
    description: "Benchmark exposure against current enforcement actions.",
  },
];

export function MemaToolsSection() {
  return (
    <section className="glass-panel p-8 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-3xl">Connect with MEMA tools</h3>
        <ArrowUpRight className="size-6 text-emerald" />
      </div>
      <p className="text-sm text-sand/70">
        Use the same data spine to open contextual experiences in the MEMA suite. These will share auth +
        payloads once the API contract is finalised.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {memaTools.map((tool) => (
          <Link
            key={tool.name}
            href={tool.href}
            target="_blank"
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-left transition hover:border-emerald/50 hover:bg-white/10"
          >
            <p className="font-semibold text-sand">{tool.name}</p>
            <p className="text-sm text-sand/70 mt-1">{tool.description}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
