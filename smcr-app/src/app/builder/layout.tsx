import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/AppShell";

export default function BuilderLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
