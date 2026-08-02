import { NextResponse } from "next/server";
import { createPakasirQRIS, getPakasirPayUrl } from "@/lib/pakasir";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { amount = 50000, type = "docsuite" } = body;

    const prefix = type === "prd_quota" ? "PRDQUOTA" : "DOCSUITE";
    const orderId = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

    // Call Pakasir API to generate QRIS
    const pakasirRes = await createPakasirQRIS({
      orderId,
      amount: Number(amount) || 50000,
    });

    const payUrl = getPakasirPayUrl(orderId, Number(amount) || 50000);

    if (pakasirRes.error || !pakasirRes.payment) {
      return NextResponse.json(
        {
          success: false,
          error: pakasirRes.error || "Gagal membuat kode QRIS Pakasir.",
          orderId,
          payUrl,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      orderId,
      amount: pakasirRes.payment.amount,
      fee: pakasirRes.payment.fee,
      totalPayment: pakasirRes.payment.total_payment,
      qrisString: pakasirRes.payment.payment_number,
      expiredAt: pakasirRes.payment.expired_at,
      payUrl,
    });
  } catch (err) {
    console.error("Payment create error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memproses transaksi pembayaran." },
      { status: 500 }
    );
  }
}
