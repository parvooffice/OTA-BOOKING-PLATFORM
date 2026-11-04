import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { getServerStayQuote } from "@/lib/server-pricing";
import { indianMobilePattern, isValidGuestIdName, normalizeGuestIdName, toE164IndianMobile } from "@/lib/guest-details";

const schema = z.object({
  bookingId: z.string().uuid(),
  guestIdName: z.string().transform(normalizeGuestIdName).refine(isValidGuestIdName, "Enter a valid full name."),
  mobile: z.string().regex(indianMobilePattern, "Enter a valid Indian 10-digit mobile number."),
  guests: z.number().int().min(1).max(20)
});

export async function POST(request: Request) {
  const auth = await getSupabaseServerClient();
  const service = getSupabaseServiceClient();
  if (!auth || !service) return NextResponse.json({ error: "Booking is not configured yet." }, { status: 503 });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update this booking." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Guest details are invalid." }, { status: 400 });

  const { bookingId, guestIdName, mobile, guests } = parsed.data;
  const { data: booking } = await service.from("bookings")
    .select("id,property_id,guest_id,checkin_date,checkout_date,status,hold_expires_at")
    .eq("id", bookingId).eq("guest_id", user.id).maybeSingle();
  if (!booking || booking.status !== "held" || !booking.hold_expires_at || new Date(booking.hold_expires_at) <= new Date()) {
    return NextResponse.json({ error: "This date hold has expired. Please choose your dates again." }, { status: 409 });
  }

  let quote;
  try {
    ({ quote } = await getServerStayQuote(service, { propertyId: booking.property_id, checkin: booking.checkin_date, checkout: booking.checkout_date, guests }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Guest count could not be saved." }, { status: 400 });
  }

  const { data: updated, error } = await service.from("bookings").update({
    guest_id_name: guestIdName,
    guest_phone: toE164IndianMobile(mobile),
    guests,
    extra_guests: quote.extra_guests,
    extra_guest_total_inr: quote.extra_guest_total_inr,
    subtotal_inr: quote.subtotal_inr,
    taxes_inr: quote.taxes_inr,
    total_inr: quote.total_inr
  }).eq("id", bookingId).eq("guest_id", user.id).eq("status", "held").gt("hold_expires_at", new Date().toISOString()).select("id").maybeSingle();
  if (error || !updated) return NextResponse.json({ error: "The date hold ended before guest details could be saved." }, { status: 409 });

  await service.from("profiles").upsert({ id: user.id, full_name: guestIdName, phone: toE164IndianMobile(mobile) }, { onConflict: "id" });
  return NextResponse.json({ saved: true, quote });
}
