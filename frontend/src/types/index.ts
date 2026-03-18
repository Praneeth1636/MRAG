// Shared TypeScript types matching backend schemas

// --- Health ---
export interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  ollama_connected: boolean;
  ollama_models: string[];
  chromadb_connected: boolean;
  collections_count: number;
}

// --- Collections ---
export interface CollectionInfo {
  name: string;
  document_count: number;
  metadata: Record<string, any> | null;
}

// --- Ingestion ---
export type JobStatus = "pending" | "processing" | "completed" | "failed";

export interface IngestResponse {
  job_id: string;
  status: JobStatus;
  message: string;
}

export interface IngestJobDetail {
  job_id: string;
  status: JobStatus;
  collection_name: string;
  files: string[];
  total_chunks: number;
  processed_files: number;
  total_files: number;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

// --- Query ---
export interface QueryRequest {
  question: string;
  collection_name: string;
  model: string;
  top_k: number;
  stream: boolean;
}

export interface SourceChunk {
  content: string;
  source_file: string;
  page_number: number | null;
  content_type: string;
  relevance_score: number;
  chunk_index: number;
}

export interface LatencyBreakdown {
  retrieval_ms: number;
  generation_ms: number;
  total_ms: number;
}

export interface QueryResponse {
  answer: string;
  sources: SourceChunk[];
  model_used: string;
  latency_ms: Record<string, number>;
}

// --- Chat UI State ---
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: SourceChunk[];
  latency?: LatencyBreakdown;
  model?: string;
  isStreaming?: boolean;
  timestamp: Date;
}

// --- SSE Events ---
export interface SSESourceEvent {
  content: string;
  source_file: string;
  page_number: number | null;
  content_type: string;
  relevance_score: number;
  chunk_index: number;
}

export interface SSETokenEvent {
  token: string;
}

export interface SSELatencyEvent {
  retrieval_ms: number;
  generation_ms: number;
  total_ms: number;
}

// --- Evaluation ---
export interface EvalRequest {
  collection_name: string;
  dataset_path?: string;
  model: string;
  top_k: number;
}

export interface EvalMetrics {
  faithfulness: number;
  relevance: number;
  context_precision: number;
  context_recall: number;
  latency: number;
}

export interface EvalQuestionResult {
  qa_pair_id: string;
  question: string;
  generated_answer: string;
  expected_answer: string;
  retrieved_chunk_ids: string[];
  metrics: EvalMetrics;
  details: Record<string, any>;
}

export interface LatencySummaryStage {
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  min: number;
  max: number;
  threshold?: number;
  violations?: number;
  violation_rate?: number;
}

export interface EvalReport {
  dataset_name: string;
  model_used: string;
  collection_name: string;
  top_k: number;
  total_questions: number;
  aggregate_scores: EvalMetrics;
  per_question_results: EvalQuestionResult[];
  latency_summary: Record<string, LatencySummaryStage>;
  timestamp: string;
  duration_seconds: number;
}

export interface EvalJob {
  status: "running" | "completed" | "failed";
  report: EvalReport | null;
  error: string | null;
}

