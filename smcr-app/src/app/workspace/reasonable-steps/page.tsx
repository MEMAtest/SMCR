import type { Metadata } from "next";
import { Suspense } from "react";
import { ReasonableStepsPage } from "@/components/registers/ReasonableStepsPage";

export const metadata: Metadata = { title: "Reasonable steps · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReasonableStepsPage />
    </Suspense>
  );
}
