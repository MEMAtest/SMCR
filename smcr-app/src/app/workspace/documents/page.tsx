import type { Metadata } from "next";
import { Suspense } from "react";
import { DocumentsPage } from "@/components/documents/DocumentsPage";

export const metadata: Metadata = { title: "Documents · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <DocumentsPage />
    </Suspense>
  );
}
