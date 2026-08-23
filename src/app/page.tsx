"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { useModel } from "@/context/ModelContext";
import { useChat } from "@/context/ChatContext";
import { ChatCircleText } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import PhaseIndicator from "@/components/ui/PhaseIndicator";
import BriefInput from "@/components/BriefInput";
import QuestionsPanel from "@/components/QuestionsPanel";
import SummaryConfirm from "@/components/SummaryConfirm";
import PRDOutput from "@/components/PRDOutput";
import PaymentModal from "@/components/PaymentModal";
import { extractPRDTitle } from "@/lib/prd-utils";
import { getPRDQuotaStatus, incrementPRDCount, addExtraPRDQuota } from "@/lib/quota";

/* ---- Types ---- */
interface AnalysisData {
  projectType: string;
  targetUser: string;
  mainProblem: string;
  clearParts: string[];
  unclearParts: string[];
}

interface Question {
  id: string;
  question: string;
  options?: string[];
}

interface SummaryData {
  projectType: string;
  targetUser: string;
  mainProblem: string;
  mainSolution: string;
  platform: string;
  frameworkPreference?: string;
  userRoles: string[];
  mvpFeatures: string[];
  mainData: string[];
  technicalNotes: string;
}

type Phase = 1 | 2 | 3 | 4;

const PHASE_LABELS = ["Brief", "Klarifikasi", "Konfirmasi", "PRD"];

/* ---- Helper: stream fetch and collect text ---- */
async function streamFetch(
  url: string,
  body: object,
  onChunk: (text: string) => void
): Promise<string> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No readable stream");

  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    fullText += chunk;
    onChunk(fullText);
  }

  return fullText;
}

/* ---- Helpers: parse AI JSON output ---- */
function cleanJSONParse(raw: string): any {
  if (!raw || typeof raw !== "string" || !raw.trim()) {
    throw new Error("Respons data AI kosong.");
  }

  let clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  const startObj = clean.indexOf("{");
  const endObj = clean.lastIndexOf("}");
  const startArr = clean.indexOf("[");
  const endArr = clean.lastIndexOf("]");

  if (startObj !== -1 && endObj !== -1 && endObj > startObj) {
    clean = clean.substring(startObj, endObj + 1);
  } else if (startArr !== -1 && endArr !== -1 && endArr > startArr) {
    clean = clean.substring(startArr, endArr + 1);
  }

  try {
    return JSON.parse(clean);
  } catch (err1) {
    try {
      const sanitized = clean
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, "");
      return JSON.parse(sanitized);
    } catch {
      throw err1;
    }
  }
}

function parseAnalysis(raw: string): {
  analysis: AnalysisData;
  questions: Question[];
} | null {
  try {
    const parsed = cleanJSONParse(raw);
    const questions = (parsed.questions || []).map(
      (q: { id?: string; question: string; options?: string[] }, i: number) => ({
        id: q.id || `q${i + 1}`,
        question: q.question,
        options: q.options || [],
      })
    );

    if (questions.length === 0) {
      throw new Error("Daftar pertanyaan kosong.");
    }

    return {
      analysis: {
        projectType: parsed.analysis?.projectType || "Aplikasi Web/Mobile",
        targetUser: parsed.analysis?.targetUser || "Pengguna Utama",
        mainProblem: parsed.analysis?.mainProblem || "Efisiensi proses dan manajemen data",
        clearParts: parsed.analysis?.clearParts || ["Ide dasar dan alur umum"],
        unclearParts: parsed.analysis?.unclearParts || ["Preferensi teknologi dan peran user"],
      },
      questions,
    };
  } catch (e) {
    console.warn("parseAnalysis fallback used:", e);
    return {
      analysis: {
        projectType: "Aplikasi Terpadu",
        targetUser: "Pengguna & Administrator",
        mainProblem: "Optimalisasi dan efisiensi sistem digital",
        clearParts: ["Konsep umum aplikasi"],
        unclearParts: ["Preferensi stack teknologi & batasan bisnis"],
      },
      questions: [
        {
          id: "q1",
          question: "Apa platform dan tech stack utama yang ingin Anda gunakan?",
          options: ["Next.js (React) + Tailwind", "React + Vite", "PHP / Laravel", "Mobile (Flutter/React Native)"],
        },
        {
          id: "q2",
          question: "Siapa saja role pengguna yang akan menggunakan sistem ini?",
          options: ["Single Role (User)", "Admin & User Biasa", "Multi-role (Superadmin, Manager, Staff)"],
        },
        {
          id: "q3",
          question: "Fitur apa yang paling penting untuk MVP tahap pertama?",
          options: ["Autentikasi & Dashboard", "Manajemen Data Utama & Transaksi", "Laporan & Ekspor Data"],
        },
      ],
    };
  }
}

