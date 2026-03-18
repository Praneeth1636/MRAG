import { useLocation } from "react-router-dom";

const titles: Record<string, string> = {
  "/chat": "Chat",
  "/ingest": "Ingestion",
  "/eval": "Evaluation Dashboard",
  "/collections": "Collections"
};

export function Header() {
  const location = useLocation();
  const base = Object.keys(titles).find((p) => location.pathname.startsWith(p));
  const title = titles[base ?? "/chat"] ?? "Multi-Modal RAG";

  return (
    <header className="flex items-center justify-between border-b border-border bg-background px-6 py-3">
      <h1 className="text-lg font-semibold text-foreground">{title}</h1>
    </header>
  );
}

