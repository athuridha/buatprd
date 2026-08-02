"use client";

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
  const baseClasses =
    "relative inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus-ring cursor-pointer select-none";

  const sizeClasses = {
    sm: "px-3 py-1.5 text-xs sm:px-4 sm:py-2 sm:text-sm",
    md: "px-5 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base",
    lg: "px-7 py-3 text-base sm:px-8 sm:py-4 sm:text-lg",
  };

  const variantClasses = {
    primary:
      "bg-accent text-zinc-950 hover:bg-accent-hover active:bg-accent/90 shadow-md shadow-accent-glow border border-accent/40",
    secondary:
      "bg-surface-2 text-foreground border border-border/80 hover:bg-surface-3 hover:border-border-light active:bg-surface-3/80",
    ghost:
      "text-muted hover:text-foreground hover:bg-surface-2/80 active:bg-surface-3/80",
  };

  const disabledClasses =
    disabled || isLoading
      ? "opacity-50 cursor-not-allowed pointer-events-none"
      : "";

  return (
    <button
      type={type}
      id={id}
      title={title}
      className={`${baseClasses} ${sizeClasses[size]} ${variantClasses[variant]} ${disabledClasses} ${className}`}
      onClick={disabled || isLoading ? undefined : onClick}
      disabled={disabled || isLoading}
    >
      {isLoading && (
        <svg
          className="animate-spin h-3.5 w-3.5"
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
    </button>
  );
}
