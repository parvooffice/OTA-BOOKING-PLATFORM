import { NextResponse } from "next/server";
import { z } from "zod";
import { getRazorpayServerClient } from "@/lib/razorpay";
import { paymentAmountInPaise } from "@/lib/payments";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({ bookingId: z.string().uuid(), payInFull: z.boolean() });

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  const admin = getSupabaseServiceClient();
  const razorpay = getRazorpayServerClient();
  if (!supabase || !admin || !razorpay || !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });
  const { data: booking } = await supabase.from("bookings").select("id,guest_id,status,total_inr,hold_expires_at,property_id").eq("id", parsed.data.bookingId).eq("guest_id", user.id).maybeSingle();
  if (!booking || booking.status !== "held" || !booking.hold_expires_at || new Date(booking.hold_expires_at) <= new Date()) return NextResponse.json({ error: "This date hold has expired. Please choose your dates again." }, { status: 409 });

  const { data: settings } = await admin.from("admin_settings").select("key,value").in("key", ["deposit_enabled", "deposit_percent"]);
  const depositEnabled = settings?.find((item) => item.key === "deposit_enabled")?.value === true;
  const depositPercent = Number(settings?.find((item) => item.key === "deposit_percent")?.value ?? 30);
  const payInFull = parsed.data.payInFull || !depositEnabled;
  const amountInr = payInFull ? booking.total_inr : Math.max(1, Math.ceil(booking.total_inr * depositPercent / 100));
  let order;
  try {
    order = await razorpay.orders.create({ amount: paymentAmountInPaise(amountInr), currency: "INR", receipt: booking.id.replaceAll("-", "").slice(0, 40), notes: { booking_id: booking.id, payment_type: payInFull ? "full" : "deposit" } });
  } catch {
    return NextResponse.json({ error: "We could not open checkout. Please try again in a moment." }, { status: 502 });
  }
  const { error: bookingError } = await admin.from("bookings").update({ razorpay_order_id: order.id, deposit_percent: payInFull ? 100 : depositPercent }).eq("id", booking.id).eq("status", "held");
  if (bookingError) return NextResponse.json({ error: "Your date hold needs to be renewed. Please try again." }, { status: 409 });
  const { error: paymentError } = await admin.from("payments").insert({ booking_id: booking.id, razorpay_order_id: order.id, status: "created", amount_inr: amountInr, raw: { order_id: order.id, currency: "INR" } });
  if (paymentError) return NextResponse.json({ error: "We could not save your checkout. Please try again." }, { status: 500 });
  return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, bookingId: booking.id, amountInr, deposit: !payInFull });
}
