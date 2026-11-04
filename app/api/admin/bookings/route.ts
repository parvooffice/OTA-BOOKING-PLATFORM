import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const blockSchema = z.object({ action: z.literal("block"), propertyId: z.string().uuid(), startDate: z.string(), endDate: z.string(), reason: z.string().max(180).default("Unavailable") });
const offlineSchema = z.object({ action: z.literal("offline"), propertyId: z.string().uuid(), checkin: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), checkout: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), guests: z.number().int().min(1), email: z.string().email(), name: z.string().min(1).max(200), phone: z.string().max(32).optional(), expectedArrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).refine((time) => time >= "10:00" && time <= "20:00").default("15:00"), totalInr: z.number().int().min(0) });

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
  if (!parsed.success || parsed.data.checkout <= parsed.data.checkin) return NextResponse.json({ error: "Check the guest details and dates." }, { status: 400 });
  const input = parsed.data;
  let guestId: string | null = null;
  const { data: users } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  guestId = users?.users.find((user) => user.email?.toLowerCase() === input.email.toLowerCase())?.id ?? null;
  if (!guestId) {
    const { data: created, error } = await service.auth.admin.createUser({ email: input.email, email_confirm: true, user_metadata: { full_name: input.name, phone: input.phone ?? "" } });
    if (error || !created.user) return NextResponse.json({ error: "Guest profile could not be created." }, { status: 500 });
    guestId = created.user.id;
  }
  await service.from("profiles").upsert({ id: guestId, full_name: input.name, phone: input.phone ?? null });
  const nights = Math.round((new Date(`${input.checkout}T00:00:00Z`).getTime() - new Date(`${input.checkin}T00:00:00Z`).getTime()) / 86400000);
  const { data: property } = await service.from("properties").select("cleaning_fee_inr,max_guests").eq("id", input.propertyId).single();
  if (!property || input.guests > property.max_guests) return NextResponse.json({ error: "Guest count exceeds this property’s limit." }, { status: 400 });
  const { data: blocked } = await service.from("blocked_dates").select("id").eq("property_id", input.propertyId).overlaps("range", `[${input.checkin},${input.checkout})`).limit(1);
  if (blocked?.length) return NextResponse.json({ error: "Those dates are blocked for this property." }, { status: 409 });
  const cleaning = property.cleaning_fee_inr;
  const { data: taxSetting } = await service.from("admin_settings").select("value").eq("key", "gst_percent").maybeSingle();
  const taxPercent = Number(taxSetting?.value ?? 5);
  const tax = Math.round(Math.max(0, input.totalInr - cleaning) * taxPercent / (100 + taxPercent));
  const subtotal = Math.max(0, input.totalInr - cleaning - tax);
  const { data: booking, error } = await service.from("bookings").insert({ property_id: input.propertyId, guest_id: guestId, checkin_date: input.checkin, checkout_date: input.checkout, expected_arrival_time: input.expectedArrivalTime, guests: input.guests, status: "confirmed", subtotal_inr: subtotal, taxes_inr: tax, total_inr: input.totalInr, amount_paid_inr: 0, notes: `Offline booking · ${nights} nights` }).select("id").single();
  if (error) return NextResponse.json({ error: "Those dates are unavailable or the booking could not be saved." }, { status: 409 });
  return NextResponse.json({ bookingId: booking.id }, { status: 201 });
}
