import type { Metadata } from "next";
import { Suspense } from "react";
import { CertificationPage } from "@/components/registers/CertificationPage";

export const metadata: Metadata = { title: "Certification · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CertificationPage />
    </Suspense>
  );
}
