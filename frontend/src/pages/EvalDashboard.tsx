import { useState, useEffect, useCallback } from "react";
import { getCollections, getEvalStatus, startEvaluation } from "@/lib/api";
import type {
  CollectionInfo,
  EvalJob,
  EvalReport,
  EvalQuestionResult,
  LatencySummaryStage
} from "@/types";

const METRIC_CONFIG = {
  faithfulness: { label: "Faithfulness", desc: "Claims backed by context" },
  relevance: { label: "Relevance", desc: "Answer addresses the question" },
  context_precision: { label: "Precision", desc: "Retrieved chunks are useful" },
  context_recall: { label: "Recall", desc: "Key info was retrieved" },
  latency: { label: "Latency", desc: "Response speed score" }
} as const;

const CATEGORY_PILLS = ["all", "factual", "multi_hop", "image_based", "unanswerable", "comparative"] as const;

type MetricKey = keyof typeof METRIC_CONFIG;
type CategoryKey = (typeof CATEGORY_PILLS)[number];

function scoreColor(score: number) {
  if (score >= 0.7) return { bg: "bg-emerald-500/10", text: "text-emerald-400", stroke: "#34d399" };
  if (score >= 0.4) return { bg: "bg-amber-500/10", text: "text-amber-400", stroke: "#fbbf24" };
  return { bg: "bg-rose-500/10", text: "text-rose-400", stroke: "#fb7185" };
}

function ScoreGauge({ score, size = 72, strokeWidth = 5 }: { score: number; size?: number; strokeWidth?: number }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score);
  const c = scoreColor(score);
  return (
    <svg width={size} height={size} className="shrink-0 -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        className="text-white/[0.04]"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={c.stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

function ScoreCard({ metricKey, score }: { metricKey: MetricKey; score: number }) {
  const cfg = METRIC_CONFIG[metricKey];
  const c = scoreColor(score);
  return (
    <div className="group relative flex flex-col items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-5 py-6 transition hover:border-white/[0.12] hover:bg-white/[0.04]">
      <div className="relative flex items-center justify-center">
        <ScoreGauge score={score} />
        <span className={`absolute text-lg font-semibold tracking-tight ${c.text}`}>
          {Math.round(score * 100)}
        </span>
      </div>
      <div className="text-center">
        <p className="text-[13px] font-medium text-zinc-200">{cfg.label}</p>
        <p className="mt-0.5 text-[11px] text-zinc-500">{cfg.desc}</p>
      </div>
    </div>
  );
}

function LatencyPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3.5 py-2">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="text-sm font-semibold tabular-nums text-zinc-200">{value.toFixed(0)}</span>
      <span className="text-[10px] text-zinc-600">ms</span>
    </div>
  );
}

function LatencyBar(props: { label: string; p50: number; p95: number; p99: number; max: number }) {
  const scale = (v: number) => Math.min((v / props.max) * 100, 100);
  return (
    <div className="group flex items-center gap-3">
      <span className="w-24 shrink-0 text-right text-[11px] text-zinc-500">{props.label}</span>
      <div className="relative h-5 flex-1 overflow-hidden rounded-full bg-white/[0.03]">
        <div className="absolute inset-y-0 left=0 rounded-full bg-teal-500/20" style={{ width: `${scale(props.p99)}%` }} />
        <div className="absolute inset-y-0 left=0 rounded-full bg-teal-500/40" style={{ width: `${scale(props.p95)}%` }} />
        <div className="absolute inset-y-0 left=0 rounded-full bg-teal-400/70" style={{ width: `${scale(props.p50)}%` }} />
      </div>
      <div className="flex shrink-0 gap-3 text-[10px] tabular-nums text-zinc-500">
        <span>
          p50 <b className="text-zinc-300">{props.p50.toFixed(0)}</b>
        </span>
        <span>
          p95 <b className="text-zinc-300">{props.p95.toFixed(0)}</b>
        </span>
        <span>
          p99 <b className="text-zinc-300">{props.p99.toFixed(0)}</b>
        </span>
      </div>
    </div>
  );
}

