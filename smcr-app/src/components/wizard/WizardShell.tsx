"use client";

import type { ReactNode } from "react";
import { WizardSidebar } from "./WizardSidebar";

interface WizardShellProps {
  children: ReactNode;
  rightPanel: ReactNode;
}

export function WizardShell({ children, rightPanel }: WizardShellProps) {
  return (
    <div className="grid gap-8 lg:grid-cols-[320px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_360px]">
      <div className="hidden lg:block">
        <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
          <WizardSidebar />
        </div>
      </div>
      <div className="space-y-6">
        <div className="lg:hidden">
          <WizardSidebar />
        </div>
        {children}
      </div>
      <div className="hidden xl:block">
        <div className="sticky top-8 max-h-[calc(100vh-4rem)] overflow-y-auto">
          {rightPanel}
        </div>
      </div>
    </div>
  );
}
