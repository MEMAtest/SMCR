import type { Metadata } from "next";
import { Suspense } from "react";
import { Dashboard } from "@/components/dashboard/Dashboard";

export const metadata: Metadata = { title: "Dashboard · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <Dashboard />
    </Suspense>
  );
}
