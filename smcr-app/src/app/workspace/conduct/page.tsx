import type { Metadata } from "next";
import { Suspense } from "react";
import { ConductPage } from "@/components/registers/ConductPage";

export const metadata: Metadata = { title: "Conduct Rules · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ConductPage />
    </Suspense>
  );
}
