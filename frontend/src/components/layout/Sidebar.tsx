import { Link, useLocation } from "react-router-dom";
import { MessageSquare, Upload, BarChart3, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { getHealth } from "@/lib/api";
import type { HealthResponse } from "@/types";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/ingest", icon: Upload, label: "Ingest" },
  { to: "/eval", icon: BarChart3, label: "Evaluation" },
  { to: "/collections", icon: Database, label: "Collections" }
];

export function Sidebar() {
  const location = useLocation();
  const [health, setHealth] = useState<HealthResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    const fetchHealth = async () => {
      try {
        const data = await getHealth();
        if (!cancelled) setHealth(data);
      } catch {
        // ignore
      }
    };
    fetchHealth();
    const id = setInterval(fetchHealth, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const healthColor =
    health?.status === "healthy"
      ? "bg-green-500"
      : health?.status === "degraded"
      ? "bg-amber-500"
      : "bg-red-500";

  return (
    <aside className="flex h-screen w-20 flex-col border-r border-white/[0.06] bg-zinc-950/95 text-zinc-500 transition-all duration-200 hover:w-56">
      <div className="flex-1 space-y-2 py-4">
        {navItems.map((item) => {
          const active = location.pathname.startsWith(item.to);
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "mx-2 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-white text-zinc-950 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
                  : "hover:bg-white/[0.06] hover:text-zinc-100"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate opacity-0 group-hover:opacity-100 lg:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="mb-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span
          className={cn(
            "h-2 w-2 rounded-full",
            health ? healthColor : "bg-zinc-600"
          )}
        />
        <span className="hidden lg:inline">
          {health ? health.status : "checking..."}
        </span>
      </div>
    </aside>
  );
}

