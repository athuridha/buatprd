"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowLeft,
  PencilSimple,
  Check,
  Rocket,
  DeviceMobile,
  UsersFour,
  Stack,
  Database,
  Gear,
} from "@phosphor-icons/react";
import MagneticButton from "./ui/MagneticButton";
import GlassCard from "./ui/GlassCard";

interface SummaryData {
  projectType: string;
  targetUser: string;
  mainProblem: string;
  mainSolution: string;
  platform: string;
  userRoles: string[];
  mvpFeatures: string[];
  mainData: string[];
  technicalNotes: string;
}

interface SummaryConfirmProps {
  summary: SummaryData;
  onConfirm: (summary: SummaryData) => void;
  onBack: () => void;
  isLoading: boolean;
}

const FIELD_CONFIG = [
  {
    key: "projectType" as const,
    label: "Jenis Project",
    icon: Rocket,
    type: "text" as const,
  },
  {
    key: "targetUser" as const,
    label: "Target User",
    icon: UsersFour,
    type: "text" as const,
  },
  {
    key: "mainProblem" as const,
    label: "Masalah Utama",
    icon: Stack,
    type: "text" as const,
  },
  {
    key: "mainSolution" as const,
    label: "Solusi Utama",
    icon: Check,
    type: "text" as const,
  },
  {
    key: "platform" as const,
    label: "Platform",
    icon: DeviceMobile,
    type: "text" as const,
  },
  {
    key: "technicalNotes" as const,
    label: "Catatan Teknis",
    icon: Gear,
    type: "text" as const,
  },
];

export default function SummaryConfirm({
  summary,
  onConfirm,
  onBack,
  isLoading,
}: SummaryConfirmProps) {
  const [editedSummary, setEditedSummary] = useState<SummaryData>(summary);
  const [editingField, setEditingField] = useState<string | null>(null);

  const updateField = (
    key: keyof SummaryData,
    value: string | string[]
  ) => {
    setEditedSummary((prev) => ({ ...prev, [key]: value }));
  };

  const handleListEdit = (
    key: "userRoles" | "mvpFeatures" | "mainData",
    index: number,
    value: string
  ) => {
    const arr = [...editedSummary[key]];
    arr[index] = value;
    setEditedSummary((prev) => ({ ...prev, [key]: arr }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="w-full max-w-[800px] mx-auto px-4 sm:px-6"
    >
      <div className="mb-6">
        <h2 className="text-xl font-bold tracking-tight mb-1">
          Konfirmasi Ringkasan
        </h2>
        <p className="text-sm text-muted">
          Pastikan semua informasi sudah sesuai. Klik field untuk mengedit.
        </p>
      </div>

      <GlassCard className="p-5 sm:p-6">
        <div className="space-y-1">
          {/* Text fields */}
          {FIELD_CONFIG.map((field, index) => {
            const Icon = field.icon;
            const isEditing = editingField === field.key;
            const value = editedSummary[field.key] as string;

            return (
              <motion.div
                key={field.key}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                className="group flex items-start gap-3 py-3 border-b border-border/50 last:border-0"
              >
                <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-muted text-accent flex items-center justify-center mt-0.5">
                  <Icon size={16} weight="bold" />
                </div>

                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    {field.label}
                  </span>

                  {isEditing ? (
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        updateField(field.key, e.target.value)
                      }
                      onBlur={() => setEditingField(null)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && setEditingField(null)
                      }
                      autoFocus
                      className="w-full mt-1 bg-surface-1 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-accent/40 border border-border"
                    />
                  ) : (
                    <button
                      onClick={() => setEditingField(field.key)}
                      className="flex items-center gap-2 mt-0.5 text-sm text-foreground text-left group cursor-pointer w-full"
                    >
                      <span className="flex-1">{value || "—"}</span>
                      <PencilSimple
                        size={14}
                        className="opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0"
                      />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}

          {/* User Roles */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 }}
            className="py-3 border-b border-border/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-muted text-accent flex items-center justify-center">
                <UsersFour size={16} weight="bold" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                User Roles
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 ml-11">
              {editedSummary.userRoles.map((role, i) => (
                <input
                  key={i}
                  type="text"
                  value={role}
                  onChange={(e) =>
                    handleListEdit("userRoles", i, e.target.value)
                  }
                  className="bg-surface-3 rounded-lg px-3 py-1.5 text-xs text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-accent/40 min-w-[80px]"
                />
              ))}
            </div>
          </motion.div>

          {/* MVP Features */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="py-3 border-b border-border/50"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-muted text-accent flex items-center justify-center">
                <Stack size={16} weight="bold" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Fitur MVP
              </span>
            </div>
            <ul className="space-y-1.5 ml-11">
              {editedSummary.mvpFeatures.map((feat, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2 w-1 h-1 bg-accent rounded-full flex-shrink-0" />
                  <input
                    type="text"
                    value={feat}
                    onChange={(e) =>
                      handleListEdit("mvpFeatures", i, e.target.value)
                    }
                    className="flex-1 bg-transparent text-sm text-foreground focus:outline-none focus:bg-surface-1 focus:px-2 focus:rounded border-b border-transparent focus:border-border transition-all"
                  />
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Main Data */}
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35 }}
            className="py-3"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-accent-muted text-accent flex items-center justify-center">
                <Database size={16} weight="bold" />
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Data Utama
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 ml-11">
              {editedSummary.mainData.map((data, i) => (
                <input
                  key={i}
                  type="text"
                  value={data}
                  onChange={(e) =>
                    handleListEdit("mainData", i, e.target.value)
                  }
                  className="bg-surface-3 rounded-lg px-3 py-1.5 text-xs text-foreground border border-border focus:outline-none focus:ring-1 focus:ring-accent/40 min-w-[80px]"
                />
              ))}
            </div>
          </motion.div>
        </div>
      </GlassCard>

      {/* Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-6 pb-8"
      >
        <MagneticButton variant="ghost" size="md" onClick={onBack}>
          <ArrowLeft size={16} weight="bold" />
          Kembali
        </MagneticButton>

        <div className="flex-1" />

        <MagneticButton
          variant="primary"
          size="lg"
          onClick={() => onConfirm(editedSummary)}
          isLoading={isLoading}
          id="confirm-generate-button"
        >
          <Rocket weight="fill" size={18} />
          Generate PRD Final
          <ArrowRight size={16} weight="bold" />
        </MagneticButton>
      </motion.div>
    </motion.div>
  );
}
