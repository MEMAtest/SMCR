import type { Metadata } from "next";
import { Suspense } from "react";
import { HandoverPage } from "@/components/registers/HandoverPage";

export const metadata: Metadata = { title: "Handover · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <HandoverPage />
    </Suspense>
  );
}
