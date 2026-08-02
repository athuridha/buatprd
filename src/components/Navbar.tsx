"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/context/AuthContext";
import {
  GoogleLogo,
  SignOut,
  ChatCircleText,
  Sparkle,
  ClockCounterClockwise,
  List,
  X,
  User,
  CaretDown,
} from "@phosphor-icons/react";
import MagneticButton from "./ui/MagneticButton";

export default function Navbar() {
  const { user, loading, signInWithGoogle, signOut } = useAuth();
  const pathname = usePathname();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const profileRef = useRef<HTMLDivElement>(null);

  // Close profile dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setIsProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsProfileOpen(false);
  }, [pathname]);

  const navItems = [
    {
      href: "/",
      label: "Generator PRD",
      icon: Sparkle,
    },
    {
      href: "/chat",
      label: "AI Chatbot",
      icon: ChatCircleText,
      badge: true,
    },
    ...(user
      ? [
          {
            href: "/dashboard",
            label: "Riwayat PRD",
            icon: ClockCounterClockwise,
          },
        ]
      : []),
  ];

  return (
    <nav className="w-full border-b border-border/40 bg-surface-1/70 backdrop-blur-xl sticky top-0 z-50 print:hidden select-none">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Left Slot: Brand Logo */}
        <div className="flex items-center gap-3 flex-1 justify-start">
          <Link href="/" className="font-bold tracking-tight text-xl flex items-center gap-2.5 group">
            <img
              src="/logo.png"
              alt="BuatPRD Logo"
              className="w-8 h-8 rounded-lg object-cover group-hover:scale-105 transition-transform"
            />
            <span className="bg-gradient-to-br from-emerald-400 to-emerald-600 bg-clip-text text-transparent font-extrabold">
              BuatPRD
            </span>
            <span className="text-muted-foreground text-xs font-medium hidden lg:inline-block px-2.5 py-0.5 rounded-full bg-surface-2 border border-border/40">
              AI Vibe Coding
            </span>
          </Link>
        </div>

        {/* Center Slot: Desktop Navigation Menu Tabs (100% Symmetrical Centered) */}
        <div className="hidden md:flex items-center justify-center flex-1">
          <div className="flex items-center gap-1.5 bg-surface-2/60 border border-border/50 p-1 rounded-2xl shadow-xs">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all duration-200 cursor-pointer ${
                    isActive
                      ? "bg-accent text-background font-bold shadow-xs"
                      : "text-muted hover:text-foreground hover:bg-surface-3/60"
                  }`}
                >
                  <Icon size={16} weight={isActive ? "bold" : "regular"} />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.badge && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Slot: Profile Avatar & Actions */}
        <div className="flex items-center gap-3 flex-1 justify-end">
          {/* User Profile Avatar with Dropdown */}
          {!loading && (
            <>
              {user ? (
                <div ref={profileRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setIsProfileOpen((prev) => !prev)}
                    className="flex items-center gap-2 p-1 rounded-full hover:bg-surface-2 transition-all cursor-pointer border border-border/60 hover:border-accent/40"
                    title="User Profile"
                  >
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt={user.displayName || "User"}
                        className="w-8 h-8 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-muted-foreground">
                        <User size={18} weight="bold" />
                      </div>
                    )}
                    <CaretDown
                      size={12}
                      className={`text-muted-foreground transition-transform duration-200 mr-1 hidden sm:block ${
                        isProfileOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Profile Dropdown Menu */}
                  <AnimatePresence>
                    {isProfileOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.95 }}
                        transition={{ duration: 0.15, ease: "easeOut" }}
                        className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface-1/95 border border-border/80 shadow-2xl backdrop-blur-xl z-50 p-2 space-y-1"
                      >
                        {/* User Header */}
                        <div className="p-2.5 border-b border-border/40">
                          <p className="font-bold text-xs text-foreground truncate">
                            {user.displayName || "Pengguna BuatPRD"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>

                        {/* Dropdown Options */}
                        <Link
                          href="/dashboard"
                          onClick={() => setIsProfileOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-muted hover:text-foreground hover:bg-surface-2 transition-colors cursor-pointer"
                        >
                          <ClockCounterClockwise size={16} />
                          <span>Riwayat PRD</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => {
                            setIsProfileOpen(false);
                            signOut();
                          }}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer text-left"
                        >
                          <SignOut size={16} />
                          <span>Keluar / Sign Out</span>
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <MagneticButton
                  onClick={signInWithGoogle}
                  variant="secondary"
                  className="gap-2 text-xs h-9 px-3.5"
                >
                  <GoogleLogo weight="bold" />
                  <span>Sign In</span>
                </MagneticButton>
              )}
            </>
          )}

          {/* Mobile Hamburger Toggle Button */}
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen((prev) => !prev)}
            className="p-2 text-muted hover:text-foreground hover:bg-surface-2 rounded-xl transition-colors md:hidden cursor-pointer border border-border/40"
            title="Navigasi Menu"
          >
            {isMobileMenuOpen ? <X size={20} /> : <List size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer / Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="md:hidden border-t border-border/40 bg-surface-1/95 backdrop-blur-2xl px-4 py-4 space-y-3 overflow-hidden shadow-2xl"
          >
            <div className="space-y-1">
              <span className="block px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Navigasi Utama
              </span>
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-accent text-background font-bold shadow-xs"
                        : "text-muted hover:text-foreground hover:bg-surface-2"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Icon size={18} weight={isActive ? "bold" : "regular"} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && !isActive && (
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    )}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
