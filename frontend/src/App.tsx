import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ChatPage } from "@/pages/ChatPage";
import { IngestPage } from "@/pages/IngestPage";
import { EvalPage } from "@/pages/EvalPage";
import { CollectionsPage } from "@/pages/CollectionsPage";
import { ToastLayer } from "@/components/layout/ToastLayer";

export function App() {
  return (
    <BrowserRouter>
      <div className="flex h-screen w-screen bg-bg">
        <AppShell>
          <Routes>
            <Route path="/" element={<Navigate to="/chat" replace />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/ingest" element={<IngestPage />} />
            <Route path="/eval" element={<EvalPage />} />
            <Route path="/collections" element={<CollectionsPage />} />
          </Routes>
        </AppShell>
        <ToastLayer />
      </div>
    </BrowserRouter>
  );
}

