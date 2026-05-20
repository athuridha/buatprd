"use client";

import { motion } from "framer-motion";
import { Check } from "@phosphor-icons/react";

interface PhaseIndicatorProps {
  currentPhase: number;
  phases: string[];
}

export default function PhaseIndicator({
  currentPhase,
  phases,
}: PhaseIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 py-6 px-4">
      {phases.map((label, index) => {
        const phaseNum = index + 1;
        const isActive = phaseNum === currentPhase;
        const isCompleted = phaseNum < currentPhase;

        return (
          <div key={label} className="flex items-center gap-1 sm:gap-2">
            <div className="flex items-center gap-2">
              <motion.div
                className={`
                  relative flex items-center justify-center w-8 h-8 rounded-full text-sm font-mono font-semibold
                  ${
                    isCompleted
                      ? "bg-accent text-zinc-950"
                      : isActive
                      ? "bg-accent-muted text-accent border border-accent/40"
                      : "bg-surface-3 text-muted-foreground border border-border"
                  }
                `}
                animate={
                  isActive
                    ? {
                        boxShadow: [
                          "0 0 8px rgba(16,185,129,0.2)",
                          "0 0 20px rgba(16,185,129,0.3)",
                          "0 0 8px rgba(16,185,129,0.2)",
                        ],
                      }
                    : {}
                }
                transition={{
                  duration: 2.5,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: "spring",
                      stiffness: 300,
                      damping: 15,
                    }}
                  >
                    <Check weight="bold" size={16} />
                  </motion.div>
                ) : (
                  phaseNum
                )}
              </motion.div>

              <span
                className={`hidden sm:block text-xs font-medium tracking-wide ${
                  isActive
                    ? "text-accent"
                    : isCompleted
                    ? "text-foreground"
                    : "text-muted-foreground"
                }`}
              >
                {label}
              </span>
            </div>

            {index < phases.length - 1 && (
              <div
                className={`w-6 sm:w-10 h-px ${
                  isCompleted ? "bg-accent" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
