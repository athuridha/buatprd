"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash, CalendarBlank, FileText, ArrowLeft, ArrowCounterClockwise, Copy, Check, DownloadSimple, ChatCircleText } from "@phosphor-icons/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidRenderer from "@/components/MermaidRenderer";
import GlassCard from "@/components/ui/GlassCard";
import MagneticButton from "@/components/ui/MagneticButton";
import PRDChatbot from "@/components/PRDChatbot";
import { extractPRDTitle } from "@/lib/prd-utils";

interface PRDDocument {
  id: string;
  title: string;
  content: string;
  createdAt: any;
}

export default function Dashboard() {
  const { user, loading } = useAuth();
  const [prds, setPrds] = useState<PRDDocument[]>([]);
  const [selectedPrd, setSelectedPrd] = useState<PRDDocument | null>(null);
  const [fetching, setFetching] = useState(true);
  const [copied, setCopied] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;

    const fetchPRDs = async () => {
      setFetching(true);
      try {
        const q = query(
          collection(db, "prds"),
          where("uid", "==", user.uid)
        );
        const querySnapshot = await getDocs(q);
        const docsList: PRDDocument[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          const content = data.content || "";
          let title = data.title || "";
          if (
            !title ||
            title === "PRD — Project Requirements Document" ||
            title === "Project Requirements Document" ||
            title === "Assumptions" ||
            title === "PRD Document" ||
            title === "Untitled PRD"
          ) {
            title = extractPRDTitle(content);
          }
          docsList.push({
            id: doc.id,
            title,
            content,
            createdAt: data.createdAt,
          });
        });

        // Client-side sort by createdAt descending (newest first)
        docsList.sort((a, b) => {
          const timeA = a.createdAt?.seconds 
            ? a.createdAt.seconds * 1000 
            : (a.createdAt?.toDate ? a.createdAt.toDate().getTime() : Date.now());
          const timeB = b.createdAt?.seconds 
            ? b.createdAt.seconds * 1000 
            : (b.createdAt?.toDate ? b.createdAt.toDate().getTime() : Date.now());
          return timeB - timeA;
        });

        setPrds(docsList);
        if (docsList.length > 0) {
          setSelectedPrd(docsList[0]);
        }
      } catch (error) {
        console.error("Error fetching PRDs:", error);
      } finally {
        setFetching(false);
      }
    };

    fetchPRDs();
  }, [user]);

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Apakah Anda yakin ingin menghapus PRD ini dari cloud?")) return;

    try {
      await deleteDoc(doc(db, "prds", id));
      setPrds((prev) => prev.filter((prd) => prd.id !== id));
      if (selectedPrd?.id === id) {
        const remaining = prds.filter((prd) => prd.id !== id);
        setSelectedPrd(remaining.length > 0 ? remaining[0] : null);
      }
    } catch (error) {
      console.error("Error deleting PRD:", error);
      alert("Gagal menghapus PRD.");
    }
  };

  const handleCopy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "Baru saja";
    const date = timestamp.toDate();
    return date.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading || (fetching && prds.length === 0)) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 min-h-[80dvh]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
          <p className="text-muted-foreground text-sm font-medium">Memuat Riwayat PRD...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 max-w-[1400px] mx-auto w-full px-4 py-8 flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push("/")}
            className="p-2 rounded-lg hover:bg-surface-2 transition-colors text-muted hover:text-foreground cursor-pointer"
          >
            <ArrowLeft size={20} weight="bold" />
          </button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Riwayat PRD Anda</h1>
            <p className="text-sm text-muted-foreground">Koleksi dokumen PRD yang telah Anda simpan di cloud.</p>
          </div>
        </div>
        <MagneticButton onClick={() => router.push("/")} className="text-sm">
          Buat PRD Baru
        </MagneticButton>
      </div>

      {prds.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 px-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center text-muted-foreground mb-6">
            <FileText size={32} />
          </div>
          <h3 className="text-lg font-bold mb-2">Belum ada PRD yang disimpan</h3>
          <p className="text-sm text-muted-foreground max-w-[40ch] mb-6">
            Generate PRD pertama Anda dan simpan ke Cloud untuk melihatnya di sini.
          </p>
          <MagneticButton onClick={() => router.push("/")}>
            Mulai Sekarang
          </MagneticButton>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start flex-1 min-h-[600px]">
          {/* PRD List Sidebar */}
          <div className="flex flex-col gap-3 max-h-[75vh] overflow-y-auto pr-1">
            {prds.map((prd) => (
              <div
                key={prd.id}
                onClick={() => setSelectedPrd(prd)}
                className={`p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col gap-2 relative group ${
                  selectedPrd?.id === prd.id
                    ? "bg-emerald-500/10 border-emerald-500/30 shadow-[0_4px_20px_-4px_rgba(16,185,129,0.1)]"
                    : "bg-surface-1 border-border/60 hover:border-border hover:bg-surface-2"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <h4 className="font-bold text-sm line-clamp-1 flex-1">
                    {prd.title}
                  </h4>
                  <button
                    onClick={(e) => handleDelete(prd.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 hover:text-red-400 transition-all text-muted cursor-pointer"
                    title="Hapus PRD"
                  >
                    <Trash size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarBlank size={14} />
                  <span>{formatDate(prd.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>

          {/* PRD Viewer Panel */}
          {selectedPrd ? (
            <GlassCard className="flex flex-col h-[75vh] overflow-hidden">
              {/* Header Viewer */}
              <div className="p-4 border-b border-border/40 flex items-center justify-between bg-surface-1/40 backdrop-blur">
                <h3 className="font-bold text-base line-clamp-1 flex-1">
                  {selectedPrd.title}
                </h3>
                <div className="flex items-center gap-2">
                  <Link href="/chat">
                    <MagneticButton
                      variant="primary"
                      size="sm"
                    >
                      <ChatCircleText size={16} weight="fill" />
                      Tanya AI PRD
                    </MagneticButton>
                  </Link>
                  <MagneticButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleCopy(selectedPrd.content)}
                  >
                    {copied ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
                    {copied ? "Copied" : "Copy"}
                  </MagneticButton>
                  <MagneticButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Redirect to editor with preloaded content
                      sessionStorage.setItem("draft_prd", selectedPrd.content);
                      router.push("/?loadDraft=true");
                    }}
                    title="Buka di Editor"
                  >
                    <ArrowCounterClockwise size={16} weight="bold" />
                    Edit
                  </MagneticButton>
                </div>
              </div>

              {/* Content Render */}
              <div className="flex-1 overflow-y-auto p-6 prose-prd">
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
                        return <MermaidRenderer chart={codeContent} />;
                      }
                      return <pre className="p-4 rounded-xl bg-surface-2 border border-border overflow-x-auto">{children}</pre>;
                    },
                    code({ children, className }) {
                      const isInline = !className;
                      if (isInline) {
                        return <code className="bg-surface-2 border border-border/40 px-1.5 py-0.5 rounded text-sm text-accent font-mono">{children}</code>;
                      }
                      return <code className={className}>{children}</code>;
                    }
                  }}
                >
                  {selectedPrd.content}
                </ReactMarkdown>
              </div>
            </GlassCard>
          ) : (
            <div className="flex-1 flex items-center justify-center bg-surface-1 rounded-3xl border border-border/60">
              <p className="text-muted-foreground text-sm">Pilih PRD dari daftar untuk membacanya.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
