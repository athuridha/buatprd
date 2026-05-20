"use client";

import { useEffect, useRef, useMemo, memo, useState, useCallback } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useReactToPrint } from "react-to-print";
import {
  Copy,
  DownloadSimple,
  ArrowCounterClockwise,
  Check,
  List,
} from "@phosphor-icons/react";
import MagneticButton from "./ui/MagneticButton";
import GlassCard from "./ui/GlassCard";
import MermaidRenderer from "./MermaidRenderer";

interface PRDOutputProps {
  markdown: string;
  isStreaming: boolean;
  onStartOver: () => void;
}

/* Check if a mermaid code block is complete (has closing ```) */
function isCompleteMermaidBlock(md: string, blockContent: string): boolean {
  // Find this mermaid block in the markdown
  const idx = md.indexOf(blockContent);
  if (idx === -1) return false;
  // Check if there's a closing ``` after the content
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
  // Don't render incomplete blocks (during streaming)
  if (!isCompleteMermaidBlock(fullMarkdown, children)) {
    return (
      <div className="rounded-xl bg-surface-1 border border-border p-4 my-4">
        <div className="flex items-center gap-2 mb-2 text-xs text-accent">
          <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
          <span>Generating diagram...</span>
        </div>
        <pre className="text-sm font-mono text-muted overflow-x-auto whitespace-pre-wrap opacity-50">
          {children}
        </pre>
      </div>
    );
  }

  return <MermaidRenderer chart={children} />;
});

/* Table of contents extractor */
function extractTOC(md: string): { level: number; text: string; id: string }[] {
  const headings: { level: number; text: string; id: string }[] = [];
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
}: PRDOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [showTOC, setShowTOC] = useState(false);

  const toc = useMemo(() => extractTOC(markdown), [markdown]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (isStreaming && scrollRef.current) {
      const el = scrollRef.current;
      el.scrollTop = el.scrollHeight;
    }
  }, [markdown, isStreaming]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = markdown;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [markdown]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prd_document.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [markdown]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: "PRD_Document",
    pageStyle: `
      @page { size: auto; margin: 20mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; }
      }
    `
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[1100px] mx-auto px-4 sm:px-6"
    >
      {/* Toolbar */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4"
      >
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold tracking-tight">PRD Document</h2>
          {isStreaming && (
            <div className="flex items-center gap-1.5 text-xs text-accent">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              Generating...
            </div>
          )}
        </div>

        <div className="flex-1" />

        <div className="flex items-center gap-1.5">
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

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handleCopy}
            disabled={isStreaming || !markdown}
          >
            {copied ? (
              <Check size={16} weight="bold" />
            ) : (
              <Copy size={16} weight="bold" />
            )}
            {copied ? "Copied" : "Copy"}
          </MagneticButton>

          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handleDownload}
            disabled={isStreaming || !markdown}
          >
            <DownloadSimple size={16} weight="bold" />
            .md
          </MagneticButton>
          
          <MagneticButton
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            disabled={isStreaming || !markdown}
          >
            <DownloadSimple size={16} weight="bold" />
            .pdf
          </MagneticButton>

          <MagneticButton
            variant="ghost"
            size="sm"
            onClick={onStartOver}
          >
            <ArrowCounterClockwise size={16} weight="bold" />
            Mulai Ulang
          </MagneticButton>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-4">
        {/* PRD Content */}
        <GlassCard className="p-6 sm:p-8">
          <div
            ref={scrollRef}
            className="prose-prd max-h-[70vh] overflow-y-auto pr-2 relative"
          >
            {/* 
              This inner div is what gets extracted for the PDF. 
            */}
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
                      return (
                        <MermaidBlock fullMarkdown={markdown}>
                          {codeContent}
                        </MermaidBlock>
                      );
                    }
                    return <pre>{children}</pre>;
                  },
                  code(props) {
                    const { children, className, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || "");
                    const lang = match?.[1];
                    const codeString = String(children).replace(/\n$/, "");

                    if (lang === "mermaid") {
                      return (
                        <MermaidBlock fullMarkdown={markdown}>
                          {codeString}
                        </MermaidBlock>
                      );
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
                {markdown}
              </ReactMarkdown>
            </div>

            {isStreaming && (
              <span className="inline-block w-2 h-5 bg-accent ml-1 cursor-blink" />
            )}
          </div>
        </GlassCard>

        {/* TOC Sidebar */}
        {showTOC && toc.length > 0 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden lg:block lg:sticky lg:top-6 lg:self-start"
          >
            <GlassCard className="p-4">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Daftar Isi
              </h4>
              <nav className="space-y-1">
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
