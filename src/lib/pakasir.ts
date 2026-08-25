const PAKASIR_SLUG = process.env.PAKASIR_SLUG || "buatprd";
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY || "";
const PAKASIR_BASE_URL = "https://app.pakasir.com";

export interface PakasirPaymentResponse {
  payment?: {
    project: string;
    order_id: string;
    amount: number;
    fee: number;
    total_payment: number;
    payment_method: string;
    payment_number: string; // QRIS string
    expired_at: string;
  };
  error?: string;
}

export interface PakasirTransactionDetailResponse {
  transaction?: {
    amount: number;
    order_id: string;
    project: string;
    status: "completed" | "pending" | "canceled" | "expired";
    payment_method: string;
    completed_at?: string;
  };
  error?: string;
}

export async function createPakasirQRIS({
  orderId,
  amount = 50000,
}: {
  orderId: string;
  amount?: number;
}): Promise<PakasirPaymentResponse> {
  try {
    const res = await fetch(`${PAKASIR_BASE_URL}/api/transactioncreate/qris`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        project: PAKASIR_SLUG,
        order_id: orderId,
        amount: amount,
        api_key: PAKASIR_API_KEY,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Pakasir QRIS creation failed:", res.status, errText);
      return { error: `Gagal membuat transaksi Pakasir (${res.status})` };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Pakasir API fetch error:", err);
    return { error: "Terjadi kesalahan koneksi ke Pakasir Gateway." };
  }
}

export async function verifyPakasirTransaction({
  orderId,
  amount = 50000,
}: {
  orderId: string;
  amount?: number;
}): Promise<PakasirTransactionDetailResponse> {
  try {
    const url = `${PAKASIR_BASE_URL}/api/transactiondetail?project=${encodeURIComponent(
      PAKASIR_SLUG
    )}&amount=${amount}&order_id=${encodeURIComponent(
      orderId
    )}&api_key=${encodeURIComponent(PAKASIR_API_KEY)}`;

    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Pakasir Detail Check failed:", res.status, errText);
      return { error: `Gagal memeriksa status transaksi (${res.status})` };
    }

    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Pakasir Detail Check fetch error:", err);
    return { error: "Gagal menghubungkan ke server verifikasi Pakasir." };
  }
}

export function getPakasirPayUrl(orderId: string, amount = 50000) {
  return `${PAKASIR_BASE_URL}/pay/${PAKASIR_SLUG}/${amount}?order_id=${encodeURIComponent(
    orderId
  )}&qris_only=1`;
}