function parseSummary(raw: string, fallbackBrief?: string): SummaryData | null {
  try {
    const parsed = cleanJSONParse(raw);
    const s = parsed.summary || parsed;
    return {
      projectType: s.projectType || "Aplikasi Web / Software",
      targetUser: s.targetUser || "Pengguna Utama",
      mainProblem: s.mainProblem || "Kebutuhan otomatisasi dan efisiensi sistem",
      mainSolution: s.mainSolution || "Platform digital terstruktur",
      platform: s.platform || "Web Application",
      frameworkPreference: s.frameworkPreference || "Next.js (React)",
      userRoles: Array.isArray(s.userRoles) && s.userRoles.length > 0 ? s.userRoles : ["Admin", "User"],
      mvpFeatures: Array.isArray(s.mvpFeatures) && s.mvpFeatures.length > 0 ? s.mvpFeatures : ["Dashboard", "Manajemen Data", "Autentikasi"],
      mainData: Array.isArray(s.mainData) && s.mainData.length > 0 ? s.mainData : ["User Profile", "Master Data", "Transaksi"],
      technicalNotes: s.technicalNotes || "Arsitektur modular, scalable, dan siap pakai.",
    };
  } catch (e) {
    console.warn("parseSummary fallback used due to parse error:", e);
    if (fallbackBrief || (raw && raw.trim().length > 5)) {
      return {
        projectType: "Web / Mobile Application",
        targetUser: "Pengguna & Tim Terkait",
        mainProblem: "Otomatisasi proses dan integrasi sistem",
        mainSolution: fallbackBrief ? fallbackBrief.slice(0, 150) : "Sistem manajemen terintegrasi",
        platform: "Web (Responsive)",
        frameworkPreference: "Next.js (React) + Tailwind CSS",
        userRoles: ["Admin", "User"],
        mvpFeatures: ["Autentikasi & Otorisasi", "Dashboard & Visualisasi Data", "Manajemen Entitas Utama", "Ekspor & Notifikasi"],
        mainData: ["Data Pengguna", "Data Transaksi/Aktivitas", "Pengaturan Sistem"],
        technicalNotes: "Dirancang untuk kemudahan vibe coding dan deployment cepat.",
      };
    }
    return null;
  }
}

