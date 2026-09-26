import type { Metadata } from "next";
import { Suspense } from "react";
import { BuilderWizard } from "@/components/builder/BuilderWizard";

export const metadata: Metadata = { title: "Setup · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <BuilderWizard />
    </Suspense>
  );
}
