import { useEffect, useState } from "react";
import { deleteCollection, getCollections } from "@/lib/api";
import type { CollectionInfo } from "@/types";
import { useNavigate } from "react-router-dom";

export function CollectionsPage() {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const refresh = () => {
    setLoading(true);
    getCollections()
      .then(setCollections)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async (name: string) => {
    if (!window.confirm(`Delete collection "${name}"? This cannot be undone.`)) {
      return;
    }
    await deleteCollection(name);
    refresh();
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-zinc-950/80 px-8 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 5h16v3H4zM4 11h16v3H4zM4 17h16v3H4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">Collections</h1>
            <p className="text-[11px] text-zinc-500">
              Knowledge bases backed by your ingested documents
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate("/ingest")}
          className="rounded-lg bg-white px-3.5 py-1.5 text-[12px] font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200 active:scale-[0.97]"
        >
          Ingest documents
        </button>
      </header>
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-zinc-950/90 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
        <table className="min-w-full text-sm">
          <thead className="bg-white/[0.02]">
            <tr>
                <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                  Name
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                  Documents
                </th>
                <th className="px-4 py-2 text-left text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                  Actions
                </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-sm text-zinc-600">
                  Loading collections...
                </td>
              </tr>
            )}
            {!loading && collections.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-4 text-center text-sm text-zinc-600">
                  No collections yet. Ingest documents to create one.
                </td>
              </tr>
            )}
            {collections.map((c) => (
              <tr key={c.name} className="border-t border-white/[0.06]">
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => navigate("/chat?collection=" + encodeURIComponent(c.name))}
                    className="text-[13px] text-zinc-200 hover:underline"
                  >
                    {c.name}
                  </button>
                </td>
                <td className="px-4 py-2 text-sm text-zinc-400">{c.document_count}</td>
                <td className="px-4 py-2">
                  <button
                    type="button"
                    onClick={() => void handleDelete(c.name)}
                    className="rounded-md bg-rose-500/90 px-2 py-1 text-[11px] text-zinc-50 transition hover:bg-rose-500"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

