"use client";

import { useEffect, useRef, useMemo, memo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useReactToPrint } from "react-to-print";
import JSZip from "jszip";
import {
  Copy,
  DownloadSimple,
  ArrowCounterClockwise,
  Check,
  List,
  CloudArrowUp,
  TerminalWindow,
  FileText,
  Sparkle,
  Code,
  Archive,
  ChatCircleText,
} from "@phosphor-icons/react";
import MagneticButton from "./ui/MagneticButton";
import GlassCard from "./ui/GlassCard";
import MermaidRenderer from "./MermaidRenderer";
import PRDChatbot from "./PRDChatbot";
import { useAuth } from "@/context/AuthContext";
import { db, auth } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { extractPRDTitle } from "@/lib/prd-utils";

interface PRDOutputProps {
  markdown: string;
  isStreaming: boolean;
  onStartOver: () => void;
  projectBrief?: string;
  summary?: any;
  selectedModel?: string;
  onRegeneratePRD?: () => void;
}

type TabType = "prd" | "instruction" | "agents";

/* Check if a mermaid code block is complete */
function isCompleteMermaidBlock(md: string, blockContent: string): boolean {
  const idx = md.indexOf(blockContent);
  if (idx === -1) return false;
  const afterContent = md.substring(idx + blockContent.length);
  return /\n\s*```/.test(afterContent);
}

/* Isolated mermaid code block renderer */
const MermaidBlock = memo(function MermaidBlock({
  children,
  fullMarkdown,
}: {
  children: string;
  fullMarkdown: string;
}) {
  if (!isCompleteMermaidBlock(fullMarkdown, children)) {
    return (
      <div className="rounded-xl bg-surface-1 border border-border p-4 my-4">
        <div className="flex items-center gap-2 mb-2 text-xs text-accent">
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          <span>Generating diagram...</span>
        </div>
        <pre className="text-xs sm:text-sm font-mono text-muted overflow-x-auto whitespace-pre-wrap opacity-50">
          {children}
        </pre>
      </div>
    );
  }

  return <MermaidRenderer chart={children} />;
});

/* CodeBlock renderer with copy code button */
const CodeBlock = memo(function CodeBlock({ children }: { children: React.ReactNode }) {
  const [codeCopied, setCodeCopied] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  const handleCopyCode = async () => {
    const text = textRef.current?.innerText || "";
    try {
      await navigator.clipboard.writeText(text);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="relative group my-4 rounded-xl overflow-hidden bg-surface-1 border border-border">
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface-2/80 border-b border-border/50 text-[11px] text-muted-foreground font-mono">
        <span>Code Block / Specification</span>
        <button
          onClick={handleCopyCode}
          className="flex items-center gap-1 hover:text-accent transition-colors cursor-pointer"
          title="Copy code"
        >
          {codeCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
          <span>{codeCopied ? "Copied" : "Copy Code"}</span>
        </button>
      </div>
      <div ref={textRef} className="p-3 sm:p-4 overflow-x-auto font-mono text-xs sm:text-sm leading-relaxed text-muted">
        {children}
      </div>
    </div>
  );
});

/* Table of contents extractor */
function extractTOC(md: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = [];
  if (!md) return headings;
  const lines = md.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)/);
    if (match) {
      const level = match[1].length;
      const text = match[2].replace(/\*\*/g, "").trim();
      const id = text
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-");
      headings.push({ level, text, id });
    }
  }
  return headings;
}

export default function PRDOutput({
  markdown,
  isStreaming,
  onStartOver,
  projectBrief,
  summary,
  selectedModel,
  onRegeneratePRD,
}: PRDOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const autoTriggeredRef = useRef(false);
  const [copied, setCopied] = useState(false);
  const [isCopiedMarkdown, setIsCopiedMarkdown] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("prd");

  const [showTOC, setShowTOC] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const prdTitle = useMemo(() => extractPRDTitle(markdown, projectBrief, summary), [markdown, projectBrief, summary]);

  // Document contents state
  const [instructionMD, setInstructionMD] = useState("");
  const [agentsMD, setAgentsMD] = useState("");

  // Document streaming state
  const [generatingTab, setGeneratingTab] = useState<TabType | null>(null);
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);

  const { user, signInWithGoogle } = useAuth();

  // Current active content
  const activeContent = useMemo(() => {
    switch (activeTab) {
      case "prd":
        return markdown;
      case "instruction":
        return instructionMD;
      case "agents":
        return agentsMD;
      default:
        return markdown;
    }
  }, [activeTab, markdown, instructionMD, agentsMD]);

  const isCurrentStreaming = isStreaming && activeTab === "prd";
  const isDocGenerating = generatingTab === activeTab;

  const toc = useMemo(() => extractTOC(activeContent), [activeContent]);

  // Auto-scroll while streaming
  useEffect(() => {
    if ((isCurrentStreaming || isDocGenerating) && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [activeContent, isCurrentStreaming, isDocGenerating]);

  /* Helper to stream fetch a document */
  const fetchAndStream = async (
    endpoint: string,
    targetTab: TabType,
    setter: (val: string) => void
  ) => {
    setGeneratingTab(targetTab);
    setter("");

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: projectBrief,
          summary,
          prdContent: markdown,
          model: selectedModel,
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error ${res.status}`);
      }

      const reader = res.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        setter(fullText);
      }
    } catch (err) {
      console.error(`Error generating ${targetTab}:`, err);
      setter(`Gagal membuat konten dokumen. Silakan coba lagi.`);
    } finally {
      setGeneratingTab(null);
    }
  };

  /* Batch generator for INSTRUCTIONS.md & AGENTS.md */
  const handleGenerateAll = useCallback(async () => {
    if (isBatchGenerating || generatingTab) return;
    setIsBatchGenerating(true);
    try {
      if (!instructionMD) {
        await fetchAndStream("/api/generate-instruction", "instruction", setInstructionMD);
      }
      if (!agentsMD) {
        await fetchAndStream("/api/generate-agents", "agents", setAgentsMD);
      }
    } finally {
      setIsBatchGenerating(false);
    }
  }, [isBatchGenerating, generatingTab, instructionMD, agentsMD, projectBrief, summary, markdown, selectedModel]);

  // Auto-trigger background generation after PRD finishes streaming
  useEffect(() => {
    if (!isStreaming && markdown && markdown.length > 50 && !autoTriggeredRef.current && projectBrief) {
      autoTriggeredRef.current = true;
      handleGenerateAll();
    }
  }, [isStreaming, markdown, projectBrief, handleGenerateAll]);

  const handleSaveToCloud = async () => {
    if (!user) {
      try {
        await signInWithGoogle();
      } catch {
        return;
      }
    }

    setIsSaving(true);
    try {
      const title = extractPRDTitle(markdown, projectBrief, summary);

      await addDoc(collection(db, "prds"), {
        uid: auth.currentUser?.uid || user?.uid,
        userEmail: user?.email || "",
        userName: user?.displayName || "User",
        userPhoto: user?.photoURL || "",
        title,
        content: markdown,
        instructionMD,
        agentsMD,
        instructionsContent: instructionMD,
        agentsContent: agentsMD,
        docSuiteMap: {},
        createdAt: serverTimestamp(),
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving PRD:", error);
      alert("Gagal menyimpan PRD ke cloud. Silakan coba lagi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(activeContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = activeContent;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [activeContent]);

  const getDownloadFileName = (): string => {
    switch (activeTab) {
      case "prd":
        return "01_PRD_DOCUMENT.md";
      case "instruction":
        return "INSTRUCTIONS.md";
      case "agents":
        return "AGENTS.md";
      default:
        return "PRD_DOCUMENT.md";
    }
  };

  const handleDownload = useCallback(() => {
    const blob = new Blob([activeContent], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = getDownloadFileName();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeContent, activeTab]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${prdTitle} - PRD Document`,
    pageStyle: `
      @page { size: auto; margin: 20mm; }
      @media print {
        body { background: white !important; color: black !important; }
        .prose-prd { max-height: none !important; overflow: visible !important; }
        pre, code { white-space: pre-wrap !important; word-break: break-word !important; }
      }
    `,
  });

  const handleDownloadZip = useCallback(async () => {
    const zip = new JSZip();
    const title = extractPRDTitle(markdown, projectBrief, summary);

    if (markdown) {
      zip.file("01_PRD_DOCUMENT.md", markdown);
    }
    if (instructionMD) {
      zip.file("INSTRUCTIONS.md", instructionMD);
    }
    if (agentsMD) {
      zip.file("AGENTS.md", agentsMD);
      zip.file(".cursorrules", agentsMD);
      zip.file("CLAUDE.md", agentsMD);
    } else if (instructionMD) {
      zip.file("AGENTS.md", instructionMD);
      zip.file(".cursorrules", instructionMD);
      zip.file("CLAUDE.md", instructionMD);
    }

    const readme = `# ${title} — Vibe Coding & Agent Architecture Package

File-file berikut telah disiapkan oleh BuatPRD untuk siap dipakai oleh Developer & AI Coding Agents (Cursor / Windsurf / Claude Code / Antigravity):

1. **01_PRD_DOCUMENT.md**: Dokumen PRD utama lengkap (Overview, Flow, DB Schema, dan Features).
2. **INSTRUCTIONS.md**: Panduan eksekusi proyek langkah-demi-langkah bagi Developer/Tim.
3. **AGENTS.md / .cursorrules / CLAUDE.md**: Master rulebook operasional AI Agent (Inquiry-First Protocol & Modular Coding Guidelines).

Generated with BuatPRD — AI-Assisted PRD Architect.
`;
    zip.file("README_VIBE_CODING.md", readme);

    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.toLowerCase().replace(/[^a-z0-9]/g, "_")}_vibe_suite.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown, instructionMD, agentsMD, projectBrief, summary]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[1200px] mx-auto px-3 sm:px-6"
    >
      {/* Responsive Header Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4 pb-3 border-b border-border/40"
      >
        {/* Title & Status */}
        <div className="flex items-center justify-between w-full lg:w-auto gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowTOC((p) => !p)}
              className={`p-2 rounded-xl border transition-colors cursor-pointer ${
                showTOC
                  ? "bg-accent-muted text-accent border-accent/40"
                  : "bg-surface-2 text-muted hover:text-foreground border-border/60"
              }`}
              title="Table of Contents"
              id="toc-toggle"
            >
              <List size={18} weight="bold" />
            </button>
            <h2 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
              PRD & Agent Architect
            </h2>
            {(isCurrentStreaming || isDocGenerating || isBatchGenerating) && (
              <div className="flex items-center gap-1.5 text-xs text-accent bg-accent-muted px-2 py-0.5 rounded-full border border-accent/20">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
                <span>{isBatchGenerating ? "Generating Docs..." : "Generating..."}</span>
              </div>
            )}
          </div>

          <button
            onClick={onStartOver}
            className="lg:hidden text-xs px-2.5 py-1.5 rounded-xl bg-surface-2 text-muted hover:text-foreground border border-border/60 flex items-center gap-1.5"
          >
            <ArrowCounterClockwise size={14} weight="bold" />
            <span>Reset</span>
          </button>
        </div>

        {/* Header Action Toolbar Row */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-thin max-w-full py-1">
          <Link href="/chat" className="flex-shrink-0">
            <MagneticButton
              variant="primary"
              size="sm"
              className="text-xs px-3 py-1.5 font-bold"
              title="Tanyakan sesuatu tentang PRD atau arsitektur ini kepada AI"
            >
              <ChatCircleText size={16} weight="fill" />
              <span>Tanya AI PRD</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
            </MagneticButton>
          </Link>

          {(!instructionMD || !agentsMD) && (
            <MagneticButton
              variant="secondary"
              size="sm"
              onClick={handleGenerateAll}
              disabled={isBatchGenerating || !!generatingTab}
              className="text-xs px-2.5 py-1.5 flex-shrink-0"
              title="Generate INSTRUCTIONS.md dan AGENTS.md sekarang"
            >
              <Sparkle size={14} weight="fill" className={isBatchGenerating ? "animate-spin" : ""} />
              <span>{isBatchGenerating ? "Generating..." : "Generate Panduan & Rules"}</span>
            </MagneticButton>
          )}

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            disabled={isCurrentStreaming || isDocGenerating || !activeContent}
            className="text-xs px-2.5 py-1.5 flex-shrink-0"
            title="Salin isi dokumen aktif"
          >
            {copied ? <Check size={15} weight="bold" /> : <Copy size={15} weight="bold" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </MagneticButton>

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            disabled={isCurrentStreaming || isDocGenerating || !activeContent}
            className="text-xs px-2.5 py-1.5 flex-shrink-0"
            title={`Download ${getDownloadFileName()}`}
          >
            <DownloadSimple size={15} weight="bold" />
            <span>.md</span>
          </MagneticButton>

          <MagneticButton
            variant="primary"
            size="sm"
            onClick={handleDownloadZip}
            disabled={isStreaming || !markdown}
            className="text-xs px-2.5 py-1.5 flex-shrink-0 font-bold"
            title="Download Semua Dokumen (PRD, INSTRUCTIONS, AGENTS.md, .cursorrules) dalam ZIP"
          >
            <Archive size={15} weight="bold" />
            <span>.zip (All)</span>
          </MagneticButton>

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            disabled={isCurrentStreaming || isDocGenerating || !activeContent}
            className="text-xs px-2.5 py-1.5 flex-shrink-0"
            title="Cetak atau simpan sebagai PDF"
          >
            <DownloadSimple size={15} weight="bold" />
            <span>.pdf</span>
          </MagneticButton>

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handleSaveToCloud}
            disabled={isStreaming || !markdown || isSaving}
            className="text-xs px-2.5 py-1.5 flex-shrink-0"
            title="Simpan ke Cloud History"
          >
            <CloudArrowUp size={15} weight="bold" className={isSaving ? "animate-pulse" : ""} />
            <span>{isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}</span>
          </MagneticButton>

          <MagneticButton
            variant="ghost"
            size="sm"
            onClick={onStartOver}
            className="text-xs px-2.5 py-1.5 flex-shrink-0 hidden lg:flex"
          >
            <ArrowCounterClockwise size={15} weight="bold" />
            <span>Mulai Ulang</span>
          </MagneticButton>
        </div>
      </motion.div>

      {/* Mobile Table of Contents Dropdown */}
      <AnimatePresence>
        {showTOC && toc.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden mb-4 overflow-hidden"
          >
            <GlassCard className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Daftar Isi Dokumen
              </h4>
              <nav className="space-y-1 max-h-48 overflow-y-auto">
                {toc.map((item, i) => (
                  <a
                    key={i}
                    href={`#${item.id}`}
                    onClick={() => setShowTOC(false)}
                    className={`block text-xs truncate transition-colors hover:text-accent ${
                      item.level === 1
                        ? "text-foreground font-medium"
                        : item.level === 2
                        ? "text-muted pl-3"
                        : "text-muted-foreground pl-6"
                    }`}
                  >
                    {item.text}
                  </a>
                ))}
              </nav>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3 Core Essential Architecture Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-4 overflow-x-auto pb-2 border-b border-border/40 scrollbar-thin">
        {/* Tab 1: PRD Utama */}
        <button
          onClick={() => setActiveTab("prd")}
          className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "prd"
              ? "bg-accent text-background font-bold shadow-sm"
              : "bg-surface-2 text-muted hover:text-foreground border border-border/40"
          }`}
          title="Dokumen Product Requirements Document (PRD) Utama"
        >
          <FileText size={16} weight={activeTab === "prd" ? "bold" : "regular"} />
          <span>PRD Utama</span>
          {markdown && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>

        {/* Tab 2: INSTRUCTIONS.md */}
        <button
          onClick={() => {
            setActiveTab("instruction");
            if (!instructionMD && !generatingTab) {
              fetchAndStream("/api/generate-instruction", "instruction", setInstructionMD);
            }
          }}
          className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "instruction"
              ? "bg-accent text-background font-bold shadow-sm"
              : "bg-surface-2 text-muted hover:text-foreground border border-border/40"
          }`}
          title="Panduan langkah-demi-langkah eksekusi proyek untuk developer dan tim"
        >
          <List size={16} weight={activeTab === "instruction" ? "bold" : "regular"} />
          <span>INSTRUCTIONS.md</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
            activeTab === "instruction" ? "bg-background/20 text-background" : "bg-surface-3 text-muted-foreground"
          }`}>
            Execution
          </span>
          {instructionMD && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>

        {/* Tab 3: AGENTS.md */}
        <button
          onClick={() => {
            setActiveTab("agents");
            if (!agentsMD && !generatingTab) {
              fetchAndStream("/api/generate-agents", "agents", setAgentsMD);
            }
          }}
          className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "agents"
              ? "bg-accent text-background font-bold shadow-sm"
              : "bg-surface-2 text-muted hover:text-foreground border border-border/40"
          }`}
          title="Master System Prompt & Aturan AI Coding Agent (Inquiry-First Protocol & Modular Awareness)"
        >
          <Code size={16} weight={activeTab === "agents" ? "bold" : "regular"} />
          <span>AGENTS.md</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
            activeTab === "agents" ? "bg-background/20 text-background" : "bg-surface-3 text-accent font-semibold"
          }`}>
            AI Rules
          </span>
          {agentsMD && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 items-start">
        {/* Content Viewer Card */}
        <GlassCard className="p-4 sm:p-6 md:p-8 w-full overflow-hidden">
          <div ref={scrollRef} className="prose-prd min-h-[400px] max-h-[75dvh] overflow-y-auto pr-1 relative">
            {activeContent ? (
              <div ref={printRef}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h1: ({ children }) => {
                      const text = String(children);
                      const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
                      return (
                        <h1 id={id} className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mt-2 mb-4 pb-2 border-b border-border/40">
                          {children}
                        </h1>
                      );
                    },
                    h2: ({ children }) => {
                      const text = String(children);
                      const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
                      return (
                        <h2 id={id} className="text-lg sm:text-xl font-semibold tracking-tight text-foreground mt-6 mb-3">
                          {children}
                        </h2>
                      );
                    },
                    h3: ({ children }) => {
                      const text = String(children);
                      const id = text.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-");
                      return (
                        <h3 id={id} className="text-base sm:text-lg font-medium text-foreground mt-4 mb-2">
                          {children}
                        </h3>
                      );
                    },
                    code({ className, children, ...props }) {
                      const match = /language-(\w+)/.exec(className || "");
                      const language = match ? match[1] : "";
                      const codeContent = String(children).replace(/\n$/, "");

                      if (language === "mermaid") {
                        return <MermaidBlock fullMarkdown={activeContent}>{codeContent}</MermaidBlock>;
                      }

                      const isInline = !match && !String(children).includes("\n");
                      if (isInline) {
                        return (
                          <code className="px-1.5 py-0.5 rounded-md bg-surface-2 text-accent font-mono text-xs" {...props}>
                            {children}
                          </code>
                        );
                      }

                      return <CodeBlock>{codeContent}</CodeBlock>;
                    },
                    table({ children }) {
                      return (
                        <div className="overflow-x-auto my-4 rounded-xl border border-border/60">
                          <table className="w-full text-xs sm:text-sm border-collapse">{children}</table>
                        </div>
                      );
                    },
                    th({ children }) {
                      return <th className="bg-surface-2 px-3 py-2 text-left font-semibold text-foreground border-b border-border/60">{children}</th>;
                    },
                    td({ children }) {
                      return <td className="px-3 py-2 border-b border-border/30 text-muted">{children}</td>;
                    },
                    ul({ children }) {
                      return <ul className="list-disc list-inside space-y-1.5 my-2 text-muted text-xs sm:text-sm">{children}</ul>;
                    },
                    ol({ children }) {
                      return <ol className="list-decimal list-inside space-y-1.5 my-2 text-muted text-xs sm:text-sm">{children}</ol>;
                    },
                    p({ children }) {
                      return <p className="my-2 leading-relaxed text-muted text-xs sm:text-sm">{children}</p>;
                    },
                    blockquote({ children }) {
                      return (
                        <blockquote className="border-l-2 border-accent/60 pl-3 py-1 my-3 bg-accent/5 rounded-r-lg text-xs sm:text-sm italic text-muted-foreground">
                          {children}
                        </blockquote>
                      );
                    },
                  }}
                >
                  {activeContent}
                </ReactMarkdown>
              </div>
            ) : isDocGenerating ? (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-muted space-y-3">
                <div className="relative">
                  <div className="w-10 h-10 border-2 border-accent/20 border-t-accent rounded-full animate-spin" />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Sedang menyusun {activeTab === "instruction" ? "INSTRUCTIONS.md" : "AGENTS.md"}...
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Menyelaraskan spesifikasi teknis dan aturan rekayasa software dengan PRD.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center min-h-[300px] text-muted space-y-4">
                <TerminalWindow size={40} className="text-muted-foreground/40" />
                <div className="text-center space-y-1 max-w-md">
                  <p className="text-sm font-medium text-foreground">
                    {activeTab === "prd"
                      ? "Dokumen PRD Utama Belum Selesai / Gagal"
                      : activeTab === "instruction"
                      ? "INSTRUCTIONS.md Belum Dibuat"
                      : "AGENTS.md Belum Dibuat"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeTab === "prd"
                      ? "Dokumen Product Requirements Document (PRD) utama belum termuat atau sempat terputus saat streaming."
                      : activeTab === "instruction"
                      ? "Panduan instruksi eksekusi langkah-demi-langkah bagi developer untuk mengimplementasikan PRD."
                      : "Master system prompt & aturan coding ketat untuk AI Coding Agent (Inquiry-First & Modular)."}
                  </p>
                </div>
                <MagneticButton
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (activeTab === "prd") {
                      if (onRegeneratePRD) {
                        onRegeneratePRD();
                      }
                    } else if (activeTab === "instruction") {
                      fetchAndStream("/api/generate-instruction", "instruction", setInstructionMD);
                    } else if (activeTab === "agents") {
                      fetchAndStream("/api/generate-agents", "agents", setAgentsMD);
                    }
                  }}
                >
                  <Sparkle size={14} weight="fill" />
                  <span>
                    {activeTab === "prd" ? "Generate / Coba Ulang PRD Utama" : "Generate Dokumen Ini"}
                  </span>
                </MagneticButton>
              </div>
            )}

            {/* Streaming indicator */}
            {(isCurrentStreaming || isDocGenerating) && (
              <div className="flex items-center gap-2 mt-4 text-xs text-accent">
                <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
                <span className="font-mono">Generating content in real-time...</span>
              </div>
            )}
          </div>
        </GlassCard>

        {/* Desktop Sidebar: Table of Contents & Quick Summary */}
        <div className="hidden lg:flex flex-col gap-4 sticky top-6">
          <GlassCard className="p-4">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Daftar Isi</span>
              <span className="text-[10px] text-accent font-mono">{toc.length} sections</span>
            </h4>
            {toc.length > 0 ? (
              <nav className="space-y-1 max-h-[45vh] overflow-y-auto pr-1 scrollbar-thin">
                {toc.map((item, i) => (
                  <a
                    key={i}
                    href={`#${item.id}`}
                    className={`block text-xs truncate transition-colors hover:text-accent py-0.5 ${
                      item.level === 1
                        ? "text-foreground font-medium"
                        : item.level === 2
                        ? "text-muted pl-2.5 border-l border-border/40"
                        : "text-muted-foreground pl-4 border-l border-border/20"
                    }`}
                  >
                    {item.text}
                  </a>
                ))}
              </nav>
            ) : (
              <p className="text-xs text-muted-foreground">Tidak ada heading terdeteksi.</p>
            )}
          </GlassCard>

          {/* Quick Context Card */}
          <GlassCard className="p-4 space-y-2.5">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Code size={14} className="text-accent" />
              <span>Vibe Coding Architecture</span>
            </h4>
            <div className="text-[11px] text-muted-foreground space-y-1.5">
              <p>
                <strong className="text-foreground">PRD:</strong> Spesifikasi fungsional & data model.
              </p>
              <p>
                <strong className="text-foreground">INSTRUCTIONS.md:</strong> Panduan eksekusi developer.
              </p>
              <p>
                <strong className="text-foreground">AGENTS.md:</strong> Aturan AI Agent (Inquiry-First Protocol).
              </p>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Floating Chatbot Drawer */}
      <PRDChatbot
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        prdContent={markdown}
        projectBrief={projectBrief}
        summary={summary}
      />
    </motion.div>
  );
}
