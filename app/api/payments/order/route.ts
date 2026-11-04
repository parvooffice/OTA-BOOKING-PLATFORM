import { NextResponse } from "next/server";
import { z } from "zod";
import { getRazorpayServerClient } from "@/lib/razorpay";
import { paymentAmountInPaise } from "@/lib/payments";
import { isValidGuestIdName } from "@/lib/guest-details";
import { getServerStayQuote } from "@/lib/server-pricing";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({ bookingId: z.string().uuid(), payInFull: z.boolean() });
const e164India = /^\+91[6-9]\d{9}$/;

export async function POST(request: Request) {
  const auth = await getSupabaseServerClient();
  const service = getSupabaseServiceClient();
  const razorpay = getRazorpayServerClient();
  if (!auth || !service || !razorpay || !process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID) return NextResponse.json({ error: "Payments are not configured yet." }, { status: 503 });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid booking." }, { status: 400 });

  const { data: booking } = await service.from("bookings")
    .select("id,guest_id,guest_id_name,guest_phone,status,guests,checkin_date,checkout_date,hold_expires_at,property_id")
    .eq("id", parsed.data.bookingId).eq("guest_id", user.id).maybeSingle();
  if (!booking || booking.status !== "held" || !booking.hold_expires_at || new Date(booking.hold_expires_at) <= new Date()) {
    return NextResponse.json({ error: "This date hold has expired. Please choose your dates again." }, { status: 409 });
  }
  if (!isValidGuestIdName(booking.guest_id_name) || !e164India.test(booking.guest_phone)) {
    return NextResponse.json({ error: "Save valid guest details before starting payment." }, { status: 400 });
  }

  let quote;
  try {
    ({ quote } = await getServerStayQuote(service, {
      propertyId: booking.property_id,
      checkin: booking.checkin_date,
      checkout: booking.checkout_date,
      guests: booking.guests
    }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Booking price could not be verified." }, { status: 400 });
  }

  const { data: settings } = await service.from("admin_settings").select("key,value").in("key", ["deposit_enabled", "deposit_percent"]);
  const depositEnabled = settings?.find((item) => item.key === "deposit_enabled")?.value === true;
  const depositPercent = Number(settings?.find((item) => item.key === "deposit_percent")?.value ?? 30);
  const payInFull = parsed.data.payInFull || !depositEnabled;
  const amountInr = payInFull ? quote.total_inr : Math.max(1, Math.ceil(quote.total_inr * depositPercent / 100));

  const { data: quotedBooking, error: quoteError } = await service.from("bookings").update({
    extra_guests: quote.extra_guests,
    extra_guest_total_inr: quote.extra_guest_total_inr,
    subtotal_inr: quote.subtotal_inr,
    taxes_inr: quote.taxes_inr,
    total_inr: quote.total_inr
  }).eq("id", booking.id).eq("status", "held").gt("hold_expires_at", new Date().toISOString()).select("id").maybeSingle();
  if (quoteError || !quotedBooking) return NextResponse.json({ error: "Your date hold needs to be renewed. Please try again." }, { status: 409 });

  let order;
  try {
    order = await razorpay.orders.create({
      amount: paymentAmountInPaise(amountInr),
      currency: "INR",
      receipt: booking.id.replaceAll("-", "").slice(0, 40),
      notes: { booking_id: booking.id, payment_type: payInFull ? "full" : "deposit" }
    });
  } catch {
    return NextResponse.json({ error: "We could not open checkout. Please try again in a moment." }, { status: 502 });
  }

  const { data: updated, error: bookingError } = await service.from("bookings")
    .update({ razorpay_order_id: order.id, deposit_percent: payInFull ? 100 : depositPercent })
    .eq("id", booking.id).eq("status", "held").gt("hold_expires_at", new Date().toISOString()).select("id").maybeSingle();
  if (bookingError || !updated) return NextResponse.json({ error: "Your date hold needs to be renewed. Please try again." }, { status: 409 });

  const { error: paymentError } = await service.from("payments").insert({ booking_id: booking.id, razorpay_order_id: order.id, status: "created", amount_inr: amountInr, raw: { order_id: order.id, currency: "INR" } });
  if (paymentError) return NextResponse.json({ error: "We could not save your checkout. Please try again." }, { status: 500 });
  return NextResponse.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID, bookingId: booking.id, amountInr, deposit: !payInFull, quote });
}
