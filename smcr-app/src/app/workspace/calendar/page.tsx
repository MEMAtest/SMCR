import type { Metadata } from "next";
import { Suspense } from "react";
import { CalendarPage } from "@/components/dashboard/CalendarPage";

export const metadata: Metadata = { title: "Calendar · SM&CR Studio" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CalendarPage />
    </Suspense>
  );
}