function CategoryFilter(props: {
  active: CategoryKey;
  onChange: (v: CategoryKey) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORY_PILLS.map((cat) => (
        <button
          key={cat}
          type="button"
          onClick={() => props.onChange(cat)}
          className={`rounded-full px-3 py-1 text-[11px] font-medium tracking-wide transition ${
            props.active === cat
              ? "bg-white/[0.1] text-zinc-100 ring-1 ring-white/[0.15]"
              : "bg-white/[0.02] text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300"
          }`}
        >
          {cat === "all" ? "All" : cat.replace("_", " ")}
        </button>
      ))}
    </div>
  );
}

function QuestionRow(props: {
  result: EvalQuestionResult;
  index: number;
  onSelect: (r: EvalQuestionResult) => void;
}) {
  const m = props.result.metrics;
  return (
    <tr
      onClick={() => props.onSelect(props.result)}
      className="group cursor-pointer border-b border-white/[0.04] transition hover:bg-white/[0.03]"
    >
      <td className="py-3 pl-4 pr-2 text-[11px] tabular-nums text-zinc-600">
        {props.index + 1}
      </td>
      <td className="max-w-[280px] truncate py-3 pr-4 text-[13px] text-zinc-300 group-hover:text-zinc-100">
        {props.result.question}
      </td>
      {(Object.keys(METRIC_CONFIG) as MetricKey[])
        .filter((k) => k !== "latency")
        .map((key) => {
          const s = m[key];
          const c = scoreColor(s);
          return (
            <td key={key} className="py-3 px-2 text-center">
              <span
                className={`inline-block rounded-md px-2 py-0.5 text-[11px] font-medium tabular-nums ${c.bg} ${c.text}`}
              >
                {(s * 100).toFixed(0)}
              </span>
            </td>
          );
        })}
      <td className="py-3 px-2 pr-4 text-right text-[12px] tabular-nums text-zinc-400">
        {props.result.details?.latency?.total_ms?.toFixed(0) ?? "—"}ms
      </td>
    </tr>
  );
}

