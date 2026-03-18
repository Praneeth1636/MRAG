import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { ChatPage } from "@/pages/ChatPage";
import { IngestPage } from "@/pages/IngestPage";
import { EvalDashboard } from "@/pages/EvalDashboard";
import { CollectionsPage } from "@/pages/CollectionsPage";

export function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/chat" replace />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/ingest" element={<IngestPage />} />
          <Route path="/eval" element={<EvalDashboard />} />
          <Route path="/collections" element={<CollectionsPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}

