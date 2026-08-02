"use client";

import { useState, useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import PhaseIndicator from "@/components/ui/PhaseIndicator";
import BriefInput from "@/components/BriefInput";
import QuestionsPanel from "@/components/QuestionsPanel";
import SummaryConfirm from "@/components/SummaryConfirm";
import PRDOutput from "@/components/PRDOutput";
import { extractPRDTitle } from "@/lib/prd-utils";

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
  let clean = raw.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    clean = clean.substring(start, end + 1);
  }
  return JSON.parse(clean);
}

function parseAnalysis(raw: string): {
  analysis: AnalysisData;
  questions: Question[];
} | null {
  try {
    const parsed = cleanJSONParse(raw);
    return {
      analysis: {
        projectType: parsed.analysis?.projectType || "Tidak terdeteksi",
        targetUser: parsed.analysis?.targetUser || "Belum diketahui",
        mainProblem: parsed.analysis?.mainProblem || "Belum diketahui",
        clearParts: parsed.analysis?.clearParts || [],
        unclearParts: parsed.analysis?.unclearParts || [],
      },
      questions: (parsed.questions || []).map(
        (q: { id?: string; question: string; options?: string[] }, i: number) => ({
          id: q.id || `q${i + 1}`,
          question: q.question,
          options: q.options || [],
        })
      ),
    };
  } catch (e) {
    console.error("parseAnalysis error:", e);
    return null;
  }
}

function parseSummary(raw: string): SummaryData | null {
  try {
    const parsed = cleanJSONParse(raw);
    const s = parsed.summary || parsed;
    return {
      projectType: s.projectType || "",
      targetUser: s.targetUser || "",
      mainProblem: s.mainProblem || "",
      mainSolution: s.mainSolution || "",
      platform: s.platform || "Web",
      frameworkPreference: s.frameworkPreference || "",
      userRoles: s.userRoles || ["Admin"],
      mvpFeatures: s.mvpFeatures || [],
      mainData: s.mainData || [],
      technicalNotes: s.technicalNotes || "",
    };
  } catch (e) {
    console.error("parseSummary error:", e);
    return null;
  }
}

export default function Home() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>(1);
  const [brief, setBrief] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const autoSavePRD = useCallback(
    async (content: string, briefText?: string, summaryData?: SummaryData | null) => {
      if (!user || !content) return;
      try {
        const title = extractPRDTitle(content, briefText, summaryData);
        await addDoc(collection(db, "prds"), {
          uid: user.uid,
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
        { brief: briefText },
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
  }, []);

  /* ---- Phase 1 alt: Skip to generate ---- */
  const handleSkipToGenerate = useCallback(async (briefText: string) => {
    setBrief(briefText);
    setIsLoading(true);
    setIsStreaming(true);
    setPrdMarkdown("");
    setPhase(4);
    setError(null);

    try {
      const finalText = await streamFetch(
        "/api/generate-prd",
        { brief: briefText, skipQuestions: true },
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
  }, [user, autoSavePRD]);

  /* ---- Phase 2: Submit Answers → Summarize ---- */
  const handleSubmitAnswers = useCallback(
    async (answers: { question: string; answer: string }[]) => {
      setIsLoading(true);
      setError(null);

      try {
        const raw = await streamFetch(
          "/api/summarize",
          { brief, answers },
          () => {}
        );

        const result = parseSummary(raw);
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
    [brief]
  );

  /* ---- Phase 2 alt: Skip questions ---- */
  const handleSkipQuestions = useCallback(() => {
    handleSkipToGenerate(brief);
  }, [brief, handleSkipToGenerate]);

  /* ---- Phase 3: Confirm → Generate PRD ---- */
  const handleConfirmGenerate = useCallback(
    async (confirmedSummary: SummaryData) => {
      setSummary(confirmedSummary);
      setIsLoading(true);
      setIsStreaming(true);
      setPrdMarkdown("");
      setPhase(4);
      setError(null);

      try {
        const finalText = await streamFetch(
          "/api/generate-prd",
          { brief, summary: confirmedSummary },
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
    [brief, user, autoSavePRD]
  );

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
            />
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/30 py-4 text-center text-xs text-muted-foreground/50">
        BuatPRD — AI-Assisted PRD Generator for Vibe Coding
      </footer>
    </main>
  );
}
