import { Sidebar } from "./Sidebar";
import { ReactNode } from "react";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <main className="flex-1 overflow-auto bg-background">{children}</main>
      </div>
    </div>
  );
}

