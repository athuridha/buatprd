"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import JSZip from "jszip";
import {
  FileText,
  DownloadSimple,
  Copy,
  Check,
  Sparkle,
  Crown,
  Spinner,
  ArrowCounterClockwise,
  List,
  Sidebar,
  CheckCircle,
} from "@phosphor-icons/react";
import { DOC_SUITE_FILES, DocFileInfo } from "@/lib/doc-suite-prompts";
import GlassCard from "./ui/GlassCard";
import MagneticButton from "./ui/MagneticButton";

interface DocSuiteViewerProps {
  prdContent: string;
  projectBrief?: string;
  prdTitle?: string;
  selectedModel?: string;
}

export default function DocSuiteViewer({
  prdContent,
  projectBrief,
  prdTitle = "Project Documentation",
  selectedModel = "qwen3.7-max",
}: DocSuiteViewerProps) {
  const [docsMap, setDocsMap] = useState<Record<string, string>>({});
  const [generatingFiles, setGeneratingFiles] = useState<Record<string, boolean>>({});
  const [selectedFilename, setSelectedFilename] = useState<string>("SUMMARY.md");
  const [copied, setCopied] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // Generate single file if missing
  const generateSingleFile = useCallback(
    async (filename: string) => {
      if (generatingFiles[filename] || docsMap[filename]) return;

      setGeneratingFiles((prev) => ({ ...prev, [filename]: true }));
      let accumulatedText = "";

      try {
        const res = await fetch("/api/generate-doc-suite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prdContent,
            projectBrief,
            targetFile: filename,
            model: selectedModel,
          }),
        });

        if (!res.ok) throw new Error(`Gagal membuat ${filename}`);

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          setDocsMap((prev) => ({ ...prev, [filename]: accumulatedText }));
        }
      } catch (err) {
        console.error(`Error generating ${filename}:`, err);
      } finally {
        setGeneratingFiles((prev) => ({ ...prev, [filename]: false }));
      }
    },
    [prdContent, projectBrief, selectedModel, generatingFiles, docsMap]
  );

  // Batch generate all 16 files in parallel chunks for maximum speed
  const generateAllFiles = useCallback(async () => {
    setIsGeneratingAll(true);
    const filesToGenerate = DOC_SUITE_FILES.filter((f) => !docsMap[f.filename]);

    // Process 4 files concurrently in parallel batches
    const CONCURRENCY = 4;
    for (let i = 0; i < filesToGenerate.length; i += CONCURRENCY) {
      const chunk = filesToGenerate.slice(i, i + CONCURRENCY);
      await Promise.all(chunk.map((f) => generateSingleFile(f.filename)));
    }
    setIsGeneratingAll(false);
  }, [docsMap, generateSingleFile]);

  // Initial trigger for SUMMARY.md and consecutive files
  useEffect(() => {
    if (Object.keys(docsMap).length === 0 && !isGeneratingAll) {
      generateAllFiles();
    }
  }, [docsMap, isGeneratingAll, generateAllFiles]);

  const handleCopyCurrentDoc = () => {
    const currentText = docsMap[selectedFilename] || "";
    if (currentText) {
      navigator.clipboard.writeText(currentText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadAllZip = async () => {
    const zip = new JSZip();
    const folder = zip.folder(`${prdTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_Docs_Suite`);

    DOC_SUITE_FILES.forEach((f) => {
      const content = docsMap[f.filename] || `# ${f.title}\n\n[Dokumen belum selesai digenerate]`;
      folder?.file(f.filename, content);
    });

    const blob = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${prdTitle.replace(/[^a-zA-Z0-9_-]/g, "_")}_16_Docs_Suite.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const completedCount = Object.keys(docsMap).filter(
    (key) => docsMap[key] && docsMap[key].trim().length > 50
  ).length;

  const currentContent = docsMap[selectedFilename] || "";
  const isCurrentGenerating = !!generatingFiles[selectedFilename];

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Header Suite Banner */}
      <GlassCard className="p-4 sm:p-6 bg-gradient-to-r from-amber-500/10 via-surface-1 to-surface-1 border-amber-500/30">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-xs">
              <Crown size={28} weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  AI Project Documentation Suite
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                  UNLOCKED
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed mt-0.5">
                Paket 16 Dokumen Teknikal & Engineering Siap Pakai untuk AI Coding Assistant.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <MagneticButton
              variant="secondary"
              size="sm"
              onClick={handleCopyCurrentDoc}
              disabled={!currentContent}
              className="text-xs gap-1.5"
            >
              {copied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
              <span>{copied ? "Tersalin!" : "Salin File Ini"}</span>
            </MagneticButton>

            <MagneticButton
              variant="primary"
              size="sm"
              onClick={handleDownloadAllZip}
              disabled={completedCount === 0}
              className="text-xs gap-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-zinc-950 font-bold border-none shadow-md"
            >
              <DownloadSimple size={16} weight="bold" />
              <span>Unduh 16 Dokumen (.zip)</span>
            </MagneticButton>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-4 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-foreground">
              {completedCount} / 16
            </span>
            <span>Dokumen Selesai Digenerate</span>
            {isGeneratingAll && <Spinner size={14} className="text-accent animate-spin" />}
          </div>

          <div className="w-48 h-2 rounded-full bg-surface-2 overflow-hidden border border-border/40 hidden sm:block">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${(completedCount / 16) * 100}%` }}
            />
          </div>
        </div>
      </GlassCard>

      {/* Main Suite Workspace Layout */}
      <div className="flex flex-col md:flex-row gap-4 h-[75vh] min-h-[600px] overflow-hidden">
        {/* Left Sidebar Navigator (16 Markdown Files) */}
        <div className="w-full md:w-80 bg-surface-1 border border-border/60 rounded-3xl p-3 flex flex-col flex-shrink-0 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/40 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              16 Markdown Suite Files
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-2 text-accent">
              .MD
            </span>
          </div>

          <div className="flex-1 overflow-y-auto p-1 space-y-1 scrollbar-thin mt-2">
            {DOC_SUITE_FILES.map((f) => {
              const isSelected = selectedFilename === f.filename;
              const hasContent = !!docsMap[f.filename] && docsMap[f.filename].trim().length > 50;
              const isGenerating = !!generatingFiles[f.filename];

              return (
                <button
                  key={f.filename}
                  onClick={() => {
                    setSelectedFilename(f.filename);
                    if (!hasContent && !isGenerating) {
                      generateSingleFile(f.filename);
                    }
                  }}
                  className={`w-full text-left p-2.5 rounded-2xl text-xs transition-all flex items-center justify-between gap-2 cursor-pointer ${
                    isSelected
                      ? "bg-accent/15 border border-accent/40 font-bold text-foreground shadow-xs"
                      : "hover:bg-surface-2 text-muted hover:text-foreground border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <FileText
                      size={16}
                      className={isSelected ? "text-accent" : "text-muted-foreground"}
                    />
                    <span className="truncate">{f.filename}</span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isGenerating ? (
                      <Spinner size={14} className="text-accent animate-spin" />
                    ) : hasContent ? (
                      <CheckCircle size={15} weight="fill" className="text-emerald-400" />
                    ) : (
                      <span className="text-[9px] text-muted-foreground/60">Antrean</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Active File Markdown Viewer */}
        <div className="flex-1 bg-surface-1 border border-border/60 rounded-3xl flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between bg-surface-1/40 backdrop-blur">
            <div className="flex items-center gap-2">
              <FileText size={18} className="text-accent" />
              <h3 className="font-bold text-sm text-foreground">
                {selectedFilename}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => generateSingleFile(selectedFilename)}
                disabled={isCurrentGenerating}
                className="px-3 py-1 rounded-xl bg-surface-2 hover:bg-surface-3 text-xs text-muted hover:text-foreground border border-border/60 transition-all flex items-center gap-1.5 cursor-pointer"
                title="Generate ulang file ini"
              >
                <ArrowCounterClockwise size={14} className={isCurrentGenerating ? "animate-spin" : ""} />
                <span>Generate Ulang</span>
              </button>
            </div>
          </div>

          {/* Markdown Content Output Area */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 scrollbar-thin text-xs sm:text-sm leading-relaxed">
            {isCurrentGenerating && !currentContent ? (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-16">
                <Spinner size={32} className="text-accent animate-spin" />
                <p className="text-xs text-muted">
                  Menyusun dokumen <strong className="text-foreground">{selectedFilename}</strong> dengan AI...
                </p>
              </div>
            ) : currentContent ? (
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground border-b border-border/50 pb-2 mb-4 mt-2">
                      {children}
                    </h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="text-lg sm:text-xl font-bold text-foreground border-b border-border/30 pb-1 mb-3 mt-6">
                      {children}
                    </h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="text-base font-bold text-accent mb-2 mt-4">
                      {children}
                    </h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-3 text-muted-foreground leading-relaxed">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="list-disc pl-5 mb-4 space-y-1 text-muted-foreground">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal pl-5 mb-4 space-y-1 text-muted-foreground">{children}</ol>
                  ),
                  code: ({ children }) => (
                    <code className="bg-surface-2 border border-border/60 px-1.5 py-0.5 rounded text-[11px] font-mono text-accent">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-surface-2 border border-border p-4 rounded-2xl font-mono text-xs overflow-x-auto my-4 leading-relaxed">
                      {children}
                    </pre>
                  ),
                }}
              >
                {currentContent}
              </ReactMarkdown>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-16">
                <FileText size={36} className="text-muted-foreground/40" />
                <p className="text-xs text-muted">
                  Klik file di sidebar kiri untuk meng-generate dokumen.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
