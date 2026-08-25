"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Stop,
  XCircle,
  Play,
} from "@phosphor-icons/react";
import { DOC_SUITE_FILES, DocFileInfo } from "@/lib/doc-suite-prompts";
import MagneticButton from "./ui/MagneticButton";
import ModelSelector from "./ModelSelector";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";

interface DocSuiteViewerProps {
  prdId?: string;
  prdContent: string;
  projectBrief?: string;
  prdTitle?: string;
  selectedModel?: string;
  initialDocs?: Record<string, string>;
  onDocsUpdate?: (updatedDocs: Record<string, string>) => void;
}

export default function DocSuiteViewer({
  prdId,
  prdContent,
  projectBrief,
  prdTitle = "Project Documentation",
  selectedModel: propSelectedModel,
  initialDocs,
  onDocsUpdate,
}: DocSuiteViewerProps) {
  const [suiteModel, setSuiteModel] = useState<string>(
    propSelectedModel || "deepseek-v4-flash"
  );

  const [docsMap, setDocsMap] = useState<Record<string, string>>({});
  const [generatingFiles, setGeneratingFiles] = useState<Record<string, boolean>>({});
  const [selectedFilename, setSelectedFilename] = useState<string>("SUMMARY.md");
  const [copied, setCopied] = useState(false);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [isLoadingFromCloud, setIsLoadingFromCloud] = useState(false);

  // References for abort controllers & generation lifecycle
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const isStoppedRef = useRef(false);
  const docsMapRef = useRef<Record<string, string>>({});
  const onDocsUpdateRef = useRef(onDocsUpdate);

  useEffect(() => {
    onDocsUpdateRef.current = onDocsUpdate;
  }, [onDocsUpdate]);

  // Stable cache key
  const cacheKey = `doc_suite_${prdId || encodeURIComponent(prdTitle).slice(0, 30)}`;

  // Sync ref with state
  useEffect(() => {
    docsMapRef.current = docsMap;
  }, [docsMap]);

  // Load existing docs from initialDocs, localStorage, and Firestore on mount / prdId change
  useEffect(() => {
    let isMounted = true;
    let localFound = false;

    // 1. Initial props if provided
    if (initialDocs && Object.keys(initialDocs).length > 0) {
      setDocsMap(initialDocs);
      docsMapRef.current = initialDocs;
      localFound = true;
    }

    // 2. Load from localStorage
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(cacheKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
            setDocsMap((prev) => {
              const merged = { ...parsed, ...prev };
              docsMapRef.current = merged;
              return merged;
            });
            localFound = true;
          }
        }
      } catch {}
    }

    // 3. Fetch from Firestore if prdId exists
    if (prdId) {
      setIsLoadingFromCloud(!localFound);
      getDoc(doc(db, "prds", prdId))
        .then((snap) => {
          if (isMounted && snap.exists()) {
            const data = snap.data();
            if (data.docSuiteMap && typeof data.docSuiteMap === "object") {
              const merged = { ...data.docSuiteMap, ...docsMapRef.current };
              docsMapRef.current = merged;
              setDocsMap(merged);
              try {
                localStorage.setItem(cacheKey, JSON.stringify(merged));
              } catch {}
              if (onDocsUpdateRef.current) {
                onDocsUpdateRef.current(merged);
              }
            }
          }
        })
        .catch((err) => console.error("Error fetching docSuiteMap:", err))
        .finally(() => {
          if (isMounted) setIsLoadingFromCloud(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [prdId, cacheKey]);

  // Persist updated docs to cache and cloud
  const saveDocsToCacheAndCloud = useCallback(
    async (updatedDocs: Record<string, string>) => {
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem(cacheKey, JSON.stringify(updatedDocs));
        } catch {}
      }
      if (prdId) {
        try {
          await updateDoc(doc(db, "prds", prdId), { docSuiteMap: updatedDocs });
        } catch (err) {
          console.error("Failed to save docSuiteMap to Firestore:", err);
        }
      }
      if (onDocsUpdateRef.current) {
        onDocsUpdateRef.current(updatedDocs);
      }
    },
    [cacheKey, prdId]
  );

  // Stop single file generation
  const stopSingleFile = useCallback((filename: string) => {
    const controller = abortControllersRef.current.get(filename);
    if (controller) {
      controller.abort();
      abortControllersRef.current.delete(filename);
    }
    setGeneratingFiles((prev) => ({ ...prev, [filename]: false }));
  }, []);

  // Stop ALL generation tasks immediately
  const handleStopAll = useCallback(() => {
    isStoppedRef.current = true;
    setIsGeneratingAll(false);

    // Abort all active streams
    abortControllersRef.current.forEach((controller) => {
      try {
        controller.abort();
      } catch {}
    });
    abortControllersRef.current.clear();

    // Reset generating states
    setGeneratingFiles({});
  }, []);

  // Generate single file (with optional force regenerate & signal cancellation)
  const generateSingleFile = useCallback(
    async (filename: string, force: boolean = false): Promise<boolean> => {
      // Check if already generating or has content
      if (generatingFiles[filename] || (!force && docsMapRef.current[filename] && docsMapRef.current[filename].trim().length > 50)) {
        return false;
      }

      // If user requested stop, skip
      if (isStoppedRef.current) return false;

      // Abort any existing stream for this file
      stopSingleFile(filename);

      const controller = new AbortController();
      abortControllersRef.current.set(filename, controller);
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
            model: suiteModel,
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }

        const reader = res.body?.getReader();
        if (!reader) return false;

        const decoder = new TextDecoder();
        while (true) {
          if (controller.signal.aborted || isStoppedRef.current) {
            reader.cancel();
            break;
          }

          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          accumulatedText += chunk;
          setDocsMap((prev) => {
            const next = { ...prev, [filename]: accumulatedText };
            docsMapRef.current = next;
            return next;
          });
        }

        if (accumulatedText.trim().length > 50) {
          const finalMap = { ...docsMapRef.current, [filename]: accumulatedText };
          saveDocsToCacheAndCloud(finalMap);
        }

        return true;
      } catch (err: any) {
        if (err.name === "AbortError" || controller.signal.aborted) {
          console.log(`Generation for ${filename} was stopped by user.`);
        } else {
          console.error(`Error generating ${filename}:`, err);
        }
        return false;
      } finally {
        abortControllersRef.current.delete(filename);
        setGeneratingFiles((prev) => ({ ...prev, [filename]: false }));
      }
    },
    [prdContent, projectBrief, suiteModel, generatingFiles, stopSingleFile, saveDocsToCacheAndCloud]
  );

  // Batch generate missing or all 16 files in parallel chunks ONLY when user clicks
  const generateAllFiles = useCallback(
    async (forceAll: boolean = false) => {
      if (isGeneratingAll) return;
      isStoppedRef.current = false;
      setIsGeneratingAll(true);

      const filesToGenerate = forceAll
        ? DOC_SUITE_FILES
        : DOC_SUITE_FILES.filter((f) => !docsMapRef.current[f.filename] || docsMapRef.current[f.filename].trim().length < 50);

      if (filesToGenerate.length === 0) {
        setIsGeneratingAll(false);
        return;
      }

      // Controlled concurrency (2 parallel streams at a time)
      const CONCURRENCY = 2;
      for (let i = 0; i < filesToGenerate.length; i += CONCURRENCY) {
        if (isStoppedRef.current) break;
        const chunk = filesToGenerate.slice(i, i + CONCURRENCY);
        await Promise.all(chunk.map((f) => generateSingleFile(f.filename, forceAll)));
      }

      setIsGeneratingAll(false);
    },
    [isGeneratingAll, generateSingleFile]
  );

  // Clean up all controllers on unmount
  useEffect(() => {
    return () => {
      handleStopAll();
    };
  }, [handleStopAll]);

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
    URL.revokeObjectURL(url);
  };

  const completedCount = Object.keys(docsMap).filter(
    (key) => docsMap[key] && docsMap[key].trim().length > 50
  ).length;

  const currentContent = docsMap[selectedFilename] || "";
  const isCurrentGenerating = !!generatingFiles[selectedFilename];
  const isAnyGenerating = isGeneratingAll || Object.values(generatingFiles).some(Boolean);
  const currentHasContent = currentContent && currentContent.trim().length > 50;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-4">
      {/* Header Suite Banner */}
      <div className="relative z-40 rounded-3xl bg-surface-1/95 border border-amber-500/30 p-4 sm:p-6 backdrop-blur-xl shadow-xl overflow-visible">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-xs flex-shrink-0">
              <Crown size={28} weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-foreground">
                  AI Project Documentation Suite
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[10px] font-mono font-bold">
                  DATABASE SYNCED
                </span>
              </div>
              <p className="text-xs text-muted leading-relaxed mt-0.5">
                Paket 16 Dokumen Teknikal & Engineering tersimpan permanen di cloud database Anda.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto relative z-50">
            {/* Model Selector Dropdown */}
            <ModelSelector dropUp={false} value={suiteModel} onChange={setSuiteModel} />

            {/* Stop All / Generate Buttons */}
            {isAnyGenerating ? (
              <MagneticButton
                variant="secondary"
                size="sm"
                onClick={handleStopAll}
                className="text-xs gap-1.5 bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 shadow-sm"
                title="Hentikan semua proses generate dokumen"
              >
                <Stop size={15} weight="fill" className="text-red-400 animate-pulse" />
                <span className="font-bold">Hentikan Semua</span>
              </MagneticButton>
            ) : completedCount < 16 ? (
              <MagneticButton
                variant="primary"
                size="sm"
                onClick={() => generateAllFiles(false)}
                disabled={isGeneratingAll}
                className="text-xs gap-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-zinc-950 font-bold border-none shadow-md"
                title="Generate semua dokumen yang belum selesai"
              >
                <Play size={14} weight="fill" />
                <span>{completedCount === 0 ? "Mulai Generate Semua (16 File)" : `Lanjutkan Generate (${completedCount}/16)`}</span>
              </MagneticButton>
            ) : (
              <MagneticButton
                variant="secondary"
                size="sm"
                onClick={() => generateAllFiles(true)}
                disabled={isGeneratingAll}
                className="text-xs gap-1.5"
                title="Generate ulang seluruh 16 dokumen dengan model aktif"
              >
                <Sparkle size={15} weight="fill" className="text-amber-400" />
                <span>Generate Ulang Semua</span>
              </MagneticButton>
            )}

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
            <span>Dokumen Tersimpan di Database</span>
            {isLoadingFromCloud && (
              <span className="text-[11px] text-accent flex items-center gap-1">
                <Spinner size={12} className="animate-spin" /> Memuat dari cloud...
              </span>
            )}
            {isAnyGenerating && (
              <div className="flex items-center gap-1.5 text-accent">
                <Spinner size={14} className="animate-spin" />
                <span className="text-[11px] font-medium">Sedang memproses...</span>
              </div>
            )}
          </div>

          <div className="w-48 h-2 rounded-full bg-surface-2 overflow-hidden border border-border/40 hidden sm:block">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-emerald-400 transition-all duration-300"
              style={{ width: `${(completedCount / 16) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Suite Workspace Layout */}
      <div className="flex flex-col md:flex-row gap-4 h-[75vh] min-h-[600px] overflow-hidden relative z-10">
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
                      <span className="text-[9px] text-muted-foreground/60">Belum Ada</span>
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
              {isCurrentGenerating ? (
                <button
                  onClick={() => stopSingleFile(selectedFilename)}
                  className="px-3 py-1 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-xs text-red-400 border border-red-500/40 transition-all flex items-center gap-1.5 cursor-pointer font-bold"
                  title="Hentikan pembuatan file ini"
                >
                  <Stop size={14} weight="fill" className="text-red-400 animate-pulse" />
                  <span>Hentikan File Ini</span>
                </button>
              ) : currentHasContent ? (
                <button
                  onClick={() => generateSingleFile(selectedFilename, true)}
                  disabled={isCurrentGenerating}
                  className="px-3 py-1 rounded-xl bg-surface-2 hover:bg-surface-3 text-xs text-muted hover:text-foreground border border-border/60 transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Generate ulang file ini dengan model aktif"
                >
                  <ArrowCounterClockwise size={14} />
                  <span>Generate Ulang</span>
                </button>
              ) : (
                <button
                  onClick={() => generateSingleFile(selectedFilename, false)}
                  disabled={isCurrentGenerating}
                  className="px-3 py-1 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                  title="Generate dokumen ini sekarang"
                >
                  <Play size={12} weight="fill" />
                  <span>Generate File Ini</span>
                </button>
              )}
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
                <MagneticButton
                  variant="ghost"
                  size="sm"
                  onClick={() => stopSingleFile(selectedFilename)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Batalkan
                </MagneticButton>
              </div>
            ) : currentHasContent ? (
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
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-16">
                <div className="p-4 rounded-3xl bg-surface-2 border border-border/60 text-muted-foreground/60">
                  <FileText size={40} />
                </div>
                <div className="max-w-sm space-y-1">
                  <h4 className="font-bold text-sm text-foreground">
                    Dokumen {selectedFilename} Belum Digenerate
                  </h4>
                  <p className="text-xs text-muted leading-relaxed">
                    Klik tombol di bawah untuk membuat dokumen ini dengan model <strong className="text-foreground">{suiteModel}</strong>, atau gunakan tombol di atas untuk generate semua sekaligus.
                  </p>
                </div>
                <MagneticButton
                  variant="primary"
                  size="sm"
                  onClick={() => generateSingleFile(selectedFilename, false)}
                  className="text-xs gap-1.5 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold"
                >
                  <Play size={13} weight="fill" />
                  <span>Generate Dokumen Ini</span>
                </MagneticButton>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
