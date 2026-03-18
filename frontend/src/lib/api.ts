import axios from "axios";
import type {
  HealthResponse,
  CollectionInfo,
  IngestResponse,
  IngestJobDetail,
  QueryRequest,
  QueryResponse,
  EvalRequest,
  EvalJob
} from "@/types";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? "" : "http://localhost:8000"),
  headers: { "Content-Type": "application/json" }
});

// Health
export const getHealth = () =>
  api.get<HealthResponse>("/api/v1/health").then((r) => r.data);

// Collections
export const getCollections = () =>
  api
    .get<{ collections: CollectionInfo[] }>("/api/v1/collections")
    .then((r) => r.data.collections);

export const deleteCollection = (name: string) =>
  api.delete(`/api/v1/collections/${encodeURIComponent(name)}`);

// Ingestion
export const ingestDocuments = (files: File[], collectionName: string) => {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  formData.append("collection_name", collectionName);
  return api
    .post<IngestResponse>("/api/v1/ingest", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    })
    .then((r) => r.data);
};

export const getIngestStatus = (jobId: string) =>
  api.get<IngestJobDetail>(`/api/v1/ingest/${jobId}`).then((r) => r.data);

// Query non-streaming
export const queryRag = (req: QueryRequest) =>
  api
    .post<QueryResponse>("/api/v1/query", { ...req, stream: false })
    .then((r) => r.data);

// Evaluation
export const startEvaluation = (req: EvalRequest) =>
  api.post<{ job_id: string }>("/api/v1/evaluate", req).then((r) => r.data);

export const getEvalStatus = (jobId: string) =>
  api.get<EvalJob>(`/api/v1/evaluate/${jobId}`).then((r) => r.data);

export default api;

