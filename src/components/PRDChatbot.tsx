"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  PaperPlaneRight,
  X,
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
  ArrowsOutSimple,
  ArrowsInSimple,
  Check,
} from "@phosphor-icons/react";
import { useModel } from "@/context/ModelContext";

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
  projectBrief?: string;
  createdAt: number;
}

interface PRDChatbotProps {
  isOpen: boolean;
  onClose: () => void;
  prdContent?: string;
  projectBrief?: string;
  summary?: any;
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
    prompt: "Apa rekomendasi tech stack, library, dan infrastruktur terbaik untuk mengimplementasikan PRD ini?",
  },
  {
    icon: Database,
    label: "Alur Data & Relasi",
    prompt: "Tolong jelaskan alur data utama dan struktur relasi entitas/database berdasarkan PRD ini.",
  },
  {
    icon: WarningCircle,
    label: "Potensi Risiko Teknis",
    prompt: "Apa saja potensi kendala teknis, bottleneck performance, atau risiko keamanan dalam proyek ini?",
  },
];

const LOCAL_STORAGE_KEY = "buatprd_chat_history_v1";

export default function PRDChatbot({
  isOpen,
  onClose,
  prdContent,
  projectBrief,
  summary,
}: PRDChatbotProps) {
  const { selectedModel } = useModel();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load chat sessions from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
          const parsed: ChatSession[] = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setSessions(parsed);
            setActiveSessionId(parsed[0].id);
            return;
          }
        }
      } catch (err) {
        console.error("Failed to load chat history:", err);
      }
    }
  }, []);

  // Save chat sessions to localStorage whenever sessions change
  useEffect(() => {
    if (typeof window !== "undefined" && sessions.length > 0) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(sessions));
      } catch (err) {
        console.error("Failed to save chat history:", err);
      }
    }
  }, [sessions]);

  // Create initial session if none exists
  const activeSession = sessions.find((s) => s.id === activeSessionId) || null;

  const handleCreateNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: `chat-${Date.now()}`,
      title: prdContent ? "Diskusi PRD Baru" : "Obrolan Baru",
      messages: [],
      prdContent: prdContent || "",
      projectBrief: projectBrief || "",
      createdAt: Date.now(),
    };

    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setError(null);
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 150);
  }, [prdContent, projectBrief]);

  // If no sessions, create one on open
  useEffect(() => {
    if (isOpen && sessions.length === 0) {
      handleCreateNewChat();
    }
  }, [isOpen, sessions.length, handleCreateNewChat]);

  // Auto-scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (isOpen && activeSession?.messages.length) {
      scrollToBottom();
    }
  }, [isOpen, activeSession?.messages, scrollToBottom]);

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Hapus riwayat percakapan ini?")) {
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

  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || isStreaming) return;

    let targetSessionId = activeSessionId;
    let currentSessions = [...sessions];

    // If no active session, create one first
    if (!targetSessionId || !currentSessions.some((s) => s.id === targetSessionId)) {
      const newSession: ChatSession = {
        id: `chat-${Date.now()}`,
        title: messageText.slice(0, 30) + (messageText.length > 30 ? "..." : ""),
        messages: [],
        prdContent: prdContent || "",
        projectBrief: projectBrief || "",
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

    // Update active session messages
    const currentSessionObj = currentSessions.find((s) => s.id === targetSessionId);
    const existingMessages = currentSessionObj ? currentSessionObj.messages : [];
    const updatedMessagesWithUser = [...existingMessages, userMessage];

    // Generate title from first user message if title is default
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

    // Assistant response placeholder
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
          prdContent: currentSessionObj?.prdContent || prdContent,
          projectBrief: currentSessionObj?.projectBrief || projectBrief,
          summary,
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
      console.error("Error sending message to Chatbot:", err);
      const errorMsg =
        err instanceof Error ? err.message : "Gagal menghubungkan dengan AI.";
      setError(errorMsg);

      // Remove in-progress assistant message on error
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
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop for mobile */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden"
          />

          {/* Full ChatGPT-style Window */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ type: "spring", stiffness: 120, damping: 20 }}
            className={`fixed z-50 flex bg-surface-1 border border-border/80 rounded-3xl shadow-[0_30px_70px_-15px_rgba(0,0,0,0.6)] overflow-hidden transition-all duration-300 ${
              isExpanded
                ? "inset-2 sm:inset-6 md:inset-8"
                : "bottom-4 right-4 left-4 sm:left-auto sm:w-[620px] h-[680px] max-h-[90dvh]"
            }`}
          >
            {/* ChatGPT Left Sidebar: Chat History */}
            <AnimatePresence mode="wait">
              {isSidebarOpen && (
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "260px", opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-surface-2/90 border-r border-border/50 flex flex-col flex-shrink-0 h-full overflow-hidden select-none"
                >
                  {/* Sidebar Header: New Chat */}
                  <div className="p-3 border-b border-border/40 flex items-center justify-between gap-2">
                    <button
                      onClick={handleCreateNewChat}
                      className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-accent text-background font-bold text-xs hover:bg-accent-light transition-all cursor-pointer shadow-sm"
                    >
                      <Plus size={16} weight="bold" />
                      <span>Obrolan baru</span>
                    </button>
                    <button
                      onClick={() => setIsSidebarOpen(false)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-surface-3 rounded-lg transition-colors cursor-pointer"
                      title="Sembunyikan sidebar"
                    >
                      <Sidebar size={18} />
                    </button>
                  </div>

                  {/* History Sessions List */}
                  <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
                    <span className="block px-2.5 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
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
                            onClick={() => setActiveSessionId(s.id)}
                            className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs transition-all cursor-pointer ${
                              isActive
                                ? "bg-surface-1 font-semibold text-foreground border border-border/60 shadow-xs"
                                : "text-muted hover:text-foreground hover:bg-surface-3/50"
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <ChatCircleText
                                size={15}
                                className={isActive ? "text-accent" : "text-muted-foreground"}
                              />
                              <span className="truncate">{s.title}</span>
                            </div>

                            <button
                              onClick={(e) => handleDeleteSession(s.id, e)}
                              className="opacity-0 group-hover:opacity-100 p-1 text-muted-foreground hover:text-red-400 hover:bg-red-500/10 rounded transition-all cursor-pointer"
                              title="Hapus obrolan"
                            >
                              <Trash size={14} />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col h-full overflow-hidden bg-surface-1">
              {/* Chat Header Toolbar */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border/40 bg-surface-1/80 backdrop-blur-md">
                <div className="flex items-center gap-2.5">
                  {!isSidebarOpen && (
                    <button
                      onClick={() => setIsSidebarOpen(true)}
                      className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
                      title="Buka sidebar riwayat"
                    >
                      <Sidebar size={18} />
                    </button>
                  )}

                  <div className="w-8 h-8 rounded-lg bg-accent-muted border border-accent/30 flex items-center justify-center text-accent">
                    <Robot size={18} weight="fill" />
                  </div>

                  <div>
                    <h3 className="font-bold text-xs sm:text-sm leading-tight truncate max-w-[220px] sm:max-w-[320px]">
                      {activeSession?.title || "AI PRD Assistant"}
                    </h3>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{selectedModel}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={handleCreateNewChat}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-2 hover:bg-surface-3 text-xs text-foreground font-medium transition-colors cursor-pointer"
                    title="Obrolan baru"
                  >
                    <Plus size={14} weight="bold" />
                    <span className="hidden sm:inline">New Chat</span>
                  </button>

                  <button
                    onClick={() => setIsExpanded((prev) => !prev)}
                    className="hidden sm:flex p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
                    title={isExpanded ? "Kecilkan Window" : "Perbesar Window"}
                  >
                    {isExpanded ? <ArrowsInSimple size={16} /> : <ArrowsOutSimple size={16} />}
                  </button>

                  <button
                    onClick={onClose}
                    className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-2 rounded-lg transition-colors cursor-pointer"
                    title="Tutup Chat"
                  >
                    <X size={18} weight="bold" />
                  </button>
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

              {/* Messages View */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 scrollbar-thin">
                {!activeSession || activeSession.messages.length === 0 ? (
                  /* Empty state: ChatGPT "Dari mana kita harus mulai?" style */
                  <div className="flex flex-col items-center justify-center min-h-[70%] text-center px-4 py-12">
                    <div className="w-14 h-14 rounded-2xl bg-accent-muted border border-accent/30 flex items-center justify-center text-accent mb-4 shadow-sm">
                      <Sparkle size={28} weight="fill" />
                    </div>

                    <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-2">
                      Dari mana kita harus mulai?
                    </h2>

                    <p className="text-xs sm:text-sm text-muted-foreground max-w-[42ch] mb-8">
                      Tanyakan apa saja tentang PRD, alur aplikasi, rekomendasi tech stack, atau estimasi pengembangan proyek Anda.
                    </p>

                    {/* Quick suggestion cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
                      {QUICK_SUGGESTIONS.map((item, idx) => {
                        const IconComp = item.icon;
                        return (
                          <button
                            key={idx}
                            onClick={() => handleSendMessage(item.prompt)}
                            className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface-2/70 hover:bg-surface-3 border border-border/50 text-left transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer group"
                          >
                            <div className="p-2 rounded-xl bg-surface-1 text-accent group-hover:bg-accent group-hover:text-background transition-colors flex-shrink-0">
                              <IconComp size={18} weight="bold" />
                            </div>
                            <div className="flex-1">
                              <span className="block text-xs font-bold text-foreground mb-0.5">
                                {item.label}
                              </span>
                              <span className="block text-[11px] text-muted-foreground/80 leading-snug line-clamp-2">
                                {item.prompt}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Message list */
                  activeSession.messages.map((msg) => {
                    const isUser = msg.role === "user";
                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 ${
                          isUser ? "justify-end" : "justify-start"
                        }`}
                      >
                        {!isUser && (
                          <div className="w-8 h-8 rounded-xl bg-accent-muted border border-accent/30 flex items-center justify-center text-accent flex-shrink-0 mt-1 shadow-xs">
                            <Robot size={18} weight="fill" />
                          </div>
                        )}

                        <div
                          className={`max-w-[88%] sm:max-w-[82%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                            isUser
                              ? "bg-accent text-background font-medium rounded-tr-xs shadow-xs"
                              : "bg-surface-2/90 border border-border/60 text-foreground rounded-tl-xs"
                          }`}
                        >
                          {isUser ? (
                            <p className="whitespace-pre-wrap">{msg.content}</p>
                          ) : msg.content ? (
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => (
                                  <p className="mb-2.5 last:mb-0 leading-relaxed">{children}</p>
                                ),
                                ul: ({ children }) => (
                                  <ul className="list-disc pl-4 mb-2.5 space-y-1">{children}</ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="list-decimal pl-4 mb-2.5 space-y-1">{children}</ol>
                                ),
                                code: ({ children }) => (
                                  <code className="bg-surface-1 border border-border/60 px-1.5 py-0.5 rounded text-[11px] font-mono text-accent">
                                    {children}
                                  </code>
                                ),
                                pre: ({ children }) => (
                                  <pre className="bg-surface-1 border border-border p-3 rounded-xl font-mono text-xs overflow-x-auto my-3 leading-relaxed">
                                    {children}
                                  </pre>
                                ),
                              }}
                            >
                              {msg.content}
                            </ReactMarkdown>
                          ) : (
                            <div className="flex items-center gap-1.5 py-1 text-muted-foreground">
                              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce" />
                              <span
                                className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"
                                style={{ animationDelay: "0.15s" }}
                              />
                              <span
                                className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"
                                style={{ animationDelay: "0.3s" }}
                              />
                            </div>
                          )}

                          <span
                            className={`block text-[9px] mt-1.5 text-right ${
                              isUser ? "text-background/70" : "text-muted-foreground/60"
                            }`}
                          >
                            {msg.timestamp}
                          </span>
                        </div>

                        {isUser && (
                          <div className="w-8 h-8 rounded-xl bg-surface-3 border border-border/80 flex items-center justify-center text-muted-foreground flex-shrink-0 mt-1">
                            <User size={18} weight="bold" />
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Bottom Input Area (ChatGPT Style pill container) */}
              <div className="p-3 sm:p-4 border-t border-border/40 bg-surface-1/90 backdrop-blur-md">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="relative flex items-center bg-surface-2 border border-border/80 focus-within:border-accent/60 rounded-2xl p-2 transition-colors shadow-inner"
                >
                  <textarea
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Tanyakan apa saja..."
                    disabled={isStreaming}
                    rows={1}
                    className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none resize-none max-h-32 scrollbar-thin transition-colors"
                  />

                  <button
                    type="submit"
                    disabled={!input.trim() || isStreaming}
                    className="p-2.5 bg-accent text-background rounded-xl disabled:opacity-30 disabled:cursor-not-allowed hover:scale-[1.03] active:scale-[0.97] transition-all cursor-pointer flex-shrink-0 shadow-xs ml-2"
                    title="Kirim Pesan"
                  >
                    {isStreaming ? (
                      <span className="w-4 h-4 border-2 border-background/20 border-t-background rounded-full animate-spin block" />
                    ) : (
                      <PaperPlaneRight size={16} weight="fill" />
                    )}
                  </button>
                </form>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
