import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getServerStayQuote } from "@/lib/server-pricing";
import { indianMobilePattern, isValidGuestIdName, normalizeGuestIdName, toE164IndianMobile } from "@/lib/guest-details";

const blockSchema = z.object({ action: z.literal("block"), propertyId: z.string().uuid(), startDate: z.string(), endDate: z.string(), reason: z.string().max(180).default("Unavailable") });
const offlineSchema = z.object({ action: z.literal("offline"), propertyId: z.string().uuid(), checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), guests: z.number().int().min(1).max(20), email: z.string().email(), name: z.string().transform(normalizeGuestIdName).refine(isValidGuestIdName, "Enter a valid guest name."), phone: z.string().regex(indianMobilePattern, "Enter a 10-digit Indian mobile number."), expectedArrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).refine((time) => time >= "10:00" && time <= "20:00").default("15:00") });

export async function POST(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (body?.action === "block") {
    const parsed = blockSchema.safeParse(body);
    if (!parsed.success || parsed.data.endDate <= parsed.data.startDate) return NextResponse.json({ error: "Choose a valid date range." }, { status: 400 });
    const { propertyId, startDate, endDate, reason } = parsed.data;
    const { error } = await service.from("blocked_dates").insert({ property_id: propertyId, range: `[${startDate},${endDate})`, reason });
    if (error) return NextResponse.json({ error: "Those dates overlap another block or could not be saved." }, { status: 409 });
    return NextResponse.json({ saved: true });
  }

  const parsed = offlineSchema.safeParse(body);
  if (!parsed.success || parsed.data.checkout <= parsed.data.checkin) return NextResponse.json({ error: parsed.error?.issues[0]?.message ?? "Check the guest details and dates." }, { status: 400 });
  const input = parsed.data;
  let quote;
  try {
    ({ quote } = await getServerStayQuote(service, { propertyId: input.propertyId, checkin: input.checkin, checkout: input.checkout, guests: input.guests }));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Price could not be calculated." }, { status: 400 });
  }

  const { data: users, error: userListError } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (userListError) return NextResponse.json({ error: "Guest account could not be loaded." }, { status: 500 });
  let guestId = users.users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase())?.id;
  if (!guestId) {
    const { data: created, error } = await service.auth.admin.createUser({ email: input.email, email_confirm: true, user_metadata: { full_name: input.name, phone: toE164IndianMobile(input.phone) } });
    if (error || !created.user) return NextResponse.json({ error: "Guest profile could not be created." }, { status: 500 });
    guestId = created.user.id;
  }
  const phoneE164 = toE164IndianMobile(input.phone);
  const { error: profileError } = await service.from("profiles").upsert({ id: guestId, full_name: input.name, phone: phoneE164 });
  if (profileError) return NextResponse.json({ error: "Guest profile could not be saved." }, { status: 500 });

  const { data: booking, error } = await service.from("bookings").insert({
    property_id: input.propertyId, guest_id: guestId, guest_id_name: input.name, guest_phone: phoneE164,
    checkin_date: input.checkin, checkout_date: input.checkout, expected_arrival_time: input.expectedArrivalTime,
    guests: input.guests, extra_guests: quote.extra_guests, extra_guest_total_inr: quote.extra_guest_total_inr,
    status: "confirmed", subtotal_inr: quote.subtotal_inr, taxes_inr: quote.taxes_inr, total_inr: quote.total_inr,
    amount_paid_inr: 0, notes: `Offline booking · ${quote.nights} nights`
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Those dates are unavailable or the booking could not be saved." }, { status: 409 });
  return NextResponse.json({ bookingId: booking.id, quote }, { status: 201 });
}
