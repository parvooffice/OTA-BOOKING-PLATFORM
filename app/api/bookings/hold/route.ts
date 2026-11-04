import { NextResponse } from "next/server";
import { z } from "zod";
import { isIsoDate } from "@/lib/booking";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const schema = z.object({ propertyId: z.string().uuid(), checkin: z.string().refine(isIsoDate), checkout: z.string().refine(isIsoDate), guests: z.number().int().min(1).max(20), expectedArrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).default("15:00") });

export async function POST(request: Request) {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Booking is not configured yet." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to reserve your dates." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the dates, guest count and arrival time." }, { status: 400 });
  const { propertyId, checkin, checkout, guests, expectedArrivalTime } = parsed.data;
  if (checkout <= checkin) return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });
  const { data, error } = await supabase.rpc("create_booking_hold", {
    p_property_id: propertyId, p_checkin: checkin, p_checkout: checkout, p_guests: guests, p_expected_arrival: expectedArrivalTime
  });
  if (error) return NextResponse.json({ error: error.message.includes("unavailable") ? "Those dates were just taken. Please choose another set of nights." : error.message }, { status: 409 });
  return NextResponse.json({ booking: data }, { status: 201 });
}
