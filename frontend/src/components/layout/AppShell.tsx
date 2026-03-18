import type { ReactNode } from "react";
import { NavRail } from "./NavRail";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen w-full bg-bg text-[var(--text-primary)]">
      <div className="fixed inset-x-0 top-0 z-30">
        <div className="signal-bar" />
      </div>
      <NavRail />
      <main className="ml-14 flex h-screen flex-1 flex-col">
        <div className="h-2" />
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto px-6 pb-6 pt-4">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

