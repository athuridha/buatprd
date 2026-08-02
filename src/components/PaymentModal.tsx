"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  QrCode,
  CheckCircle,
  Clock,
  ArrowSquareOut,
  Sparkle,
  Crown,
  ShieldCheck,
  Spinner,
} from "@phosphor-icons/react";
import MagneticButton from "./ui/MagneticButton";

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentSuccess: (orderId: string) => void;
  prdTitle?: string;
  amount?: number;
  type?: "docsuite" | "prd_quota";
  title?: string;
  description?: string;
}

export default function PaymentModal({
  isOpen,
  onClose,
  onPaymentSuccess,
  prdTitle,
  amount: targetAmount = 50000,
  type = "docsuite",
  title = "AI Documentation Suite",
  description = "Paket 16 Dokumen Teknikal & Engineering Lengkap (.md)",
}: PaymentModalProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [qrisString, setQrisString] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(targetAmount);
  const [totalPayment, setTotalPayment] = useState<number>(targetAmount);
  const [isVerifying, setIsVerifying] = useState(false);
  const [paymentCompleted, setPaymentCompleted] = useState(false);

  // Initiate transaction on modal open
  const initiatePayment = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPaymentCompleted(false);

    try {
      const res = await fetch("/api/payment/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: targetAmount, type }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Gagal membuat kode pembayaran.");
      }

      setOrderId(data.orderId);
      setQrisString(data.qrisString || null);
      setPayUrl(data.payUrl);
      setAmount(data.amount || targetAmount);
      setTotalPayment(data.totalPayment || data.amount || targetAmount);
    } catch (err) {
      console.error("Payment modal initiate error:", err);
      setError(
        err instanceof Error ? err.message : "Gagal membuat transaksi Pakasir."
      );
    } finally {
      setLoading(false);
    }
  }, [targetAmount, type]);

  useEffect(() => {
    if (isOpen && !orderId) {
      initiatePayment();
    }
    if (!isOpen) {
      setOrderId(null);
      setQrisString(null);
      setPaymentCompleted(false);
    }
  }, [isOpen, orderId, initiatePayment]);

  // Poll status verification every 4 seconds
  useEffect(() => {
    if (!isOpen || !orderId || paymentCompleted) return;

    const interval = setInterval(async () => {
      try {
        setIsVerifying(true);
        const res = await fetch(
          `/api/payment/verify?order_id=${encodeURIComponent(
            orderId
          )}&amount=${amount}`
        );
        const data = await res.json();

        if (data.success && data.isCompleted) {
          setPaymentCompleted(true);
          clearInterval(interval);
          setTimeout(() => {
            onPaymentSuccess(orderId);
          }, 1500);
        }
      } catch (err) {
        console.error("Polling verify error:", err);
      } finally {
        setIsVerifying(false);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [isOpen, orderId, amount, paymentCompleted, onPaymentSuccess]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative w-full max-w-lg bg-surface-1 border border-border/80 rounded-3xl p-6 sm:p-8 shadow-2xl overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Crown size={24} weight="fill" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground flex items-center gap-2">
                  <span>{title}</span>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 text-[10px] uppercase font-mono">
                    Premium
                  </span>
                </h3>
                <p className="text-xs text-muted leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-foreground hover:bg-surface-2 rounded-xl transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* PRD Subject Info */}
          {prdTitle && (
            <div className="mb-6 p-3 rounded-2xl bg-surface-2/60 border border-border/40 text-xs flex items-center gap-2">
              <Sparkle size={16} className="text-accent flex-shrink-0" />
              <span className="truncate text-muted">
                Project: <strong className="text-foreground">{prdTitle}</strong>
              </span>
            </div>
          )}

          {/* Payment Card Body */}
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
              <Spinner size={36} className="text-accent animate-spin" />
              <p className="text-xs text-muted">Membuat tagihan Pakasir QRIS...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-4">
              <p className="text-xs text-red-400 bg-red-500/10 p-3 rounded-xl border border-red-500/20">
                {error}
              </p>
              <MagneticButton variant="secondary" onClick={initiatePayment}>
                Coba Lagi
              </MagneticButton>
            </div>
          ) : paymentCompleted ? (
            <div className="py-10 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 flex items-center justify-center">
                <CheckCircle size={36} weight="fill" />
              </div>
              <h4 className="text-xl font-bold text-foreground">
                Pembayaran Sukses!
              </h4>
              <p className="text-xs text-muted max-w-xs">
                Transaksi berhasil diverifikasi. Membuka fitur...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* QRIS & Amount Box */}
              <div className="flex flex-col items-center justify-center p-6 rounded-2xl bg-surface-2/80 border border-border/60 text-center relative">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                    Total Pembayaran
                  </span>
                </div>
                <div className="text-3xl font-extrabold text-foreground font-mono tracking-tight mb-4">
                  Rp {totalPayment.toLocaleString("id-ID")}
                </div>

                {/* QR Code Image */}
                {qrisString ? (
                  <div className="p-3 bg-white rounded-2xl shadow-md mb-4 border border-zinc-200">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                        qrisString
                      )}`}
                      alt="Pakasir QRIS Payment Code"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                ) : (
                  <div className="w-48 h-48 rounded-2xl bg-zinc-800 flex items-center justify-center text-muted-foreground text-xs mb-4">
                    Scan via QRIS Pakasir
                  </div>
                )}

                <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                  <QrCode size={16} />
                  <span>Scan dengan GoPay, OVO, Dana, ShopeePay, BNI, BCA, dll</span>
                </div>
              </div>

              {/* Status Polling Indicator */}
              <div className="flex items-center justify-between text-xs px-3 py-2.5 rounded-xl bg-surface-2 border border-border/40">
                <div className="flex items-center gap-2 text-muted">
                  <Clock size={15} className="animate-spin text-accent" />
                  <span>
                    {isVerifying
                      ? "Memeriksa status pembayaran..."
                      : "Menunggu pembayaran via Pakasir..."}
                  </span>
                </div>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              </div>

              {/* Alternative Direct Payment Link */}
              {payUrl && (
                <a
                  href={payUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border/60 text-xs font-semibold text-foreground transition-all"
                >
                  <span>Buka Halaman Pembayaran Pakasir</span>
                  <ArrowSquareOut size={15} />
                </a>
              )}

              {/* Security Footer Note */}
              <div className="flex items-center justify-center gap-2 text-[10px] text-muted-foreground/60">
                <ShieldCheck size={14} className="text-emerald-400" />
                <span>Transaksi aman diproses oleh Pakasir Payment Gateway</span>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
