"use client";

import { type ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export default function GlassCard({
  children,
  className = "",
  hover = false,
}: GlassCardProps) {
  return (
    <div
      className={`
        relative rounded-2xl
        bg-card/60 backdrop-blur-xl
        border border-white/[0.06]
        shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]
        ${hover ? "transition-colors duration-200 hover:bg-card-hover/70 hover:border-white/[0.1]" : ""}
        ${className}
      `}
    >
      {children}
    </div>
  );
}
