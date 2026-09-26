import type { Metadata } from "next";
import { Suspense } from "react";
import { ReferencesPage } from "@/components/registers/ReferencesPage";

export const metadata: Metadata = { title: "Regulatory references · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ReferencesPage />
    </Suspense>
  );
}
