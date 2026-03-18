import type { SSELatencyEvent, SSESourceEvent, SSETokenEvent } from "@/types";

interface SSECallbacks {
  onSource: (source: SSESourceEvent) => void;
  onToken: (token: string) => void;
  onLatency: (latency: SSELatencyEvent) => void;
  onDone: () => void;
  onError: (error: Error) => void;
}

export async function streamQuery(
  question: string,
  collectionName: string,
  model: string,
  topK: number,
  callbacks: SSECallbacks,
  signal?: AbortSignal
): Promise<void> {
  const apiUrl =
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? "" : "http://localhost:8000");

  const response = await fetch(`${apiUrl}/api/v1/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      collection_name: collectionName,
      model,
      top_k: topK,
      stream: true
    }),
    signal
  });

  if (!response.ok) {
    throw new Error(`Query failed: ${response.status} ${response.statusText}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response body");

  const decoder = new TextDecoder();
  let buffer = "";
  let eventType = "";

  try {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          const data = JSON.parse(line.slice(6));
          switch (eventType) {
            case "source":
              callbacks.onSource(data as SSESourceEvent);
              break;
            case "token":
              callbacks.onToken((data as SSETokenEvent).token);
              break;
            case "latency":
              callbacks.onLatency(data as SSELatencyEvent);
              break;
            case "done":
              callbacks.onDone();
              break;
          }
          eventType = "";
        }
      }
    }
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}