function DetailPanel(props: { result: EvalQuestionResult | null; onClose: () => void }) {
  const result = props.result;
  if (!result) return null;
  const m = result.metrics;
  const d = (result.details ?? {}) as any;
  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={props.onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg overflow-y-auto border-l border-white/[0.06] bg-zinc-950 px-8 py-10 shadow-2xl"
      >
        <button
          type="button"
          onClick={props.onClose}
          className="absolute right-6 top-6 text-zinc-500 transition hover:text-zinc-200"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <p className="mb-1 text-[11px] uppercase tracking-widest text-zinc-600">Question detail</p>
        <h2 className="pr-8 text-[17px] font-semibold leading-snug text-zinc-100">
          {result.question}
        </h2>
        <div className="mt-6 flex flex-wrap gap-2">
          {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((key) => {
            const s = m[key];
            const c = scoreColor(s);
            return (
              <span
                key={key}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium ${c.bg} ${c.text}`}
              >
                {METRIC_CONFIG[key].label} {(s * 100).toFixed(0)}%
              </span>
            );
          })}
        </div>
        <div className="mt-8 space-y-5">
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-zinc-600">
              Expected answer
            </p>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[13px] leading-relaxed text-zinc-400">
              {result.expected_answer}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[11px] uppercase tracking-widest text-zinc-600">
              Generated answer
            </p>
            <div className="rounded-lg border border-emerald-500/10 bg-emerald-500/[0.03] px-4 py-3 text-[13px] leading-relaxed text-zinc-300">
              {result.generated_answer}
            </div>
          </div>
        </div>
        {d.faithfulness && (
          <div className="mt-8">
            <p className="mb-3 text-[11px] uppercase tracking-widest text-zinc-600">
              Faithfulness breakdown
            </p>
            <div className="flex items-center gap-4 text-[13px]">
              <span className="text-emerald-400">
                {d.faithfulness.supported_claims ?? 0} supported
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-rose-400">
                {d.faithfulness.unsupported_claims ?? 0} unsupported
              </span>
              <span className="text-zinc-600">·</span>
              <span className="text-zinc-500">
                {d.faithfulness.total_claims ?? 0} total claims
              </span>
            </div>
            {Array.isArray(d.faithfulness.unsupported) && d.faithfulness.unsupported.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {d.faithfulness.unsupported.map((claim: string, i: number) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 rounded-md border border-rose-500/10 bg-rose-500/[0.04] px-3 py-2 text-[12px] text-rose-300/80"
                  >
                    <span className="mt-px shrink-0 text-rose-500">✕</span>
                    <span>{claim}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="mt-8">
          <p className="mb-3 text-[11px] uppercase tracking-widest text-zinc-600">
            Retrieved chunks ({result.retrieved_chunk_ids?.length ?? 0})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {result.retrieved_chunk_ids.map((id, i) => (
              <span
                key={i}
                className="rounded-md bg-white/[0.04] px-2.5 py-1 text-[11px] font-mono text-zinc-500"
              >
                {id}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState(props: { onRun: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-32 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-white/[0.06] bg-white/[0.02]">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
          <path
            d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            className="text-zinc-600"
          />
        </svg>
      </div>
      <h3 className="text-[15px] font-semibold text-zinc-200">No evaluation results yet</h3>
      <p className="mt-1.5 max-w-xs text-[13px] text-zinc-500">
        Run an evaluation against a collection to see faithfulness, relevance, precision, recall,
        and latency metrics.
      </p>
      <button
        type="button"
        onClick={props.onRun}
        className="mt-6 rounded-lg bg-white px-5 py-2 text-[13px] font-semibold text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.97]"
      >
        Run evaluation
      </button>
    </div>
  );
}

export function EvalDashboard(): JSX.Element {
  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [collection, setCollection] = useState<string>("");
  const [model, setModel] = useState<string>("llama3");
  const [report, setReport] = useState<EvalReport | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>("all");
  const [sortKey, setSortKey] = useState<MetricKey>("faithfulness");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedResult, setSelectedResult] = useState<EvalQuestionResult | null>(null);

  useEffect(() => {
    getCollections().then(setCollections).catch(() => {});
  }, []);

  const handleRun = useCallback(async () => {
    if (!collection) return;
    setLoading(true);
    try {
      const { job_id } = await startEvaluation({
        collection_name: collection,
        model,
        top_k: 5
      });
      let done = false;
      while (!done) {
        const job: EvalJob = await getEvalStatus(job_id);
        if (job.status === "completed" && job.report) {
          setReport(job.report);
          done = true;
        } else if (job.status === "failed") {
          done = true;
        } else {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((r) => setTimeout(r, 1500));
        }
      }
    } finally {
      setLoading(false);
    }
  }, [collection, model]);

  const rows: EvalQuestionResult[] =
    report?.per_question_results
      ?.filter((r) => selectedCategory === "all" || r.details?.category === selectedCategory) ?? [];

  rows.sort((a, b) => {
    const av = a.metrics[sortKey] ?? 0;
    const bv = b.metrics[sortKey] ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const SortIcon = ({ active }: { active: boolean }) => (
    <svg
      width="10"
      height="10"
      viewBox="0 0 10 10"
      className={`ml-1 inline transition ${active ? "text-zinc-300" : "text-zinc-700"}`}
    >
      <path
        d="M5 2l3 3H2z"
        fill={sortDir === "asc" && active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M5 8L2 5h6z"
        fill={sortDir === "desc" && active ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );

  const latencySummary = report?.latency_summary as Record<string, LatencySummaryStage> | undefined;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/[0.06] bg-zinc-950/80 px-8 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 3v18h18"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M7 14l4-4 4 4 5-5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1 className="text-[15px] font-semibold tracking-tight">Evaluation</h1>
          {report && (
            <span className="ml-2 rounded-full bg-white/[0.05] px-2.5 py-0.5 text-[10px] font-medium text-zinc-500">
              {report.total_questions} questions · {report.model_used} ·{" "}
              {report.duration_seconds.toFixed(1)}s
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <select
            value={collection}
            onChange={(e) => setCollection(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-300 outline-none focus:border-white/[0.2]"
          >
            <option value="">Select collection</option>
            {collections.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-[12px] text-zinc-300 outline-none focus:border-white/[0.2]"
          >
            <option value="llama3">llama3</option>
            <option value="mistral">mistral</option>
          </select>
          <button
            type="button"
            onClick={() => void handleRun()}
            disabled={loading || !collection}
            className="flex items-center gap-2 rounded-lg bg-white px-4 py-1.5 text-[12px] font-semibold text-zinc-950 transition hover:bg-zinc-200 active:scale-[0.97] disabled:opacity-50"
          >
            {loading ? (
              <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                  className="opacity-20"
                />
                <path
                  d="M12 2a10 10 0 019.95 9"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon points="6,3 20,12 6,21" fill="currentColor" />
              </svg>
            )}
            {loading ? "Running…" : "Run evaluation"}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-8 py-10">
        {!report && !loading && <EmptyState onRun={() => void handleRun()} />}
        {loading && !report && (
          <div className="flex flex-col items-center justify-center py-32">
            <svg className="h-8 w-8 animate-spin text-zinc-600" viewBox="0 0 24 24" fill="none">
              <circle
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="2.5"
                className="opacity-20"
              />
              <path
                d="M12 2a10 10 0 019.95 9"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
            <p className="mt-4 text-[13px] text-zinc-500">
              Evaluating {collection || "collection"} with {model}…
            </p>
          </div>
        )}
        {report && (
          <>
            <section className="grid grid-cols-1 gap-3 md:grid-cols-5">
              {(Object.keys(METRIC_CONFIG) as MetricKey[]).map((key) => (
                <ScoreCard
                  key={key}
                  metricKey={key}
                  score={report.aggregate_scores[key] ?? 0}
                />
              ))}
            </section>
            <section className="mt-8 rounded-xl border border-white/[0.06] bg-white/[0.015] p-6">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-zinc-300">
                  Latency distribution
                </h2>
              </div>
              <div className="space-y-3">
                {latencySummary &&
                  Object.entries(latencySummary).map(([stage, stats]) => (
                    <LatencyBar
                      key={stage}
                      label={stage.replace("_ms", "")}
                      p50={stats.p50}
                      p95={stats.p95}
                      p99={stats.p99}
                      max={Math.max(stats.p99 * 1.2, 100)}
                    />
                  ))}
              </div>
              {latencySummary?.total_ms && (
                <div className="mt-5 flex flex-wrap gap-2">
                  <LatencyPill label="mean" value={latencySummary.total_ms.mean} />
                  <LatencyPill label="p50" value={latencySummary.total_ms.p50} />
                  <LatencyPill label="p95" value={latencySummary.total_ms.p95} />
                  <LatencyPill label="p99" value={latencySummary.total_ms.p99} />
                </div>
              )}
            </section>
            <section className="mt-8">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[13px] font-semibold text-zinc-300">
                  Per-question results
                </h2>
                <CategoryFilter
                  active={selectedCategory}
                  onChange={(v) => setSelectedCategory(v)}
                />
              </div>
              <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                      <th className="py-2.5 pl-4 pr-2 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                        #
                      </th>
                      <th className="py-2.5 pr-4 text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                        Question
                      </th>
                      {(Object.keys(METRIC_CONFIG) as MetricKey[])
                        .filter((k) => k !== "latency")
                        .map((key) => (
                          <th
                            key={key}
                            onClick={() =>
                              setSortKey((prev) => {
                                if (prev === key) {
                                  setSortDir((d) => (d === "desc" ? "asc" : "desc"));
                                  return prev;
                                }
                                setSortDir("desc");
                                return key;
                              })
                            }
                            className="cursor-pointer py-2.5 px-2 text-center text-[10px] font-medium uppercase tracking-widest text-zinc-600 transition hover:text-zinc-400"
                          >
                            {METRIC_CONFIG[key].label.slice(0, 6)}.
                            <SortIcon active={sortKey === key} />
                          </th>
                        ))}
                      <th className="py-2.5 px-2 pr-4 text-right text-[10px] font-medium uppercase tracking-widest text-zinc-600">
                        Latency
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <QuestionRow
                        key={r.qa_pair_id}
                        result={r}
                        index={i}
                        onSelect={setSelectedResult}
                      />
                    ))}
                    {rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="py-12 text-center text-[13px] text-zinc-600"
                        >
                          No results for this category
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
      <DetailPanel result={selectedResult} onClose={() => setSelectedResult(null)} />
    </div>
  );
}

