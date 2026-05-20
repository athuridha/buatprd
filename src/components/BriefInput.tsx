"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightning,
  ArrowRight,
  TextAlignLeft,
  Sparkle,
} from "@phosphor-icons/react";
import MagneticButton from "./ui/MagneticButton";
import GlassCard from "./ui/GlassCard";

interface BriefInputProps {
  onSubmit: (brief: string) => void;
  onSkipToGenerate: (brief: string) => void;
  isLoading: boolean;
}

const PLACEHOLDER_PROMPTS = [
  "Saya ingin membuat aplikasi inventory untuk gudang kecil...",
  "Saya ingin membuat platform booking salon online...",
  "Saya ingin membuat dashboard finance pribadi...",
  "Saya ingin membuat sistem manajemen klinik gigi...",
  "Saya ingin membuat marketplace jual beli mobil bekas...",
];

export default function BriefInput({
  onSubmit,
  onSkipToGenerate,
  isLoading,
}: BriefInputProps) {
  const [brief, setBrief] = useState("");
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIdx((prev) => (prev + 1) % PLACEHOLDER_PROMPTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(
        160,
        textareaRef.current.scrollHeight
      )}px`;
    }
  }, [brief]);

  const canSubmit = brief.trim().length >= 10;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[900px] mx-auto px-4 sm:px-6"
    >
      {/* Hero */}
      <div className="mb-10 text-left">
        <motion.div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-muted border border-accent/20 text-accent text-xs font-medium mb-6"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Sparkle weight="fill" size={14} />
          AI-Powered PRD Generator
        </motion.div>

        <motion.h1
          className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tighter leading-none mb-4"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          Ubah ide jadi{" "}
          <span className="text-accent">PRD profesional</span>
        </motion.h1>

        <motion.p
          className="text-base sm:text-lg text-muted max-w-[55ch] leading-relaxed"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          Deskripsikan project yang mau kamu buat. AI akan menganalisis,
          bertanya hal-hal penting, lalu menyusun PRD yang siap dipakai untuk
          vibe coding.
        </motion.p>
      </div>

      {/* Input Area */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <GlassCard className="p-1.5">
          <div className="relative">
            <div className="flex items-center gap-2 px-4 pt-3 pb-1 text-muted-foreground">
              <TextAlignLeft size={16} weight="bold" />
              <span className="text-xs font-medium tracking-wide uppercase">
                Project Brief
              </span>
              <span className="ml-auto text-xs font-mono tabular-nums">
                {brief.length}
              </span>
            </div>

            <textarea
              ref={textareaRef}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder={PLACEHOLDER_PROMPTS[placeholderIdx]}
              disabled={isLoading}
              className="w-full bg-transparent px-4 py-3 text-foreground text-base leading-relaxed placeholder:text-muted-foreground/40 resize-none focus:outline-none min-h-[160px] transition-colors"
              id="brief-input"
            />
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 px-3 pb-3">
            <MagneticButton
              variant="primary"
              size="md"
              onClick={() => onSubmit(brief.trim())}
              disabled={!canSubmit}
              isLoading={isLoading}
              className="flex-1 sm:flex-none"
              id="analyze-button"
            >
              <Lightning weight="fill" size={18} />
              Analisis Brief
              <ArrowRight size={16} weight="bold" />
            </MagneticButton>

            <MagneticButton
              variant="ghost"
              size="md"
              onClick={() => onSkipToGenerate(brief.trim())}
              disabled={!canSubmit || isLoading}
              className="text-sm"
              id="skip-button"
            >
              Langsung generate PRD
            </MagneticButton>
          </div>
        </GlassCard>
      </motion.div>

      {/* Floating hints */}
      <AnimatePresence mode="wait">
        <motion.div
          key={placeholderIdx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.4 }}
          className="mt-6 flex items-start gap-2 text-xs text-muted-foreground/60"
        >
          <Lightning size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Contoh: &quot;{PLACEHOLDER_PROMPTS[placeholderIdx]}&quot;
          </span>
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
