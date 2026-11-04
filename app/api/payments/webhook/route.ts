import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { getRazorpayServerClient } from "@/lib/razorpay";
import { verifyRazorpaySignature } from "@/lib/payments";
import { sendBookingConfirmation } from "@/lib/invoice";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

type RazorpayEvent = { event?: string; payload?: { payment?: { entity?: Record<string, unknown> }; refund?: { entity?: Record<string, unknown> } } };

export async function POST(request: Request) {
  const raw = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!verifyRazorpaySignature(raw, signature, process.env.RAZORPAY_WEBHOOK_SECRET)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  const serviceClient = service;
  let event: RazorpayEvent;
  try { event = JSON.parse(raw) as RazorpayEvent; } catch { return NextResponse.json({ error: "Invalid webhook body." }, { status: 400 }); }
  const eventId = request.headers.get("x-razorpay-event-id") || createHash("sha256").update(raw).digest("hex");
  const { error: dedupeError } = await service.from("payment_events").insert({ event_id: eventId, event_type: event.event ?? "unknown" });
  if (dedupeError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (dedupeError) return NextResponse.json({ error: "Could not record webhook event." }, { status: 500 });

  try {
    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      const paymentId = String(payment?.id ?? "");
      const orderId = String(payment?.order_id ?? "");
      if (!paymentId || !orderId) throw new Error("Captured payment has no order reference.");
      const { data: record } = await service.from("payments").select("id,booking_id,amount_inr").eq("razorpay_order_id", orderId).maybeSingle();
      if (!record) throw new Error("Captured payment is not associated with a booking.");
      const { data: booking } = await service.from("bookings").select("id,status,hold_expires_at,total_inr,amount_paid_inr,razorpay_payment_id").eq("id", record.booking_id).maybeSingle();
      if (!booking) throw new Error("Booking is missing.");
      if (booking.status === "confirmed" && booking.razorpay_payment_id === paymentId) {
        const { error } = await service.from("payments").update({ status: "captured", razorpay_payment_id: paymentId, method: String(payment?.method ?? ""), raw: payment }).eq("id", record.id);
        if (error) throw new Error("Captured payment record could not be saved.");
        await sendBookingConfirmation(service, booking.id);
      } else if (booking.status === "held" && booking.hold_expires_at && new Date(booking.hold_expires_at) > new Date()) {
        const paidInr = Math.ceil(Number(payment?.amount ?? 0) / 100);
        const { data: confirmed, error } = await service.from("bookings").update({ status: "confirmed", hold_expires_at: null, razorpay_payment_id: paymentId, amount_paid_inr: paidInr }).eq("id", booking.id).eq("status", "held").gt("hold_expires_at", new Date().toISOString()).select("id").maybeSingle();
        if (error || !confirmed) {
          if (error?.code === "23P01" || error?.code === "23505") { await refundCapturedPayment(paymentId, paidInr, orderId); }
          else throw new Error("Booking confirmation did not complete.");
        } else {
          const { error: paymentError } = await service.from("payments").update({ status: "captured", razorpay_payment_id: paymentId, method: String(payment?.method ?? ""), raw: payment }).eq("id", record.id);
          if (paymentError) throw new Error("Captured payment record could not be saved.");
          await sendBookingConfirmation(service, booking.id);
        }
      } else {
        const paidInr = Math.ceil(Number(payment?.amount ?? record.amount_inr * 100) / 100);
        await refundCapturedPayment(paymentId, paidInr, orderId);
      }
    } else if (event.event === "payment.failed") {
      const payment = event.payload?.payment?.entity;
      const orderId = String(payment?.order_id ?? "");
      if (orderId) await service.from("payments").update({ status: "failed", raw: payment }).eq("razorpay_order_id", orderId).eq("status", "created");
    } else if (event.event === "refund.processed") {
      const refund = event.payload?.refund?.entity;
      const paymentId = String(refund?.payment_id ?? "");
      if (paymentId) {
        const { data: payment } = await service.from("payments").select("id,booking_id,amount_inr,refunded_inr").eq("razorpay_payment_id", paymentId).maybeSingle();
        if (payment) {
          const refundInr = Math.ceil(Number(refund?.amount ?? 0) / 100);
          const refundedInr = payment.refunded_inr + refundInr;
          const fullRefund = refundedInr >= payment.amount_inr;
          await service.from("payments").update({ refunded_inr: refundedInr, status: fullRefund ? "refunded" : "partially_refunded", raw: refund }).eq("id", payment.id);
          if (fullRefund) await service.from("bookings").update({ status: "refunded" }).eq("id", payment.booking_id).eq("status", "confirmed");
        }
      }
    }
  } catch (error) {
    await service.from("payment_events").delete().eq("event_id", eventId);
    console.error("Razorpay webhook processing failed", error);
    return NextResponse.json({ error: "Webhook processing failed; please retry." }, { status: 500 });
  }
  return NextResponse.json({ received: true });

  async function refundCapturedPayment(paymentId: string, amountInr: number, orderId: string) {
    if (!serviceClient) throw new Error("Admin database is not configured.");
    const razorpay = getRazorpayServerClient();
    if (!razorpay) throw new Error("Razorpay refund client is not configured.");
    const refund = await razorpay.payments.refund(paymentId, { amount: amountInr * 100, notes: { reason: "The 10-minute booking hold expired before confirmation." } });
    const { error } = await serviceClient.from("payments").update({ status: "refunded", razorpay_payment_id: paymentId, refunded_inr: amountInr, raw: { automatic_refund_id: refund.id } }).eq("razorpay_order_id", orderId);
    if (error) throw new Error("Automatic refund record could not be saved.");
  }
}
