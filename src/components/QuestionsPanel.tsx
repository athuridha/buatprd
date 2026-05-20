"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChatCircleDots,
  ArrowRight,
  ArrowLeft,
  SkipForward,
  CheckCircle,
  Target,
  Users,
  Warning,
} from "@phosphor-icons/react";
import MagneticButton from "./ui/MagneticButton";
import GlassCard from "./ui/GlassCard";

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

interface QuestionsPanelProps {
  analysis: AnalysisData;
  questions: Question[];
  onSubmitAnswers: (answers: { question: string; answer: string }[]) => void;
  onSkip: () => void;
  onBack: () => void;
  isLoading: boolean;
}

export default function QuestionsPanel({
  analysis,
  questions,
  onSubmitAnswers,
  onSkip,
  onBack,
  isLoading,
}: QuestionsPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const answeredCount = Object.values(answers).filter(
    (a) => a.trim().length > 0
  ).length;
  const minRequired = Math.ceil(questions.length * 0.5);

  const handleOptionClick = (questionId: string, option: string) => {
    setAnswers((prev) => {
      const current = prev[questionId] || "";
      if (current.includes(option)) {
        return { ...prev, [questionId]: current.replace(option, "").trim() };
      }
      return {
        ...prev,
        [questionId]: current ? `${current}, ${option}` : option,
      };
    });
  };

  const handleSubmit = () => {
    const formattedAnswers = questions
      .filter((q) => answers[q.id]?.trim())
      .map((q) => ({
        question: q.question,
        answer: answers[q.id].trim(),
      }));
    onSubmitAnswers(formattedAnswers);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[1100px] mx-auto px-4 sm:px-6"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Sidebar: Analysis Summary */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:sticky lg:top-6 lg:self-start"
        >
          <GlassCard className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <ChatCircleDots weight="fill" size={18} className="text-accent" />
              Analisis AI
            </h3>

            <div className="space-y-4 text-sm">
              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Target size={14} />
                  <span className="font-medium">Jenis Project</span>
                </div>
                <p className="text-foreground">{analysis.projectType}</p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Users size={14} />
                  <span className="font-medium">Target User</span>
                </div>
                <p className="text-foreground">{analysis.targetUser}</p>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                  <Warning size={14} />
                  <span className="font-medium">Masalah Utama</span>
                </div>
                <p className="text-foreground">{analysis.mainProblem}</p>
              </div>

              {analysis.unclearParts.length > 0 && (
                <div className="pt-3 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    Perlu dipastikan:
                  </p>
                  <ul className="space-y-1">
                    {analysis.unclearParts.map((part, i) => (
                      <li
                        key={i}
                        className="text-xs text-accent flex items-start gap-1.5"
                      >
                        <span className="mt-1 w-1 h-1 bg-accent rounded-full flex-shrink-0" />
                        {part}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Progress */}
          <div className="mt-4 px-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>Dijawab</span>
              <span className="font-mono">
                {answeredCount}/{questions.length}
              </span>
            </div>
            <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-accent rounded-full"
                initial={{ width: 0 }}
                animate={{
                  width: `${(answeredCount / questions.length) * 100}%`,
                }}
                transition={{ type: "spring", stiffness: 100, damping: 20 }}
              />
            </div>
          </div>
        </motion.div>

        {/* Main: Questions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Pertanyaan Klarifikasi
            </h2>
            <span className="text-xs text-muted-foreground">
              Min. {minRequired} jawaban
            </span>
          </div>

          {questions.map((q, index) => (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                delay: index * 0.06,
                duration: 0.4,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <GlassCard className="p-4" hover>
                <div className="flex gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-accent-muted text-accent text-xs font-bold flex items-center justify-center mt-0.5">
                    {index + 1}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground mb-3 leading-relaxed">
                      {q.question}
                    </p>

                    {q.options && q.options.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        {q.options.map((option) => {
                          const isSelected = answers[q.id]?.includes(option);
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => handleOptionClick(q.id, option)}
                              className={`
                                px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer
                                ${
                                  isSelected
                                    ? "bg-accent text-zinc-950"
                                    : "bg-surface-3 text-muted hover:bg-card-hover hover:text-foreground border border-border"
                                }
                              `}
                            >
                              {option}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <textarea
                      value={answers[q.id] || ""}
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                      placeholder="Tulis jawaban..."
                      rows={2}
                      className="w-full bg-surface-1 rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:ring-1 focus:ring-accent/40 border border-border transition-all"
                      id={`answer-${q.id}`}
                    />

                    {answers[q.id]?.trim() && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-1 mt-1.5 text-xs text-accent"
                      >
                        <CheckCircle weight="fill" size={14} />
                        <span>Dijawab</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-4 pb-8"
          >
            <MagneticButton variant="ghost" size="md" onClick={onBack}>
              <ArrowLeft size={16} weight="bold" />
              Kembali
            </MagneticButton>

            <div className="flex-1" />

            <MagneticButton
              variant="secondary"
              size="md"
              onClick={onSkip}
              disabled={isLoading}
            >
              <SkipForward size={16} weight="bold" />
              Skip, generate dengan asumsi
            </MagneticButton>

            <MagneticButton
              variant="primary"
              size="md"
              onClick={handleSubmit}
              disabled={answeredCount < minRequired}
              isLoading={isLoading}
              id="submit-answers-button"
            >
              Lanjut ke Summary
              <ArrowRight size={16} weight="bold" />
            </MagneticButton>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