export default function Home() {
  const { user, signInWithGoogle } = useAuth();
  const { selectedModel } = useModel();
  const { isChatOpen, openChat } = useChat();
  const [phase, setPhase] = useState<Phase>(1);
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quota & Payment Modals
  const [isQuotaPaymentModalOpen, setIsQuotaPaymentModalOpen] = useState(false);
  const [authPromptModalOpen, setAuthPromptModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const autoSavePRD = useCallback(
    async (content: string, briefText?: string, summaryData?: SummaryData | null) => {
      if (!user || !content) return;
      try {
        const title = extractPRDTitle(content, briefText, summaryData);
        await addDoc(collection(db, "prds"), {
          uid: user.uid,
          userEmail: user.email || "Anonymous",
          userName: user.displayName || "User",
          userPhoto: user.photoURL || "",
          title,
          content,
          createdAt: serverTimestamp(),
        });
        console.log("PRD auto-saved to cloud with title:", title);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    },
    [user]
  );

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("loadDraft") === "true") {
        const draft = sessionStorage.getItem("draft_prd");
        if (draft) {
          setPrdMarkdown(draft);
          setPhase(4);
          // Don't remove right away in case they refresh, but let's clear it
          sessionStorage.removeItem("draft_prd");
          // Clear URL parameter
          window.history.replaceState({}, "", window.location.pathname);
        }
      }
    }
  }, []);

  // Phase 2 data
  const [analysis, setAnalysis] = useState<AnalysisData | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  // Phase 3 data
  const [summary, setSummary] = useState<SummaryData | null>(null);

  // Phase 4 data
  const [prdMarkdown, setPrdMarkdown] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  /* ---- Phase 1: Analyze Brief ---- */
  const handleAnalyze = useCallback(async (briefText: string) => {
    setBrief(briefText);
    setIsLoading(true);
    setError(null);

    try {
      const raw = await streamFetch(
        "/api/analyze",
        { brief: briefText, model: selectedModel },
        () => {} // We don't stream the UI for analysis, just collect
      );

      const result = parseAnalysis(raw);
      if (!result || result.questions.length === 0) {
        throw new Error("AI tidak bisa menganalisis brief. Coba perjelas deskripsi project.");
      }

      setAnalysis(result.analysis);
      setQuestions(result.questions);
      setPhase(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menganalisis brief.");
    } finally {
      setIsLoading(false);
    }
  }, [selectedModel]);

  /* ---- Phase 1 alt: Skip to generate ---- */
  const handleSkipToGenerate = useCallback(async (briefText: string) => {
    const quota = getPRDQuotaStatus(user);
    if (!quota.canGeneratePRD) {
      if (quota.requiresAuth) {
        setPendingAction(() => () => handleSkipToGenerate(briefText));
        setAuthPromptModalOpen(true);
        return;
      }
      if (quota.requiresPayment) {
        setPendingAction(() => () => handleSkipToGenerate(briefText));
        setIsQuotaPaymentModalOpen(true);
        return;
      }
    }

    incrementPRDCount(user);
    setBrief(briefText);
    setIsLoading(true);
    setIsStreaming(true);
    setPrdMarkdown("");
    setPhase(4);
    setError(null);

    try {
      const finalText = await streamFetch(
        "/api/generate-prd",
        { brief: briefText, skipQuestions: true, model: selectedModel },
        (text) => setPrdMarkdown(text)
      );
      if (user) {
        await autoSavePRD(finalText, briefText);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate PRD.");
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [user, selectedModel, autoSavePRD]);

  /* ---- Phase 2: Submit Answers → Summarize ---- */
  const handleSubmitAnswers = useCallback(
    async (answers: { question: string; answer: string }[]) => {
      setIsLoading(true);
      setError(null);

      try {
        const raw = await streamFetch(
          "/api/summarize",
          { brief, answers, model: selectedModel },
          () => {}
        );

        const result = parseSummary(raw, brief);
        if (!result) {
          throw new Error("AI tidak bisa membuat ringkasan. Coba lagi.");
        }

        setSummary(result);
        setPhase(3);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat ringkasan.");
      } finally {
        setIsLoading(false);
      }
    },
    [brief, selectedModel]
  );

  /* ---- Phase 2 alt: Skip questions ---- */
  const handleSkipQuestions = useCallback(() => {
    handleSkipToGenerate(brief);
  }, [brief, handleSkipToGenerate]);

  /* ---- Phase 3: Confirm → Generate PRD ---- */
  const handleConfirmGenerate = useCallback(
    async (confirmedSummary: SummaryData) => {
      const quota = getPRDQuotaStatus(user);
      if (!quota.canGeneratePRD) {
        if (quota.requiresAuth) {
          setPendingAction(() => () => handleConfirmGenerate(confirmedSummary));
          setAuthPromptModalOpen(true);
          return;
        }
        if (quota.requiresPayment) {
          setPendingAction(() => () => handleConfirmGenerate(confirmedSummary));
          setIsQuotaPaymentModalOpen(true);
          return;
        }
      }

      incrementPRDCount(user);
      setSummary(confirmedSummary);
      setIsLoading(true);
      setIsStreaming(true);
      setPrdMarkdown("");
      setPhase(4);
      setError(null);

      try {
        const finalText = await streamFetch(
          "/api/generate-prd",
          { brief, summary: confirmedSummary, model: selectedModel },
          (text) => setPrdMarkdown(text)
        );
        if (user) {
          await autoSavePRD(finalText, brief, confirmedSummary);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal generate PRD.");
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [brief, user, selectedModel, autoSavePRD]
  );

  /* ---- Regenerate PRD in Phase 4 ---- */
  const handleRegeneratePRD = useCallback(async () => {
    if (!brief) return;
    setIsLoading(true);
    setIsStreaming(true);
    setPrdMarkdown("");
    setError(null);

    try {
      const finalText = await streamFetch(
        "/api/generate-prd",
        summary
          ? { brief, summary, model: selectedModel }
          : { brief, skipQuestions: true, model: selectedModel },
        (text) => setPrdMarkdown(text)
      );
      if (user) {
        await autoSavePRD(finalText, brief, summary);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal generate PRD.");
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  }, [brief, summary, selectedModel, user, autoSavePRD]);

  /* ---- Start Over ---- */
  const handleStartOver = useCallback(() => {
    setPhase(1);
    setBrief("");
    setAnalysis(null);
    setQuestions([]);
    setSummary(null);
    setPrdMarkdown("");
    setIsStreaming(false);
    setError(null);
  }, []);

  return (
    <main className="flex-1 flex flex-col pt-6">
      {/* Phase Indicator container under Navbar */}
      <div className="max-w-[1400px] mx-auto w-full px-4 sm:px-6 flex justify-center mb-6">
        <PhaseIndicator currentPhase={phase} phases={PHASE_LABELS} />
      </div>

      {/* Error Banner */}
      {error && (
        <div className="max-w-[900px] mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-sm text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <button
              onClick={() => setError(null)}
              className="text-red-400/60 hover:text-red-400 ml-4 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Phase Content */}
      <div className="flex-1 flex flex-col items-center justify-start py-8 sm:py-12">
        <AnimatePresence mode="wait">
          {phase === 1 && (
            <BriefInput
              key="phase-1"
              onSubmit={handleAnalyze}
              onSkipToGenerate={handleSkipToGenerate}
              isLoading={isLoading}
            />
          )}

          {phase === 2 && analysis && questions.length > 0 && (
            <QuestionsPanel
              key="phase-2"
              analysis={analysis}
              questions={questions}
              onSubmitAnswers={handleSubmitAnswers}
              onSkip={handleSkipQuestions}
              onBack={() => setPhase(1)}
              isLoading={isLoading}
            />
          )}

          {phase === 3 && summary && (
            <SummaryConfirm
              key="phase-3"
              summary={summary}
              onConfirm={handleConfirmGenerate}
              onBack={() => setPhase(2)}
              isLoading={isLoading}
            />
          )}

          {phase === 4 && (
            <PRDOutput
              key="phase-4"
              markdown={prdMarkdown}
              isStreaming={isStreaming}
              onStartOver={handleStartOver}
              projectBrief={brief}
              summary={summary}
              selectedModel={selectedModel}
              onRegeneratePRD={handleRegeneratePRD}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4 text-center text-xs text-muted-foreground/50">
        BuatPRD — AI-Assisted PRD Generator for Vibe Coding
      </footer>
      {/* Quota Payment Modal (Rp 15.000) */}
      <PaymentModal
        isOpen={isQuotaPaymentModalOpen}
        onClose={() => setIsQuotaPaymentModalOpen(false)}
        onPaymentSuccess={(orderId) => {
          addExtraPRDQuota(user, 5);
          setIsQuotaPaymentModalOpen(false);
          if (pendingAction) {
            pendingAction();
            setPendingAction(null);
          }
        }}
        amount={15000}
        type="prd_quota"
        title="Top Up Quota PRD (Rp 15.000)"
        description="Beli 5 Kuota Pembuatan PRD Tambahan via Pakasir QRIS"
      />

      {/* Guest Auth Required Modal (3/3 Limit Reached) */}
      {authPromptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-md">
          <div className="max-w-md w-full bg-surface-1 border border-border rounded-3xl p-8 text-center space-y-4 shadow-2xl">
            <h3 className="text-xl font-bold text-foreground">Batas PRD Gratis Guest (3/3) Tersebab</h3>
            <p className="text-xs text-muted leading-relaxed">
              Anda telah menggunakan 3 kuota PRD gratis tanpa akun. Silakan <strong>Sign In dengan Google</strong> untuk mendapatkan <strong>5 kuota PRD gratis</strong>!
            </p>
            <button
              onClick={async () => {
                setAuthPromptModalOpen(false);
                await signInWithGoogle();
                if (pendingAction) {
                  pendingAction();
                  setPendingAction(null);
                }
              }}
              className="w-full py-3 px-4 rounded-xl bg-accent text-zinc-950 font-bold text-sm hover:bg-accent-hover transition-all cursor-pointer shadow-lg shadow-accent-glow"
            >
              Sign In dengan Google (Gratis 5 PRD)
            </button>
            <button
              onClick={() => setAuthPromptModalOpen(false)}
              className="text-xs text-muted hover:text-foreground hover:underline block mx-auto cursor-pointer"
            >
              Batal
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
