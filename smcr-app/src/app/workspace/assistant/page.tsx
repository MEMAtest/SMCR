import type { Metadata } from "next";
import { Suspense } from "react";
import { AssistantPage } from "@/components/ai/AssistantPage";

export const metadata: Metadata = { title: "Assistant · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AssistantPage />
    </Suspense>
  );
}
