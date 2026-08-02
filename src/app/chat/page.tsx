"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  PaperPlaneRight,
  Trash,
  Sparkle,
  User,
  Robot,
  Plus,
  Sidebar,
  ChatCircleText,
  Lightbulb,
  Wrench,
  Database,
  WarningCircle,
  CaretLeft,
  FileText,
  X,
  FileCode,
} from "@phosphor-icons/react";
import { useModel } from "@/context/ModelContext";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import ModelSelector from "@/components/ModelSelector";
import Link from "next/link";
import { extractPRDTitle } from "@/lib/prd-utils";
import { getPRDQuotaStatus, incrementChatCount } from "@/lib/quota";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  prdContent?: string;
  prdTitle?: string;
  projectBrief?: string;
  createdAt: number;
}

interface SavedPRDItem {
  id: string;
  title: string;
  content: string;
}

const QUICK_SUGGESTIONS = [
  {
    icon: Lightbulb,
    label: "Estimasi waktu MVP",
    prompt: "Berapa estimasi pengerjaan MVP ini dan bagaimana pembagian milestone pengembangannya?",
  },
  {
    icon: Wrench,
    label: "Rekomendasi Tech Stack",
    prompt: "Apa rekomendasi tech stack, library, dan infrastruktur terbaik untuk proyek ini?",
  },
  {
    icon: Database,
    label: "Alur Data & Relasi",
    prompt: "Tolong jelaskan alur data utama dan struktur relasi entitas/database berdasarkan PRD ini.",
  },
  {
    icon: WarningCircle,
    label: "Potensi Risiko Teknis",
    prompt: "Apa saja potensi kendala teknis, bottleneck performance, atau risiko keamanan yang perlu diwaspadai?",
  },
];

const LOCAL_STORAGE_KEY = "buatprd_chat_history_v1";

