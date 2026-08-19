"use client";

import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, where } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  FileText,
  Crown,
  CurrencyDollar,
  MagnifyingGlass,
  Sparkle,
  ArrowLeft,
  TrendUp,
  ShieldCheck,
  CheckCircle,
  Eye,
  CalendarBlank,
  User,
  Spinner,
} from "@phosphor-icons/react";
import GlassCard from "@/components/ui/GlassCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidRenderer from "@/components/MermaidRenderer";
import { isOwnerUser } from "@/lib/quota";

interface AdminPRD {
  id: string;
  uid: string;
  userEmail?: string;
  userName?: string;
  userPhoto?: string;
  title: string;
  content: string;
  createdAt: any;
  isSuiteUnlocked?: boolean;
}

interface UserStat {
  uid: string;
  email: string;
  name: string;
  photo?: string;
  prdCount: number;
  unlockedSuiteCount: number;
  lastActive: any;
}

export default function AdminDashboard() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [prds, setPrds] = useState<AdminPRD[]>([]);
  const [fetching, setFetching] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPrd, setSelectedPrd] = useState<AdminPRD | null>(null);
  const [permissionError, setPermissionError] = useState(false);
  const [copiedRule, setCopiedRule] = useState(false);

  const isOwner = isOwnerUser(user);

  useEffect(() => {
    if (!loading && (!user || !isOwner)) {
      router.push("/");
    }
  }, [user, loading, isOwner, router]);

  useEffect(() => {
    if (!user || !isOwner) return;

    const fetchAllData = async () => {
      setFetching(true);
      setPermissionError(false);
      try {
        let querySnapshot;
        try {
          // Attempt cross-user query
          querySnapshot = await getDocs(collection(db, "prds"));
        } catch (rulesErr) {
          console.warn("Firestore rules blocked cross-user read, falling back to owner PRDs:", rulesErr);
          setPermissionError(true);
          // Fallback to user's own PRDs
          const q = query(collection(db, "prds"), where("uid", "==", user.uid));
          querySnapshot = await getDocs(q);
        }

        const docsList: AdminPRD[] = [];

        querySnapshot.forEach((docSnap) => {
          const data = docSnap.data();
          docsList.push({
            id: docSnap.id,
            uid: data.uid || "unknown",
            userEmail: data.userEmail || data.email || user.email || "Guest / Unauthenticated",
            userName: data.userName || user.displayName || "User",
            userPhoto: data.userPhoto || user.photoURL || "",
            title: data.title || "Untitled PRD",
            content: data.content || "",
            createdAt: data.createdAt,
            isSuiteUnlocked: data.isSuiteUnlocked === true,
          });
        });

        // Sort descending by creation date
        docsList.sort((a, b) => {
          const timeA = a.createdAt?.seconds
            ? a.createdAt.seconds * 1000
            : a.createdAt?.toDate
            ? a.createdAt.toDate().getTime()
            : Date.now();
          const timeB = b.createdAt?.seconds
            ? b.createdAt.seconds * 1000
            : b.createdAt?.toDate
            ? b.createdAt.toDate().getTime()
            : Date.now();
          return timeB - timeA;
        });

        setPrds(docsList);
      } catch (err) {
        console.error("Error fetching admin analytics:", err);
      } finally {
        setFetching(false);
      }
    };

    fetchAllData();
  }, [user, isOwner]);

  // Aggregate User Stats & Analytics
  const analytics = useMemo(() => {
    const userMap: Record<string, UserStat> = {};
    let unlockedSuitesCount = 0;

    prds.forEach((p) => {
      if (p.isSuiteUnlocked) unlockedSuitesCount += 1;

      const userKey = p.uid || p.userEmail || "guest";
      if (!userMap[userKey]) {
        userMap[userKey] = {
          uid: p.uid,
          email: p.userEmail || "Anonymous",
          name: p.userName || "User",
          photo: p.userPhoto,
          prdCount: 0,
          unlockedSuiteCount: 0,
          lastActive: p.createdAt,
        };
      }

      userMap[userKey].prdCount += 1;
      if (p.isSuiteUnlocked) userMap[userKey].unlockedSuiteCount += 1;
    });

    const userList = Object.values(userMap).sort(
      (a, b) => b.prdCount - a.prdCount
    );

    const totalRevenue = unlockedSuitesCount * 50000;

    return {
      totalPRDs: prds.length,
      totalUsers: userList.length,
      unlockedSuitesCount,
      totalRevenue,
      userList,
    };
  }, [prds]);

  // Filtered PRD list
  const filteredPrds = useMemo(() => {
    if (!searchQuery.trim()) return prds;
    const q = searchQuery.toLowerCase();
    return prds.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.userEmail && p.userEmail.toLowerCase().includes(q)) ||
        (p.userName && p.userName.toLowerCase().includes(q))
    );
  }, [prds, searchQuery]);

  if (loading || (!user && fetching)) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center space-y-4">
        <Spinner size={36} className="text-accent animate-spin" />
        <p className="text-xs text-muted">Memuat Analytics Owner...</p>
      </div>
    );
  }

  if (!isOwner) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-surface-1 border border-border rounded-3xl p-8 space-y-4">
          <ShieldCheck size={48} className="text-red-400 mx-auto" />
          <h3 className="text-xl font-bold text-foreground">Akses Ditolak</h3>
          <p className="text-xs text-muted">Halaman ini khusus Owner aplikasi.</p>
          <Link
            href="/"
            className="inline-block py-2.5 px-6 rounded-xl bg-accent text-zinc-950 font-bold text-xs"
          >
            Kembali ke Beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-4 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider flex items-center gap-1.5 border border-amber-500/30">
              <Crown size={14} weight="fill" />
              Owner Portal
            </span>
            <span className="text-xs text-muted font-mono">
              athuridhaa@gmail.com
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Dashboard Analytics & Pengguna
          </h1>
          <p className="text-xs text-muted mt-1">
            Pantau pertumbuhan user, pembuatan PRD, dan transaksi suite secara real-time.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border/60 text-xs font-semibold text-foreground transition-all cursor-pointer w-fit"
        >
          <ArrowLeft size={16} />
          <span>Kembali ke Generator</span>
        </Link>
      </div>

      {/* Firestore Rule Setup Banner if cross-user query permission denied */}
      {permissionError && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <h4 className="font-bold text-amber-400 text-sm flex items-center gap-2">
                <span>🔐 Petunjuk Izin Firestore Rules</span>
              </h4>
              <p className="text-muted leading-relaxed">
                Saat ini Firebase Console membatasi pembacaan koleksi <code className="bg-surface-2 px-1.5 py-0.5 rounded text-amber-300">prds</code>. Agar Owner dapat membaca seluruh data PRD lintas pengguna, salin dan tempel aturan di bawah ke <strong>Firebase Console → Firestore Database → Rules</strong>:
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                const ruleText = `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /prds/{document} {\n      allow read, write: if request.auth != null;\n    }\n  }\n}`;
                navigator.clipboard.writeText(ruleText);
                setCopiedRule(true);
                setTimeout(() => setCopiedRule(false), 2000);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 transition-colors flex-shrink-0 cursor-pointer self-start sm:self-center shadow-md"
            >
              {copiedRule ? "Aturan Tersalin! ✓" : "Salin Rule Firestore"}
            </button>
          </div>
          <pre className="p-3.5 rounded-xl bg-zinc-950/90 border border-amber-500/20 text-[11px] font-mono text-amber-300/90 overflow-x-auto select-all">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /prds/{document} {
      allow read, write: if request.auth != null;
    }
  }
}`}
          </pre>
        </div>
      )}

      {/* Metric Bento Cards (4 Grid KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Users */}
        <GlassCard className="p-6 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-semibold uppercase tracking-wider">
              Total User Terdaftar
            </span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Users size={20} weight="fill" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
            {fetching ? "..." : analytics.totalUsers}
          </div>
          <p className="text-[11px] text-muted flex items-center gap-1">
            <TrendUp size={14} className="text-emerald-400" />
            <span>Pengguna aktif terpantau</span>
          </p>
        </GlassCard>

        {/* KPI 2: Total PRDs */}
        <GlassCard className="p-6 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-semibold uppercase tracking-wider">
              Total PRD Dibuat
            </span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <FileText size={20} weight="fill" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono tracking-tight text-foreground">
            {fetching ? "..." : analytics.totalPRDs}
          </div>
          <p className="text-[11px] text-muted flex items-center gap-1">
            <Sparkle size={14} className="text-blue-400" />
            <span>Dokumen PRD tersimpan</span>
          </p>
        </GlassCard>

        {/* KPI 3: 16-Doc Suite Unlocked */}
        <GlassCard className="p-6 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-semibold uppercase tracking-wider">
              16-Doc Suite Unlocked
            </span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Crown size={20} weight="fill" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono tracking-tight text-amber-400">
            {fetching ? "..." : analytics.unlockedSuitesCount}
          </div>
          <p className="text-[11px] text-muted flex items-center gap-1">
            <CheckCircle size={14} className="text-amber-400" />
            <span>Dokumentasi 16-Suite aktif</span>
          </p>
        </GlassCard>

        {/* KPI 4: Total Revenue Volume */}
        <GlassCard className="p-6 space-y-3 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted font-semibold uppercase tracking-wider">
              Est. Volume Transaksi
            </span>
            <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <CurrencyDollar size={20} weight="fill" />
            </div>
          </div>
          <div className="text-2xl font-extrabold font-mono tracking-tight text-foreground">
            Rp {analytics.totalRevenue.toLocaleString("id-ID")}
          </div>
          <p className="text-[11px] text-muted flex items-center gap-1">
            <TrendUp size={14} className="text-purple-400" />
            <span>Potensi pendapatan Pakasir</span>
          </p>
        </GlassCard>
      </div>

      {/* User Leaderboard & Activity Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Top Active Users (1 Col) */}
        <GlassCard className="p-6 space-y-4 lg:col-span-1 h-fit">
          <div className="flex items-center justify-between border-b border-border/40 pb-3">
            <h3 className="font-bold text-base flex items-center gap-2">
              <Users size={18} className="text-accent" />
              <span>User Paling Aktif</span>
            </h3>
            <span className="text-xs text-muted font-mono">
              {analytics.userList.length} User
            </span>
          </div>

          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {analytics.userList.length === 0 ? (
              <p className="text-xs text-muted text-center py-6">
                Belum ada data pengguna.
              </p>
            ) : (
              analytics.userList.map((u, idx) => (
                <div
                  key={u.uid || idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-surface-2/60 border border-border/40 hover:bg-surface-2 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {u.photo ? (
                      <img
                        src={u.photo}
                        alt={u.name}
                        className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-surface-3 text-muted-foreground flex items-center justify-center flex-shrink-0 text-xs font-bold">
                        {u.name.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-foreground truncate">
                        {u.name}
                      </p>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {u.email}
                      </p>
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="px-2 py-0.5 rounded-full bg-accent-muted text-accent font-mono text-xs font-bold">
                      {u.prdCount} PRD
                    </span>
                    {u.unlockedSuiteCount > 0 && (
                      <span className="block text-[10px] text-amber-400 font-mono mt-0.5">
                        👑 {u.unlockedSuiteCount} Suite
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        {/* Right Column: All PRDs Table & Search (2 Cols) */}
        <GlassCard className="p-6 space-y-4 lg:col-span-2 flex flex-col min-h-[550px]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-4">
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                <FileText size={18} className="text-accent" />
                <span>Daftar Seluruh PRD System</span>
              </h3>
              <p className="text-xs text-muted">
                Semua dokumen yang dibuat oleh seluruh pengguna.
              </p>
            </div>

            {/* Search Input Bar */}
            <div className="relative w-full sm:w-64">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
              />
              <input
                type="text"
                placeholder="Cari email / judul PRD..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-surface-2 border border-border/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted focus:outline-none focus:border-accent"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border/40 text-muted uppercase text-[10px] tracking-wider font-semibold">
                  <th className="py-3 px-3">Pengguna</th>
                  <th className="py-3 px-3">Judul PRD</th>
                  <th className="py-3 px-3">Status 16-Doc</th>
                  <th className="py-3 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredPrds.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-center py-10 text-muted">
                      Tidak ada PRD yang sesuai dengan pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredPrds.map((prd) => (
                    <tr
                      key={prd.id}
                      className="hover:bg-surface-2/60 transition-colors"
                    >
                      <td className="py-3 px-3 max-w-[180px]">
                        <div className="font-semibold text-foreground truncate">
                          {prd.userName}
                        </div>
                        <div className="text-[11px] text-muted truncate">
                          {prd.userEmail}
                        </div>
                      </td>
                      <td className="py-3 px-3 font-medium text-foreground max-w-[220px] truncate">
                        {prd.title}
                      </td>
                      <td className="py-3 px-3">
                        {prd.isSuiteUnlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold">
                            <Crown size={12} weight="fill" />
                            Unlocked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-2 text-muted border border-border/40 text-[10px]">
                            Standard
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => setSelectedPrd(prd)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-surface-2 hover:bg-accent hover:text-zinc-950 text-foreground border border-border/60 text-xs font-semibold transition-all cursor-pointer"
                        >
                          <Eye size={14} />
                          <span>Lihat PRD</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>
      </div>

      {/* PRD Reader Modal Preview */}
      {selectedPrd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="relative w-full max-w-4xl max-h-[85vh] bg-surface-1 border border-border/80 rounded-3xl p-6 shadow-2xl flex flex-col">
            <div className="flex items-center justify-between border-b border-border/40 pb-4 mb-4">
              <div>
                <span className="text-[10px] text-accent uppercase font-mono tracking-wider font-semibold">
                  Owner Preview Mode
                </span>
                <h3 className="font-bold text-lg text-foreground truncate">
                  {selectedPrd.title}
                </h3>
                <p className="text-xs text-muted">
                  Dibuat oleh: {selectedPrd.userName} ({selectedPrd.userEmail})
                </p>
              </div>
              <button
                onClick={() => setSelectedPrd(null)}
                className="px-3 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-muted hover:text-foreground text-xs font-semibold"
              >
                Tutup
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 prose prose-invert max-w-none text-xs leading-relaxed">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }: any) {
                    const match = /language-(\w+)/.exec(className || "");
                    if (!inline && match && match[1] === "mermaid") {
                      return <MermaidRenderer chart={String(children).replace(/\n$/, "")} />;
                    }
                    return <code className={className} {...props}>{children}</code>;
                  },
                }}
              >
                {selectedPrd.content}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
