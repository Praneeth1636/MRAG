import { useEffect, useState } from "react";
import { getIngestStatus, ingestDocuments } from "@/lib/api";
import type { IngestJobDetail } from "@/types";

export function IngestPage() {
  const [collectionName, setCollectionName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [jobs, setJobs] = useState<IngestJobDetail[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setJobs((current) => {
        current.forEach(async (job) => {
          if (job.status === "completed" || job.status === "failed") return;
          const updated = await getIngestStatus(job.job_id);
          setJobs((prev) =>
            prev.map((j) => (j.job_id === updated.job_id ? updated : j))
          );
        });
        return current;
      });
    }, 2000);
    return () => clearInterval(id);
  }, []);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setFiles((prev) => [...prev, ...Array.from(newFiles)]);
  };

  const handleUpload = async () => {
    if (!collectionName || files.length === 0) return;
    setUploading(true);
    try {
      const res = await ingestDocuments(files, collectionName);
      const detail = await getIngestStatus(res.job_id);
      setJobs((prev) => [detail, ...prev]);
      setFiles([]);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-zinc-950/80 px-8 py-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M4 4h16v12H6l-2 4V4z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-semibold tracking-tight">Ingest</h1>
            <p className="text-[11px] text-zinc-500">
              Upload PDFs, images, and text into a collection
            </p>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-6">
        <div className="rounded-2xl border border-white/[0.06] bg-zinc-950/90 p-5 shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
          <div className="mb-3 text-sm font-semibold">Ingest documents</div>
        <div className="mb-3 flex gap-3">
          <input
            type="text"
            value={collectionName}
            onChange={(e) => setCollectionName(e.target.value)}
            placeholder="Collection name"
              className="flex-1 rounded-xl border border-white/[0.08] bg-zinc-950/80 px-3.5 py-2.5 text-sm outline-none placeholder:text-zinc-600 focus:border-primary focus:ring-2 focus:ring-primary/40"
          />
        </div>
          <div className="mb-3 rounded-2xl border border-dashed border-white/[0.08] bg-zinc-950/80 p-6 text-center text-xs text-zinc-500">
          <input
            id="file-input"
            type="file"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp"
          />
          <label
            htmlFor="file-input"
              className="cursor-pointer font-medium text-zinc-100"
          >
            Click to select files
          </label>
          <div className="mt-1">
            or drag and drop PDF, TXT, MD, CSV, PNG, JPG, WEBP (max 50MB each)
          </div>
        </div>
          {files.length > 0 && (
            <ul className="mb-3 space-y-1 text-xs text-zinc-300">
            {files.map((f) => (
              <li key={f.name} className="flex items-center justify-between">
                <span>{f.name}</span>
              </li>
            ))}
          </ul>
        )}
          <button
            type="button"
            disabled={!collectionName || files.length === 0 || uploading}
            onClick={() => void handleUpload()}
            className="mt-1 inline-flex items-center justify-center rounded-xl border border-white/[0.08] bg-white px-4 py-2 text-xs font-semibold text-zinc-950 shadow-sm transition hover:bg-zinc-200 active:scale-[0.97] disabled:cursor-not-allowed disabled:border-white/[0.02] disabled:bg-white/40"
          >
            {uploading ? "Uploading..." : "Upload & Process"}
          </button>
      </div>
        <div className="flex-1 rounded-2xl border border-white/[0.06] bg-zinc-950/90 p-5 text-sm shadow-[0_18px_45px_rgba(0,0,0,0.55)]">
          <div className="mb-2 font-semibold">Recent jobs</div>
        {jobs.length === 0 && (
          <div className="mt-4 text-xs text-muted-foreground">
            No ingestion jobs yet.
          </div>
        )}
          <div className="space-y-2">
          {jobs.map((job) => {
            const progress =
              job.total_files > 0
                ? (job.processed_files / job.total_files) * 100
                : 0;
            return (
              <div
                key={job.job_id}
                className="rounded-xl border border-white/[0.06] bg-zinc-950/80 p-3"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-zinc-200">
                    {job.collection_name}
                  </span>
                  <span className="capitalize text-zinc-500">{job.status}</span>
                </div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-white/[0.04]">
                  <div
                    className="h-1.5 rounded-full bg-emerald-400/80"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="mt-1 text-[11px] text-zinc-500">
                  {job.processed_files}/{job.total_files} files ·{" "}
                  {job.total_chunks} chunks
                </div>
                {job.error && (
                  <div className="mt-1 text-[11px] text-rose-400">
                    Error: {job.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        </div>
      </div>
    </div>
  );
}

