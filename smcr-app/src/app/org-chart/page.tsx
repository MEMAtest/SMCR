import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import OrgChartClient from "./OrgChartClient";

export const metadata = {
  title: "Org Chart — MEMA SMCR",
  description: "Organisation chart and corporate group structure viewer",
};

export default function OrgChartPage() {
  return (
    <main className="px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <Link
          href="/builder"
          className="inline-flex items-center gap-2 text-sm text-sand/70 hover:text-sand transition"
        >
          <ArrowLeft className="size-4" /> Back to builder
        </Link>
        <OrgChartClient />
      </div>
    </main>
  );
}
