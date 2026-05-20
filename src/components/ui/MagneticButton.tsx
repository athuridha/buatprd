"use client";

import { motion, useMotionValue, useTransform } from "framer-motion";
import { useRef, type ReactNode } from "react";

interface MagneticButtonProps {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  id?: string;
  title?: string;
  type?: "button" | "submit" | "reset";
}

export default function MagneticButton({
  children,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  onClick,
  className = "",
  id,
  title,
  type = "button",
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-30, 30], [4, -4]);
  const rotateY = useTransform(x, [-30, 30], [-4, 4]);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!ref.current || disabled || isLoading) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const deltaX = (e.clientX - centerX) * 0.15;
    const deltaY = (e.clientY - centerY) * 0.15;
    x.set(deltaX);
    y.set(deltaY);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const baseClasses =
    "relative inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors focus-ring cursor-pointer select-none";

  const sizeClasses = {
    sm: "px-4 py-2 text-sm",
    md: "px-6 py-3 text-base",
    lg: "px-8 py-4 text-lg",
  };

  const variantClasses = {
    primary:
      "bg-accent text-zinc-950 hover:bg-accent-hover active:scale-[0.98] shadow-lg shadow-accent-glow",
    secondary:
      "bg-surface-3 text-foreground border border-border hover:bg-card-hover hover:border-border-light active:scale-[0.98]",
    ghost:
      "text-muted hover:text-foreground hover:bg-surface-3 active:scale-[0.98]",
  };

  const disabledClasses =
    disabled || isLoading
      ? "opacity-50 cursor-not-allowed pointer-events-none"
      : "";

  return (
    <motion.button
      ref={ref}
      type={type}
      id={id}
      title={title}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      style={{
        x,
        y,
        rotateX,
        rotateY,
        transformStyle: "preserve-3d",
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={disabled || isLoading ? undefined : onClick}
      whileTap={!disabled && !isLoading ? { scale: 0.97 } : undefined}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      disabled={disabled || isLoading}
    >
      {isLoading && (
        <svg
          className="animate-spin h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      )}
      {children}
    </motion.button>
  );
}