export default function ChatPage() {
  const { selectedModel } = useModel();
  const { user, signInWithGoogle } = useAuth();
  const quota = getPRDQuotaStatus(user);

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Collapsed by default on small screens

  // PRD Context State
  const [activePrdContent, setActivePrdContent] = useState<string>("");
  const [activePrdTitle, setActivePrdTitle] = useState<string>("");
  const [savedPRDs, setSavedPRDs] = useState<SavedPRDItem[]>([]);
  const [showPRDDropdown, setShowPRDDropdown] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Set default sidebar open state based on screen width
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      setIsSidebarOpen(true);
    }
  }, []);

  // Check sessionStorage / localStorage for active PRD context on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const draftPrd = sessionStorage.getItem("draft_prd") || sessionStorage.getItem("active_prd_context");
      if (draftPrd) {
        setActivePrdContent(draftPrd);
        const title = sessionStorage.getItem("active_prd_title") || extractPRDTitle(draftPrd);
        setActivePrdTitle(title);
      }
    }
  }, []);

  // Fetch saved PRDs from Firestore if user logged in
  useEffect(() => {
    if (!user) return;
    const fetchPRDs = async () => {
      try {
        const q = query(collection(db, "prds"), where("uid", "==", user.uid));
        const snap = await getDocs(q);
        const list: SavedPRDItem[] = [];
        snap.forEach((docSnap) => {
          const d = docSnap.data();
          const content = d.content || "";
          const title = d.title || extractPRDTitle(content);
          list.push({ id: docSnap.id, title, content });
        });
        setSavedPRDs(list);
      } catch (err) {
        console.error("Error fetching saved PRDs for chat:", err);
      }
    };
    fetchPRDs();
  }, [user]);

  // Load chat sessions from localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed: ChatSession[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed);
            setActiveSessionId(parsed[0].id);
            if (parsed[0].prdContent && !activePrdContent) {
              setActivePrdContent(parsed[0].prdContent);
              setActivePrdTitle(parsed[0].prdTitle || "PRD Document");
            }
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    }
  }, []);

  // Save chat sessions to localStorage
  useEffect(() => {
    if (typeof window !== "undefined" && sessions.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
      } catch (err) {
        console.error("Failed to save chat history:", err);
      }
    }
  }, [sessions]);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  // Sync session PRD context when active session changes
  useEffect(() => {
    if (activeSession?.prdContent) {
      setActivePrdContent(activeSession.prdContent);
      setActivePrdTitle(activeSession.prdTitle || extractPRDTitle(activeSession.prdContent));
    }
  }, [activeSessionId]);

  const handleCreateNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      title: activePrdTitle ? `Chat: ${activePrdTitle.slice(0, 20)}...` : "Obrolan Baru",
      messages: [],
      prdContent: activePrdContent,
      prdTitle: activePrdTitle,
      createdAt: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setError(null);
    setInput("");
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [activePrdContent, activePrdTitle]);

  useEffect(() => {
    if (sessions.length === 0) {
      handleCreateNewChat();
    }
  }, [sessions.length, handleCreateNewChat]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (activeSession?.messages.length) {
      scrollToBottom();
    }
  }, [activeSession?.messages, scrollToBottom]);

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Hapus riwayat obrolan ini?")) {
      const updated = sessions.filter((s) => s.id !== sessionId);
      setSessions(updated);
      if (activeSessionId === sessionId) {
        setActiveSessionId(updated.length > 0 ? updated[0].id : null);
      }
      if (updated.length === 0 && typeof window !== "undefined") {
        localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
    }
  };

  const handleAttachPRD = (prd: SavedPRDItem) => {
    setActivePrdContent(prd.content);
    setActivePrdTitle(prd.title);
    setShowPRDDropdown(false);

    if (activeSessionId) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, prdContent: prd.content, prdTitle: prd.title }
            : s
        )
      );
    }
  };

  const handleDetachPRD = () => {
    setActivePrdContent("");
    setActivePrdTitle("");
    if (activeSessionId) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, prdContent: "", prdTitle: "" }
            : s
        )
      );
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || isStreaming) return;

    if (!user) {
      setError("Silakan Sign In dengan Google untuk menggunakan AI Chatbot.");
      return;
    }

    if (quota.chatCount >= 10) {
      setError("Batas kuota 10 pertanyaan AI Chatbot gratis telah tercapai (10/10).");
      return;
    }

    incrementChatCount(user);

    let targetSessionId = activeSessionId;
    let currentSessions = [...sessions];

    if (!targetSessionId || !currentSessions.some((s) => s.id === targetSessionId)) {
      const newSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: messageText.slice(0, 28) + (messageText.length > 28 ? "..." : ""),
        messages: [],
        prdContent: activePrdContent,
        prdTitle: activePrdTitle,
        createdAt: Date.now(),
      };
      currentSessions = [newSession, ...currentSessions];
      targetSessionId = newSession.id;
      setSessions(currentSessions);
      setActiveSessionId(targetSessionId);
    }

    setError(null);
    setInput("");

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    const currentSessionObj = currentSessions.find((s) => s.id === targetSessionId);
    const existingMessages = currentSessionObj
      ? currentSessionObj.messages.filter((m) => m.content && m.content.trim().length > 0)
      : [];
    const updatedMessagesWithUser = [...existingMessages, userMessage];

    const isFirstMsg = existingMessages.length === 0;
    const sessionTitle = isFirstMsg
      ? messageText.slice(0, 28) + (messageText.length > 28 ? "..." : "")
      : currentSessionObj?.title || "Obrolan";

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? { ...s, title: sessionTitle, messages: updatedMessagesWithUser }
          : s
      )
    );

    const assistantId = `assistant-${Date.now()}`;
    const assistantMessage: Message = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    };

    setSessions((prev) =>
      prev.map((s) =>
        s.id === targetSessionId
          ? { ...s, messages: [...s.messages, assistantMessage] }
          : s
      )
    );

    setIsStreaming(true);

    try {
      const apiMessages = updatedMessagesWithUser.map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      const res = await fetch("/api/chat-prd", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prdContent: activePrdContent || currentSessionObj?.prdContent,
          projectBrief: currentSessionObj?.projectBrief,
          messages: apiMessages,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP Error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("Tidak ada stream data.");

      const decoder = new TextDecoder();
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        accumulatedText += chunk;

        setSessions((prev) =>
          prev.map((s) =>
            s.id === targetSessionId
              ? {
                  ...s,
                  messages: s.messages.map((m) =>
                    m.id === assistantId ? { ...m, content: accumulatedText } : m
                  ),
                }
              : s
          )
        );
      }
    } catch (err) {
      console.error("Error sending message:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Gagal menghubungkan dengan AI.";
      setError(errorMsg);

      setSessions((prev) =>
        prev.map((s) =>
          s.id === targetSessionId
            ? { ...s, messages: s.messages.filter((m) => m.id !== assistantId) }
            : s
        )
      );
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="flex-1 flex h-full min-h-0 w-full overflow-hidden bg-background relative">
      {/* Mobile Backdrop when Sidebar is Open */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* ChatGPT Sidebar (Chat History) */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -280, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -280, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed md:relative inset-y-0 left-0 z-50 md:z-auto w-72 md:w-72 bg-surface-1 border-r border-border/40 flex flex-col flex-shrink-0 h-full overflow-hidden select-none shadow-2xl md:shadow-none"
          >
            {/* Sidebar Top Header */}
            <div className="p-3 border-b border-border/40 flex items-center justify-between gap-2">
              <button
                onClick={handleCreateNewChat}
                className="flex-1 flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl bg-accent text-background font-bold text-xs hover:bg-accent-light transition-all cursor-pointer shadow-xs"
              >
                <Plus size={16} weight="bold" />
                <span>Obrolan baru</span>
              </button>
              <button
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 text-muted hover:text-foreground hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
                title="Sembunyikan sidebar"
              >
                <Sidebar size={18} />
              </button>
            </div>

            {/* History Sessions List */}
            <div className="flex-1 overflow-y-auto p-2.5 space-y-1 scrollbar-thin">
              <span className="block px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Terkini
              </span>

              {sessions.length === 0 ? (
                <p className="text-xs text-muted-foreground/60 px-3 py-4 text-center">
                  Belum ada riwayat obrolan.
                </p>
              ) : (
                sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        setActiveSessionId(s.id);
                        if (typeof window !== "undefined" && window.innerWidth < 768) {
                          setIsSidebarOpen(false);
                        }
                      }}
                      className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                        isActive
                          ? "bg-surface-2 font-bold text-foreground border border-border/60 shadow-xs"
                          : "text-muted hover:text-foreground hover:bg-surface-2/50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <ChatCircleText
                          size={16}
                          className={isActive ? "text-accent" : "text-muted-foreground"}
                        />
                        <span className="truncate">{s.title}</span>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(s.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all cursor-pointer"
                        title="Hapus obrolan"
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Chat Content Area */}
      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-background relative">
        {/* Auth Required Overlay for Guests */}
        {!user && (
          <div className="absolute inset-0 z-40 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md">
            <div className="max-w-md w-full bg-surface-1 border border-border rounded-3xl p-8 text-center space-y-4 shadow-2xl">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto shadow-md">
                <Robot size={36} weight="fill" />
              </div>
              <h3 className="text-xl font-bold text-foreground">
                Sign In untuk AI Chatbot
              </h3>
              <p className="text-xs text-muted leading-relaxed">
                Fitur AI Chatbot membutuhkan akun. Silakan Sign In dengan Google untuk mendapatkan kuota <strong>10 pertanyaan gratis</strong> seputar arsitektur & PRD!
              </p>
              <button
                onClick={signInWithGoogle}
                className="w-full py-3 px-4 rounded-xl bg-accent text-zinc-950 font-bold text-sm hover:bg-accent-hover transition-all cursor-pointer shadow-lg shadow-accent-glow"
              >
                Sign In dengan Google
              </button>
            </div>
          </div>
        )}
        {/* Main Header Toolbar */}
        <div className="h-14 px-3 sm:px-6 border-b border-border/40 bg-surface-1/40 backdrop-blur-md flex items-center justify-between flex-shrink-0 gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 sm:p-2 text-muted hover:text-foreground hover:bg-surface-2 rounded-xl transition-colors cursor-pointer flex-shrink-0"
                title="Buka sidebar riwayat"
              >
                <Sidebar size={20} />
              </button>
            )}

            <Link
              href="/"
              className="p-1.5 sm:p-2 text-muted hover:text-foreground hover:bg-surface-2 rounded-xl transition-colors hidden sm:flex items-center gap-1.5 text-xs font-medium flex-shrink-0"
              title="Kembali ke Generator"
            >
              <CaretLeft size={16} />
              <span>Generator</span>
            </Link>

            <div className="h-4 w-px bg-border/40 hidden sm:block flex-shrink-0" />

            <h1 className="font-bold text-xs sm:text-base truncate max-w-[130px] sm:max-w-[320px]">
              {activeSession?.title || "AI Chatbot Assistant"}
            </h1>

            {user && (
              <span className="text-[10px] sm:text-xs font-mono px-2 py-0.5 rounded-full bg-surface-2 border border-border/60 text-muted flex-shrink-0">
                Kuota: <strong className="text-accent">{quota.chatCount}/10</strong>
              </span>
            )}
          </div>

          {/* Active PRD Context Badge & Switcher */}
          <div className="relative flex-shrink-0">
            {activePrdTitle ? (
              <div className="flex items-center gap-1.5 px-2.5 py-1 sm:px-3 sm:py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-400 text-[11px] sm:text-xs font-medium shadow-xs">
                <FileText size={14} weight="fill" className="flex-shrink-0" />
                <span className="truncate max-w-[110px] sm:max-w-[220px]">
                  PRD: {activePrdTitle}
                </span>
                <button
                  onClick={handleDetachPRD}
                  className="hover:bg-emerald-500/20 p-0.5 rounded text-emerald-400/80 hover:text-emerald-300 transition-colors cursor-pointer ml-1"
                  title="Lepaskan konteks PRD"
                >
                  <X size={12} weight="bold" />
                </button>
              </div>
            ) : (
              user && savedPRDs.length > 0 && (
                <div>
                  <button
                    onClick={() => setShowPRDDropdown((prev) => !prev)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border/60 text-[11px] sm:text-xs text-muted hover:text-foreground transition-all cursor-pointer whitespace-nowrap"
                  >
                    <FileCode size={14} className="text-accent" />
                    <span>Lampirkan PRD</span>
                  </button>

                  {showPRDDropdown && (
                    <div className="absolute right-0 mt-2 w-64 bg-surface-1 border border-border/80 rounded-2xl p-2 shadow-xl z-50 space-y-1">
                      <span className="block px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
                        Pilih PRD Tersimpan
                      </span>
                      {savedPRDs.map((prd) => (
                        <button
                          key={prd.id}
                          onClick={() => handleAttachPRD(prd)}
                          className="w-full text-left px-3 py-2 rounded-xl text-xs hover:bg-surface-2 text-foreground truncate block cursor-pointer"
                        >
                          {prd.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="bg-red-500/10 border-b border-red-500/20 px-4 py-2 text-xs text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="hover:underline font-medium">
              Tutup
            </button>
          </div>
        )}

        {/* Message Stream Container */}
        <div className="flex-1 h-0 min-h-0 overflow-y-auto p-3 sm:p-6 space-y-5 sm:space-y-6 scrollbar-thin max-w-4xl mx-auto w-full">
          {!activeSession || activeSession.messages.length === 0 ? (
            /* Empty State: ChatGPT "Dari mana kita harus mulai?" style */
            <div className="flex-1 flex flex-col items-center justify-center text-center px-2 sm:px-4 py-4 sm:py-6 my-auto">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-accent-muted border border-accent/30 flex items-center justify-center text-accent mb-3 sm:mb-4 shadow-sm">
                <Sparkle size={26} weight="fill" className="sm:w-7 sm:h-7" />
              </div>

              <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
                Dari mana kita harus mulai?
              </h2>

              <p className="text-xs sm:text-sm text-muted max-w-[45ch] mb-4 sm:mb-6 leading-relaxed px-2">
                Tanyakan apa saja seputar ide produk, arsitektur software, rekomendasi tech stack, atau analisa PRD Anda.
              </p>

              {/* Active PRD Info Card if PRD attached */}
              {activePrdTitle && (
                <div className="mb-6 px-3 py-2 sm:px-4 sm:py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2 max-w-md">
                  <FileText size={16} weight="fill" className="flex-shrink-0" />
                  <span className="truncate">Konteks PRD: <strong>{activePrdTitle}</strong></span>
                </div>
              )}

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 w-full max-w-2xl">
                {QUICK_SUGGESTIONS.map((item, idx) => {
                  const IconComp = item.icon;
                  return (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(item.prompt)}
                      className="flex items-start gap-3 p-3.5 sm:p-4 rounded-2xl bg-surface-1 hover:bg-surface-2 border border-border/60 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group"
                    >
                      <div className="p-2 sm:p-2.5 rounded-xl bg-surface-2 text-accent group-hover:bg-accent group-hover:text-background transition-colors flex-shrink-0">
                        <IconComp size={18} weight="bold" />
                      </div>
                      <div className="flex-1">
                        <span className="block text-xs sm:text-sm font-bold text-foreground mb-0.5">
                          {item.label}
                        </span>
                        <span className="block text-[11px] sm:text-xs text-muted leading-relaxed line-clamp-2">
                          {item.prompt}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Conversation Messages */
            activeSession.messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 sm:gap-4 ${
                    isUser ? "justify-end" : "justify-start"
                  }`}
                >
                  {!isUser && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-accent-muted border border-accent/30 flex items-center justify-center text-accent flex-shrink-0 mt-1 shadow-xs">
                      <Robot size={16} weight="fill" className="sm:w-4 sm:h-4" />
                    </div>
                  )}

                  <div
                    className={`max-w-[90%] sm:max-w-[82%] rounded-2xl p-3.5 sm:p-5 text-xs sm:text-sm leading-relaxed ${
                      isUser
                        ? "bg-accent text-background font-medium rounded-tr-xs shadow-xs"
                        : "bg-surface-1 border border-border/60 text-foreground rounded-tl-xs"
                    }`}
                  >
                    {isUser ? (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    ) : msg.content ? (
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          p: ({ children }) => (
                            <p className="mb-3 last:mb-0 leading-relaxed">{children}</p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-5 mb-3 space-y-1">{children}</ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-5 mb-3 space-y-1">{children}</ol>
                          ),
                          code: ({ children }) => (
                            <code className="bg-surface-2 border border-border/60 px-1.5 py-0.5 rounded text-[11px] font-mono text-accent">
                              {children}
                            </code>
                          ),
                          pre: ({ children }) => (
                            <pre className="bg-surface-2 border border-border p-3 sm:p-4 rounded-xl font-mono text-xs overflow-x-auto my-3 leading-relaxed">
                              {children}
                            </pre>
                          ),
                        }}
                      >
                        {msg.content}
                      </ReactMarkdown>
                    ) : (
                      <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
                        <span className="w-2 h-2 bg-accent rounded-full animate-bounce" />
                        <span
                          className="w-2 h-2 bg-accent rounded-full animate-bounce"
                          style={{ animationDelay: "0.15s" }}
                        />
                        <span
                          className="w-2 h-2 bg-accent rounded-full animate-bounce"
                          style={{ animationDelay: "0.3s" }}
                        />
                      </div>
                    )}

                    <span
                      className={`block text-[9px] mt-2 text-right ${
                        isUser ? "text-background/70" : "text-muted-foreground/60"
                      }`}
                    >
                      {msg.timestamp}
                    </span>
                  </div>

                  {isUser && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-surface-2 border border-border/80 flex items-center justify-center text-muted flex-shrink-0 mt-1">
                      <User size={16} weight="bold" className="sm:w-4 sm:h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ChatGPT Style Bottom Input Bar with ModelSelector NEXT TO Send Button */}
        <div className="p-3 sm:p-4 pb-4 bg-gradient-to-t from-background via-background to-transparent flex-shrink-0 max-w-4xl mx-auto w-full">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="relative flex flex-col sm:flex-row items-stretch sm:items-center bg-surface-1 border border-border/80 focus-within:border-accent/60 rounded-2xl p-2 sm:p-2.5 transition-colors shadow-lg gap-2"
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                activePrdTitle
                  ? `Tanyakan tentang PRD "${activePrdTitle}"...`
                  : "Tanyakan apa saja..."
              }
              disabled={isStreaming}
              rows={1}
              className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none max-h-36 scrollbar-thin transition-colors"
            />

            {/* ModelSelector & Send Button grouped right next to each other */}
            <div className="flex items-center justify-between sm:justify-end gap-2 flex-shrink-0 border-t sm:border-t-0 border-border/30 pt-2 sm:pt-0">
              <ModelSelector />

              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                className="p-2.5 bg-accent text-background rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer flex-shrink-0 shadow-xs"
                title="Kirim Pesan"
              >
                {isStreaming ? (
                  <span className="w-4 h-4 border-2 border-background/20 border-t-background rounded-full animate-spin block" />
                ) : (
                  <PaperPlaneRight size={18} weight="fill" />
                )}
              </button>
            </div>
          </form>

          <p className="text-[10px] text-center text-muted-foreground/50 mt-2">
            AI Chatbot dapat membuat kesalahan. Selalu verifikasi informasi teknis penting.
          </p>
        </div>
      </div>
    </div>
  );
}
