import { useEffect, useState } from "react";
import { getCollections } from "@/lib/api";
import { streamQuery } from "@/lib/sse";
import { useChatStore } from "@/stores/chatStore";
import type { CollectionInfo, SSELatencyEvent, SSESourceEvent } from "@/types";

export function ChatPage() {
  const {
    messages,
    addUserMessage,
    startAssistantMessage,
    appendToken,
    addSource,
    setLatency,
    finalizeMessage,
    selectedCollection,
    setCollection,
    selectedModel,
    setModel,
    topK,
    setTopK,
    clearMessages,
  } = useChatStore();

  const [collections, setCollections] = useState<CollectionInfo[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void getCollections()
      .then(setCollections)
      .catch(() => {
        // ignore
      });
  }, []);

  const handleSend = async () => {
    if (!input.trim() || !selectedCollection) return;
    const question = input.trim();
    setInput("");
    addUserMessage(question);
    const assistantId = startAssistantMessage();
    setLoading(true);

    const controller = new AbortController();

    try {
      await streamQuery(
        question,
        selectedCollection,
        selectedModel,
        topK,
        {
          onSource: (src: SSESourceEvent) => {
            addSource(assistantId, {
              content: src.content,
              source_file: src.source_file,
              page_number: src.page_number,
              content_type: src.content_type,
              relevance_score: src.relevance_score,
              chunk_index: src.chunk_index,
            });
          },
          onToken: (token: string) => {
            appendToken(assistantId, token);
          },
          onLatency: (lat: SSELatencyEvent) => {
            setLatency(assistantId, {
              retrieval_ms: lat.retrieval_ms,
              generation_ms: lat.generation_ms,
              total_ms: lat.total_ms,
            });
          },
          onDone: () => {
            finalizeMessage(assistantId);
            setLoading(false);
          },
          onError: () => {
            finalizeMessage(assistantId);
            setLoading(false);
          },
        },
        controller.signal,
      );
    } catch {
      finalizeMessage(assistantId);
      setLoading(false);
    }
  };

  const latestAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/10 bg-zinc-950/80 px-8 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4h16v10H7l-3 3V4z"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">Chat</h1>
            <p className="text-[11px] text-zinc-500">Ask questions over your documents</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-xs text-zinc-500">
          {selectedCollection ? (
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px]">
              Collection{" "}
              <span className="font-semibold text-zinc-200">{selectedCollection}</span>
            </span>
          ) : (
            <span className="rounded-full bg-white/5 px-3 py-1 text-[11px]">
              Select a collection to start
            </span>
          )}
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl gap-6 px-6 py-6">
        <div className="flex flex-1 flex-col rounded-2xl border border-white/10 bg-zinc-950/90 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3 text-xs">
            <select
              value={selectedCollection}
              onChange={(e) => setCollection(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-white/30"
            >
              <option value="">Select collection</option>
              {collections.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name} ({c.document_count})
                </option>
              ))}
            </select>

            <select
              value={selectedModel}
              onChange={(e) => setModel(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[12px] text-zinc-200 outline-none focus:border-white/30"
            >
              <option value="llama3">llama3</option>
              <option value="mistral">mistral</option>
            </select>

            <label className="flex items-center gap-1 text-xs">
              Top-K
              <input
                type="number"
                min={1}
                max={20}
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value) || 5)}
                className="w-14 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-zinc-200 outline-none focus:border-white/30"
              />
            </label>

            <button
              type="button"
              onClick={clearMessages}
              className="ml-auto rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-zinc-300 transition hover:bg-white/10"
            >
              Clear chat
            </button>
          </div>

          <div className="flex-1 space-y-3 overflow-auto px-5 py-4 text-sm">
            {!selectedCollection && (
              <div className="mt-8 text-center text-zinc-500">
                Select a collection or ingest documents before chatting.
              </div>
            )}

            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-xl rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    m.role === "user"
                      ? "rounded-br-sm bg-white text-zinc-950 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
                      : "rounded-bl-sm border border-white/10 bg-zinc-900/90 text-zinc-100"
                  }`}
                >
                  <div>{m.content}</div>
                  {m.latency && (
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {Math.round(m.latency.retrieval_ms)}ms retrieval ·{" "}
                      {Math.round(m.latency.generation_ms)}ms generation ·{" "}
                      {Math.round(m.latency.total_ms)}ms total
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && <div className="text-xs text-zinc-500">Streaming...</div>}
          </div>

          <div className="border-t border-white/10 px-5 py-3">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend();
              }}
              className="flex gap-3"
            >
              <input
                className="flex-1 rounded-xl border border-white/10 bg-zinc-950/80 px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-white/40"
                placeholder={
                  selectedCollection
                    ? "Ask a question about your documents..."
                    : "Select a collection first..."
                }
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={!selectedCollection || loading}
              />
              <button
                type="submit"
                disabled={!selectedCollection || loading || !input.trim()}
                className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white px-4 py-2.5 text-sm font-medium text-zinc-950 shadow-sm transition hover:bg-zinc-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-white/40"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        <aside className="hidden w-80 flex-col rounded-2xl border border-white/10 bg-zinc-950/90 p-4 text-xs shadow-[0_18px_45px_rgba(0,0,0,0.55)] md:flex">
          <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-zinc-600">
            <span>Sources</span>
            {latestAssistant?.sources && latestAssistant.sources.length > 0 && (
              <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-zinc-300">
                {latestAssistant.sources.length}
              </span>
            )}
          </div>

          {!latestAssistant?.sources?.length && (
            <div className="mt-6 text-center text-zinc-600">
              Retrieved chunks will appear here.
            </div>
          )}

          <div className="flex-1 space-y-2 overflow-auto">
            {latestAssistant?.sources?.map((s) => (
              <div
                key={`${s.source_file}-${s.chunk_index}`}
                className="rounded-xl border border-white/10 bg-zinc-950/80 p-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-zinc-200">
                    {s.source_file}
                    {s.page_number != null && ` · p.${s.page_number}`}
                  </span>
                  <span className="text-[10px] uppercase text-zinc-600">
                    {s.content_type}
                  </span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/5">
                  <div
                    className="h-1.5 rounded-full bg-emerald-400/80"
                    style={{ width: `${Math.min(1, s.relevance_score) * 100}%` }}
                  />
                </div>
                <p className="mt-1.5 line-clamp-3 text-[11px] text-zinc-400">
                  {s.content}
                </p>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}

