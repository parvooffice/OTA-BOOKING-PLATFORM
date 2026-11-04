import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getRazorpayServerClient } from "@/lib/razorpay";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({ paymentId: z.string().uuid(), amountInr: z.number().int().min(1), reason: z.string().max(200).default("Owner-initiated refund") });

export async function POST(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient(); const razorpay = getRazorpayServerClient();
  if (!service || !razorpay) return NextResponse.json({ error: "Refunds are not configured." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid refund amount." }, { status: 400 });
  const { data: payment } = await service.from("payments").select("id,booking_id,razorpay_payment_id,amount_inr,refunded_inr,status").eq("id", parsed.data.paymentId).maybeSingle();
  const refundable = payment ? payment.amount_inr - payment.refunded_inr : 0;
  if (!payment?.razorpay_payment_id || !["captured", "partially_refunded"].includes(payment.status) || parsed.data.amountInr > refundable) return NextResponse.json({ error: "This payment cannot be refunded for that amount." }, { status: 409 });
  try {
    const refund = await razorpay.payments.refund(payment.razorpay_payment_id, { amount: parsed.data.amountInr * 100, notes: { reason: parsed.data.reason, booking_id: payment.booking_id } });
    await service.from("payments").update({ status: "refund_pending", raw: { admin_refund_id: refund.id, requested_refund_inr: parsed.data.amountInr, reason: parsed.data.reason } }).eq("id", payment.id);
    return NextResponse.json({ refundId: refund.id, status: refund.status });
  } catch { return NextResponse.json({ error: "Razorpay could not create the refund. Please check its dashboard." }, { status: 502 }); }
}
