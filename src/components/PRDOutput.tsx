"use client";

import { useEffect, useRef, useMemo, memo, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  FolderSimple,
  Plugs,
  TerminalWindow,
  FileText,
  Sparkle,
  Code,
  ArrowRight,
  Archive,
} from "@phosphor-icons/react";
import MagneticButton from "./ui/MagneticButton";
import GlassCard from "./ui/GlassCard";
import MermaidRenderer from "./MermaidRenderer";
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
}

type TabType = "prd" | "instruction" | "module_a" | "module_b" | "module_c";

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
        <span>Code Block / Prompt</span>
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
}: PRDOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const autoTriggeredRef = useRef(false);

  const [activeTab, setActiveTab] = useState<TabType>("prd");
  const [copied, setCopied] = useState(false);
  const [showTOC, setShowTOC] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Module contents state
  const [instructionMD, setInstructionMD] = useState("");
  const [moduleAMD, setModuleAMD] = useState("");
  const [moduleBMD, setModuleBMD] = useState("");
  const [moduleCMD, setModuleCMD] = useState("");

  // Module streaming state
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
      case "module_a":
        return moduleAMD;
      case "module_b":
        return moduleBMD;
      case "module_c":
        return moduleCMD;
      default:
        return markdown;
    }
  }, [activeTab, markdown, instructionMD, moduleAMD, moduleBMD, moduleCMD]);

  const isCurrentStreaming = isStreaming && activeTab === "prd";
  const isModuleGenerating = generatingTab === activeTab;

  const toc = useMemo(() => extractTOC(activeContent), [activeContent]);

  // Auto-scroll while streaming
  useEffect(() => {
    if ((isCurrentStreaming || isModuleGenerating) && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [activeContent, isCurrentStreaming, isModuleGenerating]);

  /* Helper to stream fetch a module */
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
        body: JSON.stringify({ brief: projectBrief, summary }),
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
      setter(`Gagal membuat konten modul ini. Silakan coba lagi.`);
    } finally {
      setGeneratingTab(null);
    }
  };

  /* Batch generator for all modules */
  const handleGenerateAllModules = useCallback(async () => {
    if (isBatchGenerating || generatingTab) return;
    setIsBatchGenerating(true);
    try {
      if (!instructionMD) await fetchAndStream("/api/generate-instruction", "instruction", setInstructionMD);
      if (!moduleAMD) await fetchAndStream("/api/generate-module-a", "module_a", setModuleAMD);
      if (!moduleBMD) await fetchAndStream("/api/generate-module-b", "module_b", setModuleBMD);
      if (!moduleCMD) await fetchAndStream("/api/generate-module-c", "module_c", setModuleCMD);
    } finally {
      setIsBatchGenerating(false);
    }
  }, [isBatchGenerating, generatingTab, instructionMD, moduleAMD, moduleBMD, moduleCMD, projectBrief, summary]);

  // Auto-trigger module generation in background after PRD finishes streaming
  useEffect(() => {
    if (!isStreaming && markdown && markdown.length > 50 && !autoTriggeredRef.current && projectBrief) {
      autoTriggeredRef.current = true;
      handleGenerateAllModules();
    }
  }, [isStreaming, markdown, projectBrief, handleGenerateAllModules]);

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
        title,
        content: markdown,
        instructionMD,
        moduleAMD,
        moduleBMD,
        moduleCMD,
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

  const getDownloadFileName = () => {
    switch (activeTab) {
      case "prd":
        return "prd_document.md";
      case "instruction":
        return "INSTRUCTIONS.md";
      case "module_a":
        return "MODUL_A_FOLDER_STRUCTURE.md";
      case "module_b":
        return "MODUL_B_API_SPECS.md";
      case "module_c":
        return "MODUL_C_VIBE_PROMPTS.md";
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
    documentTitle: getDownloadFileName().replace(".md", ""),
    pageStyle: `
      @page { size: auto; margin: 20mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
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
      zip.file("AGENTS.md", instructionMD);
      zip.file("INSTRUCTIONS.md", instructionMD);
    }
    if (moduleAMD) {
      zip.file("MODUL_A_FOLDER_STRUCTURE.md", moduleAMD);
    }
    if (moduleBMD) {
      zip.file("MODUL_B_API_SPECS.md", moduleBMD);
    }
    if (moduleCMD) {
      zip.file("MODUL_C_VIBE_PROMPTS.md", moduleCMD);
    }

    const readme = `# ${title} — Vibe Coding Suite Package

File-file berikut telah disiapkan oleh BuatPRD untuk siap dipakai pada AI Coding Tools (Cursor / Windsurf / Antigravity):

- **AGENTS.md / INSTRUCTIONS.md**: Salin ke root folder proyek sebagai aturan & panduan AI Coding Agent.
- **01_PRD_DOCUMENT.md**: Dokumen PRD utama.
- **MODUL_A_FOLDER_STRUCTURE.md**: Spesifikasi arsitektur folder ASCII tree & setup .env.
- **MODUL_B_API_SPECS.md**: Spesifikasi endpoint API, HTTP Method, Role, & JSON payload.
- **MODUL_C_VIBE_PROMPTS.md**: Master Prompt 1 s/d 4 untuk vibe coding.

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
  }, [markdown, instructionMD, moduleAMD, moduleBMD, moduleCMD, projectBrief, summary]);

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
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 mb-4"
      >
        <div className="flex items-center gap-2 sm:gap-3">
          <h2 className="text-base sm:text-xl font-bold tracking-tight">PRD Architect Output</h2>
          {(isCurrentStreaming || isModuleGenerating || isBatchGenerating) && (
            <div className="flex items-center gap-1.5 text-xs text-accent bg-accent-muted px-2 py-0.5 rounded-full border border-accent/20">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              <span>{isBatchGenerating ? "Generating All..." : "Generating..."}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto justify-start md:justify-end">
          <button
            onClick={() => setShowTOC((p) => !p)}
            className={`p-2 rounded-lg transition-colors cursor-pointer ${
              showTOC
                ? "bg-accent-muted text-accent"
                : "text-muted hover:text-foreground hover:bg-surface-3"
            }`}
            title="Table of Contents"
            id="toc-toggle"
          >
            <List size={18} weight="bold" />
          </button>

          {(!instructionMD || !moduleAMD || !moduleBMD || !moduleCMD) && (
            <MagneticButton
              variant="secondary"
              size="sm"
              onClick={handleGenerateAllModules}
              disabled={isBatchGenerating || !!generatingTab}
              className="text-xs px-2.5 py-1.5"
            >
              <Sparkle size={14} weight="fill" className={isBatchGenerating ? "animate-spin" : ""} />
              <span className="hidden sm:inline">{isBatchGenerating ? "Generating..." : "Generate Semua Modul"}</span>
              <span className="sm:hidden">Generate All</span>
            </MagneticButton>
          )}

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            disabled={isCurrentStreaming || isModuleGenerating || !activeContent}
            className="text-xs px-2.5 py-1.5"
          >
            {copied ? <Check size={15} weight="bold" /> : <Copy size={15} weight="bold" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </MagneticButton>

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            disabled={isCurrentStreaming || isModuleGenerating || !activeContent}
            className="text-xs px-2.5 py-1.5"
          >
            <DownloadSimple size={15} weight="bold" />
            <span>.md</span>
          </MagneticButton>

          <MagneticButton
            variant="primary"
            size="sm"
            onClick={handleDownloadZip}
            disabled={isStreaming || !markdown}
            className="text-xs px-2.5 py-1.5"
            title="Download Semua Modul & Document sebagai ZIP"
          >
            <Archive size={15} weight="bold" />
            <span>.zip (All)</span>
          </MagneticButton>

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            disabled={isCurrentStreaming || isModuleGenerating || !activeContent}
            className="text-xs px-2.5 py-1.5"
          >
            <DownloadSimple size={15} weight="bold" />
            <span>.pdf</span>
          </MagneticButton>

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handleSaveToCloud}
            disabled={isStreaming || !markdown || isSaving}
            className="text-xs px-2.5 py-1.5"
          >
            <CloudArrowUp size={15} weight="bold" className={isSaving ? "animate-pulse" : ""} />
            <span>{isSaving ? "Saving..." : saveSuccess ? "Saved!" : "Save"}</span>
          </MagneticButton>

          <MagneticButton variant="ghost" size="sm" onClick={onStartOver} className="text-xs px-2.5 py-1.5">
            <ArrowCounterClockwise size={15} weight="bold" />
            <span className="hidden sm:inline">Mulai Ulang</span>
            <span className="sm:hidden">Reset</span>
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

      {/* Responsive Horizontal Module Tabs */}
      <div className="flex items-center gap-1.5 sm:gap-2 mb-4 overflow-x-auto pb-2 border-b border-border/40 scrollbar-thin">
        <button
          onClick={() => setActiveTab("prd")}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "prd"
              ? "bg-accent text-background font-semibold shadow-sm"
              : "bg-surface-2 text-muted hover:text-foreground border border-border/40"
          }`}
        >
          <FileText size={16} weight={activeTab === "prd" ? "bold" : "regular"} />
          <span>PRD Utama</span>
        </button>

        <button
          onClick={() => setActiveTab("instruction")}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "instruction"
              ? "bg-accent text-background font-semibold shadow-sm"
              : "bg-surface-2 text-muted hover:text-foreground border border-border/40"
          }`}
        >
          <Code size={16} weight={activeTab === "instruction" ? "bold" : "regular"} />
          <span>INSTRUCTIONS.md</span>
          {instructionMD && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>

        <button
          onClick={() => setActiveTab("module_a")}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "module_a"
              ? "bg-accent text-background font-semibold shadow-sm"
              : "bg-surface-2 text-muted hover:text-foreground border border-border/40"
          }`}
        >
          <FolderSimple size={16} weight={activeTab === "module_a" ? "bold" : "regular"} />
          <span>Modul A: Folder Structure</span>
          {moduleAMD && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>

        <button
          onClick={() => setActiveTab("module_b")}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "module_b"
              ? "bg-accent text-background font-semibold shadow-sm"
              : "bg-surface-2 text-muted hover:text-foreground border border-border/40"
          }`}
        >
          <Plugs size={16} weight={activeTab === "module_b" ? "bold" : "regular"} />
          <span>Modul B: API & Data Specs</span>
          {moduleBMD && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>

        <button
          onClick={() => setActiveTab("module_c")}
          className={`flex-shrink-0 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all flex items-center gap-2 cursor-pointer whitespace-nowrap ${
            activeTab === "module_c"
              ? "bg-accent text-background font-semibold shadow-sm"
              : "bg-surface-2 text-muted hover:text-foreground border border-border/40"
          }`}
        >
          <TerminalWindow size={16} weight={activeTab === "module_c" ? "bold" : "regular"} />
          <span>Modul C: Vibe Coding Prompts</span>
          {moduleCMD && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_240px] gap-4 items-start">
        {/* Content Viewer Card */}
        <GlassCard className="p-4 sm:p-6 md:p-8 w-full overflow-hidden">
          <div ref={scrollRef} className="prose-prd min-h-[400px] max-h-[75dvh] overflow-y-auto pr-1 relative">
            {activeContent ? (
              <div ref={printRef} className="pb-4">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    pre({ children }) {
                      const child = Array.isArray(children) ? children[0] : children;
                      if (
                        child &&
                        typeof child === "object" &&
                        "props" in child &&
                        child.props?.className?.includes("language-mermaid")
                      ) {
                        const codeContent = String(child.props.children).replace(/\n$/, "");
                        return <MermaidBlock fullMarkdown={activeContent}>{codeContent}</MermaidBlock>;
                      }
                      return <CodeBlock>{children}</CodeBlock>;
                    },
                    code(props) {
                      const { children, className, ...rest } = props;
                      const match = /language-(\w+)/.exec(className || "");
                      const lang = match?.[1];
                      const codeString = String(children).replace(/\n$/, "");

                      if (lang === "mermaid") {
                        return <MermaidBlock fullMarkdown={activeContent}>{codeString}</MermaidBlock>;
                      }

                      return (
                        <code className={className} {...rest}>
                          {children}
                        </code>
                      );
                    },
                    h1({ children }) {
                      const text = String(children);
                      const id = text
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, "")
                        .replace(/\s+/g, "-");
                      return <h1 id={id}>{children}</h1>;
                    },
                    h2({ children }) {
                      const text = String(children);
                      const id = text
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, "")
                        .replace(/\s+/g, "-");
                      return <h2 id={id}>{children}</h2>;
                    },
                    h3({ children }) {
                      const text = String(children);
                      const id = text
                        .toLowerCase()
                        .replace(/[^a-z0-9\s-]/g, "")
                        .replace(/\s+/g, "-");
                      return <h3 id={id}>{children}</h3>;
                    },
                  }}
                >
                  {activeContent}
                </ReactMarkdown>
              </div>
            ) : activeTab === "prd" ? (
              /* Loading PRD Utama state */
              <div className="flex flex-col items-center justify-center py-20 text-center px-4">
                <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin mb-4" />
                <h3 className="text-base sm:text-lg font-bold mb-2">Menyusun Dokumen PRD Utama...</h3>
                <p className="text-xs sm:text-sm text-muted max-w-[45ch]">
                  AI sedang menganalisis brief dan menyusun dokumen PRD lengkap secara real-time.
                </p>
              </div>
            ) : (
              /* State Empty Module -> Prompt to Generate Separately */
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <div className="w-14 h-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-accent mb-4">
                  {activeTab === "instruction" && <Code size={28} />}
                  {activeTab === "module_a" && <FolderSimple size={28} />}
                  {activeTab === "module_b" && <Plugs size={28} />}
                  {activeTab === "module_c" && <TerminalWindow size={28} />}
                </div>

                <h3 className="text-base sm:text-lg font-bold mb-2">
                  {activeTab === "instruction" && "Generate INSTRUCTIONS.md"}
                  {activeTab === "module_a" && "Generate Modul A: File & Folder Structure"}
                  {activeTab === "module_b" && "Generate Modul B: API & Endpoint Specs"}
                  {activeTab === "module_c" && "Generate Modul C: Vibe Coding Prompts"}
                </h3>

                <p className="text-xs sm:text-sm text-muted max-w-[50ch] mb-6">
                  {activeTab === "instruction" &&
                    "Dokumen panduan khusus untuk AI Agent Coding (Cursor, Windsurf, Antigravity) belum di-generate secara terpisah."}
                  {activeTab === "module_a" &&
                    "Spesifikasi direktori/folder lengkap ASCII tree dan setup .env belum di-generate secara terpisah."}
                  {activeTab === "module_b" &&
                    "Tabel spesifikasi endpoint API, HTTP Method, dan JSON Payload belum di-generate secara terpisah."}
                  {activeTab === "module_c" &&
                    "4 Master Prompt terpisah untuk Vibe Coding (Setup, Backend, Frontend, Testing) belum di-generate."}
                </p>

                <MagneticButton
                  variant="primary"
                  size="md"
                  onClick={() => {
                    if (activeTab === "instruction") {
                      fetchAndStream("/api/generate-instruction", "instruction", setInstructionMD);
                    } else if (activeTab === "module_a") {
                      fetchAndStream("/api/generate-module-a", "module_a", setModuleAMD);
                    } else if (activeTab === "module_b") {
                      fetchAndStream("/api/generate-module-b", "module_b", setModuleBMD);
                    } else if (activeTab === "module_c") {
                      fetchAndStream("/api/generate-module-c", "module_c", setModuleCMD);
                    }
                  }}
                  isLoading={isModuleGenerating}
                >
                  <Sparkle weight="fill" size={16} />
                  <span>
                    {isModuleGenerating
                      ? "Generating Modul..."
                      : activeTab === "instruction"
                      ? "Generate INSTRUCTIONS.md"
                      : activeTab === "module_a"
                      ? "Generate Modul A"
                      : activeTab === "module_b"
                      ? "Generate Modul B"
                      : "Generate Modul C"}
                  </span>
                  <ArrowRight size={16} weight="bold" />
                </MagneticButton>
              </div>
            )}

            {(isCurrentStreaming || isModuleGenerating) && (
              <span className="inline-block w-2 h-5 bg-accent ml-1 cursor-blink" />
            )}
          </div>
        </GlassCard>

        {/* Desktop TOC Sidebar */}
        {showTOC && toc.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:block lg:sticky lg:top-6 lg:self-start w-full"
          >
            <GlassCard className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Daftar Isi Dokumen
              </h4>
              <nav className="space-y-1 max-h-[70vh] overflow-y-auto">
                {toc.map((item, i) => (
                  <a
                    key={i}
                    href={`#${item.id}`}
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
      </div>
    </motion.div>
  );
}
