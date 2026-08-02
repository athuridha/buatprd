import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    console.log("Pakasir Webhook received payload:", payload);

    const { amount, order_id, project, status, payment_method, completed_at } = payload;

    if (!order_id || !status) {
      return NextResponse.json(
        { error: "Invalid webhook payload structure." },
        { status: 400 }
      );
    }

    if (status === "completed") {
      console.log(`Payment SUCCESS for Order ID ${order_id}, amount: Rp ${amount}`);
    }

    return NextResponse.json({ success: true, received: true });
  } catch (err) {
    console.error("Pakasir Webhook handling error:", err);
    return NextResponse.json(
      { error: "Failed to process webhook." },
      { status: 500 }
    );
  }
}
