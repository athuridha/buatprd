"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { GoogleLogo, SignOut, CaretDown } from "@phosphor-icons/react";
import MagneticButton from "./ui/MagneticButton";

export default function Navbar() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  return (
    <nav className="w-full border-b border-border/40 bg-surface-1/50 backdrop-blur-md sticky top-0 z-50 print:hidden">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/" className="font-bold tracking-tight text-xl flex items-center gap-2">
          <img src="/logo.png" alt="BuatPRD Logo" className="w-8 h-8 rounded-lg object-cover" />
          <span className="bg-gradient-to-br from-emerald-400 to-emerald-600 bg-clip-text text-transparent">
            BuatPRD
          </span>
          <span className="text-muted-foreground text-sm font-normal hidden sm:inline-block">
            / AI Vibe Coding
          </span>
        </Link>

        <div className="flex items-center gap-4">
          {!loading && (
            <>
              {user ? (
                <div className="flex items-center gap-4">
                  <Link 
                    href="/dashboard" 
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Riwayat PRD
                  </Link>
                  <div className="flex items-center gap-2 pl-4 border-l border-border/40">
                    {user.photoURL && (
                      <img 
                        src={user.photoURL} 
                        alt={user.displayName || "User"} 
                        className="w-8 h-8 rounded-full border border-border"
                      />
                    )}
                    <button 
                      onClick={signOut}
                      className="text-muted-foreground hover:text-red-400 transition-colors"
                      title="Sign Out"
                    >
                      <SignOut size={20} />
                    </button>
                  </div>
                </div>
              ) : (
                <MagneticButton
                  onClick={signInWithGoogle}
                  variant="secondary"
                  className="gap-2 text-sm h-9 px-4"
                >
                  <GoogleLogo weight="bold" />
                  Sign In
                </MagneticButton>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
