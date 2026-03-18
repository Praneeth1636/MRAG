import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Activity, Database, MessageSquare, Upload } from "lucide-react";
import { getHealth } from "@/lib/api";
import type { HealthResponse } from "@/types";

type HealthStatus = HealthResponse["status"] | "unknown";

const NAV_ITEMS = [
  { to: "/chat", icon: MessageSquare, label: "Chat" },
  { to: "/ingest", icon: Upload, label: "Ingest" },
  { to: "/eval", icon: Activity, label: "Eval" },
  { to: "/collections", icon: Database, label: "Collections" },
];

export function NavRail() {
  const location = useLocation();
  const [health, setHealth] = useState<HealthStatus>("unknown");

  useEffect(() => {
    let cancelled = false;

    const fetchHealth = async () => {
      try {
        const data = await getHealth();
        if (!cancelled) {
          setHealth(data.status);
        }
      } catch {
        if (!cancelled) {
          setHealth("unhealthy");
        }
      }
    };

    fetchHealth();
    const id = setInterval(fetchHealth, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const healthColor =
    health === "healthy"
      ? "bg-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.12)]"
      : health === "degraded"
        ? "bg-amber-400 anim-pulse"
        : health === "unhealthy"
          ? "bg-rose-400"
          : "bg-slate-500";

  return (
    <aside className="flex h-full w-14 flex-col items-center border-r border-border-default bg-surface-1">
      <div className="flex h-14 items-center justify-center">
        <div className="h-7 w-7 text-accent" aria-hidden="true">
          <svg viewBox="0 0 32 32" className="h-full w-full">
            <path
              d="M4 24L12 6l4 9 4-9 8 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      <nav className="mt-6 flex flex-1 flex-col items-center gap-2">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname.startsWith(item.to);
          return (
            <div
              key={item.to}
              className="group relative flex w-full items-center justify-center"
            >
              <div
                className={`absolute left-0 h-8 w-0.5 rounded-r-full bg-accent transition-all ${
                  isActive ? "opacity-100 shadow-glow" : "opacity-0"
                }`}
              />
              <NavLink
                to={item.to}
                className={({ isActive: active }) =>
                  [
                    "relative my-0.5 flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-slate-500 transition-colors",
                    "hover:bg-surface-2 hover:text-slate-300",
                    (active || isActive) &&
                      "bg-surface-2 text-accent shadow-glow border-border-hover",
                  ]
                    .filter(Boolean)
                    .join(" ")
                }
              >
                <Icon className="h-5 w-5" />
                <span className="pointer-events-none absolute left-full top-1/2 ml-3 -translate-y-1/2 rounded-md bg-surface-2 px-2.5 py-1 text-[11px] font-mono text-[var(--text-primary)] opacity-0 shadow-glow group-hover:opacity-100">
                  {item.label}
                  <span className="absolute left-[-4px] top-1/2 -translate-y-1/2 h-2 w-2 -rotate-45 bg-surface-2" />
                </span>
              </NavLink>
            </div>
          );
        })}
      </nav>

      <div className="mb-4 flex flex-col items-center gap-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${healthColor}`}
          aria-label={`System health: ${health}`}
        />
        <span className="hidden text-[10px] font-mono text-[var(--text-muted)] [@media(min-height:900px)]:block">
          v0.1
        </span>
      </div>
    </aside>
  );
}

