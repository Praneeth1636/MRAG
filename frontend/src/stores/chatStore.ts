import { create } from "zustand";
import type { ChatMessage, LatencyBreakdown, SourceChunk } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  selectedCollection: string;
  selectedModel: string;
  topK: number;

  addUserMessage: (content: string) => string;
  startAssistantMessage: () => string;
  appendToken: (id: string, token: string) => void;
  addSource: (id: string, source: SourceChunk) => void;
  setLatency: (id: string, latency: LatencyBreakdown) => void;
  finalizeMessage: (id: string) => void;
  setCollection: (name: string) => void;
  setModel: (name: string) => void;
  setTopK: (k: number) => void;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  selectedCollection: "",
  selectedModel: "llama3",
  topK: 5,

  addUserMessage: (content) => {
    const id = crypto.randomUUID();
    const msg: ChatMessage = {
      id,
      role: "user",
      content,
      timestamp: new Date()
    };
    set((s) => ({ messages: [...s.messages, msg] }));
    return id;
  },

  startAssistantMessage: () => {
    const id = crypto.randomUUID();
    const msg: ChatMessage = {
      id,
      role: "assistant",
      content: "",
      isStreaming: true,
      timestamp: new Date()
    };
    set((s) => ({ messages: [...s.messages, msg], isStreaming: true }));
    return id;
  },

  appendToken: (id, token) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, content: m.content + token } : m
      )
    })),

  addSource: (id, source) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id
          ? { ...m, sources: [...(m.sources || []), source] }
          : m
      )
    })),

  setLatency: (id, latency) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, latency } : m
      )
    })),

  finalizeMessage: (id) =>
    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === id ? { ...m, isStreaming: false } : m
      ),
      isStreaming: false
    })),

  setCollection: (name) => set({ selectedCollection: name }),
  setModel: (name) => set({ selectedModel: name }),
  setTopK: (k) => set({ topK: k }),
  clearMessages: () => set({ messages: [] })
}));

