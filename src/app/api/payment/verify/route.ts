import { NextResponse } from "next/server";
import { verifyPakasirTransaction } from "@/lib/pakasir";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get("order_id");
    const amountStr = searchParams.get("amount");
    const amount = amountStr ? parseInt(amountStr, 10) : 50000;

    if (!orderId) {
      return NextResponse.json(
        { success: false, error: "Parameter order_id diperlukan." },
        { status: 400 }
      );
    }

    const verification = await verifyPakasirTransaction({
      orderId,
      amount,
    });

    if (verification.error || !verification.transaction) {
      return NextResponse.json({
        success: false,
        status: "pending",
        message: verification.error || "Transaksi masih dalam proses.",
      });
    }

    const tx = verification.transaction;
    const isCompleted = tx.status === "completed";

    return NextResponse.json({
      success: true,
      status: tx.status,
      isCompleted,
      paymentMethod: tx.payment_method,
      completedAt: tx.completed_at,
      amount: tx.amount,
      orderId: tx.order_id,
    });
  } catch (err) {
    console.error("Payment verify error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memverifikasi pembayaran." },
      { status: 500 }
    );
  }
}
