import { useEffect, useMemo, useState } from "react";
import { getCollections, startEvaluation, getEvalStatus } from "@/lib/api";
import type { CollectionInfo, EvalJob, EvalReport } from "@/types";
import { useToastStore } from "@/stores/toastStore";

function formatScorePct(n: number) {
  // Backend metrics are usually 0..1 or already percent-ish; keep it robust.
  if (!Number.isFinite(n)) return "-";
  const asPct = n <= 1 ? n * 100 : n;
  return `${Math.round(asPct)}%`;
}

function downloadJSON(report: EvalReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eval_${report.model_used}_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCSV(report: EvalReport) {
  const header = [
    "qa_pair_id",
    "question",
    "expected_answer",
    "generated_answer",
    "faithfulness",
    "relevance",
    "context_precision",
    "context_recall",
    "latency",
  ];

  const rows = report.per_question_results.map((r) => {
    const vals: Array<string | number> = [
      r.qa_pair_id,
      r.question,
      r.expected_answer,
      r.generated_answer,
      r.metrics.faithfulness,
      r.metrics.relevance,
      r.metrics.context_precision,
      r.metrics.context_recall,
      r.metrics.latency,
    ];
    return vals
      .map((v) => {
        const s = String(v ?? "");
        // Minimal CSV escaping
        const escaped = s.replace(/"/g, '""');
        return `"${escaped}"`;
      })
      .join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eval_${report.model_used}_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function MetricCard({
  title,
  value,
  accent,
}: {
  title: string;
  value: string;
  accent: "cyan" | "emerald" | "amber" | "rose" | "violet";
}) {
  const accentClass =
    accent === "cyan"
      ? "text-cyan-300"
      : accent === "emerald"
        ? "text-emerald-300"
        : accent === "amber"
          ? "text-amber-300"
          : accent === "rose"
            ? "text-rose-300"
            : "text-violet-300";

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className={`text-[11px] uppercase tracking-[0.16em] ${accentClass}`}>
        {title}
      </div>
      <div className="mt-2 text-[18px] font-semibold text-zinc-50">
        {value}
      </div>
    </div>
  );
}

export function EvalPage() {
  const { add } = useToastStore();

  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [collectionName, setCollectionName] = useState("");
  const [model, setModel] = useState("llama3");
  const [topK, setTopK] = useState(5);

  const [job, setJob] = useState<EvalJob | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getCollections().then(setCollections).catch(() => {});
  }, []);

  const [jobId, setJobId] = useState<string>("");
  useEffect(() => {
    if (!jobId) return;
    setLoading(true);

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await getEvalStatus(jobId);
        if (cancelled) return;
        setJob(res);
        if (res.status !== "running") {
          setLoading(false);
        }
      } catch {
        if (cancelled) return;
        setLoading(false);
        add("Evaluation failed", "error");
      }
    };

    void tick();
    const id = setInterval(() => void tick(), 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId, add]);

  const report = job?.report ?? null;
  const aggregate = report?.aggregate_scores ?? null;

  const canRun = useMemo(() => {
    return Boolean(collectionName && model && topK > 0);
  }, [collectionName, model, topK]);

  const handleRun = async () => {
    if (!canRun) return;
    setLoading(true);
    setJobId("");
    setJob(null);
    try {
      const res = await startEvaluation({
        collection_name: collectionName,
        model,
        top_k: topK,
      });
      setJobId(res.job_id);
      add("Evaluation started", "info");
    } catch {
      setLoading(false);
      add("Evaluation failed", "error");
    }
  };

  if (!collections.length) {
    return (
      <div className="min-h-screen bg-bg p-6 text-[var(--text-primary)]">
        <div className="mt-12 text-center text-zinc-400">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg p-6 text-[var(--text-primary)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-[18px]">Evaluation</h1>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            Run an evaluation over an ingested collection.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-100 outline-none focus:border-white/30"
          >
            <option value="">Select collection</option>
            {collections.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.document_count})
              </option>
            ))}
          </select>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-100 outline-none focus:border-white/30"
          >
            <option value="llama3">llama3</option>
            <option value="mistral">mistral</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
            Top-K
            <input
              type="number"
              min={1}
              max={50}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value) || 5)}
              className="w-16 rounded-lg border border-white/10 bg-white/[0.02] px-2 py-2 text-[12px] text-zinc-100 outline-none focus:border-white/30"
            />
          </label>

          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={!canRun || loading}
            className="rounded-lg bg-accent px-4 py-2 text-[12px] font-semibold text-zinc-950 shadow-[0_0_20px_rgba(34,211,238,0.15)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? "Running…" : "Run Eval"}
          </button>
        </div>
      </div>

      <div className="mt-6">
        {!report && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-zinc-300">
            {jobId ? (
              <div className="animate-pulse text-center">
                Evaluation running…
              </div>
            ) : (
              <div className="text-center">Select a collection and run evaluation.</div>
            )}
          </div>
        )}

        {report && aggregate && (
          <>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <MetricCard
                title="Faith"
                value={formatScorePct(aggregate.faithfulness)}
                accent="emerald"
              />
              <MetricCard
                title="Relv"
                value={formatScorePct(aggregate.relevance)}
                accent="cyan"
              />
              <MetricCard
                title="Prec"
                value={formatScorePct(aggregate.context_precision)}
                accent="violet"
              />
              <MetricCard
                title="Recl"
                value={formatScorePct(aggregate.context_recall)}
                accent="amber"
              />
              <MetricCard
                title="Latn"
                value={`${Math.round(aggregate.latency)}ms`}
                accent="rose"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => downloadJSON(report)}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-100 hover:bg-white/[0.06]"
              >
                Export JSON
              </button>
              <button
                type="button"
                onClick={() => downloadCSV(report)}
                className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2 text-[12px] text-zinc-100 hover:bg-white/[0.06]"
              >
                Export CSV
              </button>
            </div>

            <div className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <table className="w-full text-left">
                <thead className="bg-white/[0.02]">
                  <tr>
                    <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
                      #
                    </th>
                    <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
                      Question
                    </th>
                    <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
                      Faith
                    </th>
                    <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
                      Relv
                    </th>
                    <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
                      Prec
                    </th>
                    <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
                      Recl
                    </th>
                    <th className="px-4 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-400">
                      ms
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {report.per_question_results.slice(0, 50).map((r, idx) => (
                    <tr key={r.qa_pair_id} className="border-t border-white/10">
                      <td className="px-4 py-3 text-[12px] text-zinc-300">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-zinc-200">
                        {r.question.length > 64
                          ? r.question.slice(0, 64) + "…"
                          : r.question}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-cyan-200">
                        {formatScorePct(r.metrics.faithfulness)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-cyan-200">
                        {formatScorePct(r.metrics.relevance)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-violet-200">
                        {formatScorePct(r.metrics.context_precision)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-amber-200">
                        {formatScorePct(r.metrics.context_recall)}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-zinc-300">
                        {Math.round(r.metrics.latency)}ms
                      </td>
                    </tr>
                  ))}
                  {report.per_question_results.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        No results yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

