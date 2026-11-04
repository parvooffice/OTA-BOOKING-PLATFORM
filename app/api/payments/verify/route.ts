import { NextResponse } from "next/server";
import { z } from "zod";
import { getRazorpayServerClient } from "@/lib/razorpay";
import { verifyCheckoutSignature } from "@/lib/payments";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({ bookingId: z.string().uuid(), orderId: z.string().min(5), paymentId: z.string().min(5), signature: z.string().min(20) });

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const service = getSupabaseServiceClient();
  const razorpay = getRazorpayServerClient();
  if (!supabase || !service || !razorpay || !process.env.RAZORPAY_KEY_SECRET) return NextResponse.json({ error: "Payment verification is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to finish payment verification." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Payment details are incomplete." }, { status: 400 });
  const { bookingId, orderId, paymentId, signature } = parsed.data;
  if (!verifyCheckoutSignature(orderId, paymentId, signature, process.env.RAZORPAY_KEY_SECRET)) return NextResponse.json({ error: "The payment signature could not be verified." }, { status: 400 });
  const { data: booking } = await supabase.from("bookings").select("id,guest_id,status,razorpay_order_id,hold_expires_at,total_inr").eq("id", bookingId).eq("guest_id", user.id).maybeSingle();
  if (!booking || booking.razorpay_order_id !== orderId) return NextResponse.json({ error: "This payment does not match your booking." }, { status: 404 });
  try {
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.order_id !== orderId) return NextResponse.json({ error: "Payment belongs to another order." }, { status: 400 });
    const amountInr = Math.ceil(Number(payment.amount) / 100);
    const { error } = await service.from("payments").update({ status: payment.status === "captured" ? "authorized" : "authorized", razorpay_payment_id: paymentId, method: payment.method, raw: { checkout_signature_verified: true, payment_status: payment.status, order_id: orderId } }).eq("razorpay_order_id", orderId);
    if (error && error.code !== "23505") return NextResponse.json({ error: "Payment receipt could not be saved." }, { status: 500 });
    if (amountInr > booking.total_inr) return NextResponse.json({ error: "Payment amount is higher than the booking total." }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "We could not confirm the payment with Razorpay. Your host has not been charged twice; please contact us." }, { status: 502 });
  }
  // Checkout callbacks are not authoritative. The signed Razorpay webhook confirms the reservation.
  return NextResponse.json({ status: "processing", message: "Payment received. We’re confirming your stay now." });
}
