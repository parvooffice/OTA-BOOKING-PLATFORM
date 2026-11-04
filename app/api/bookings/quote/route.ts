import { NextResponse } from "next/server";
import { z } from "zod";
import { isIsoDate } from "@/lib/booking";
import { getSupabaseServiceClient } from "@/lib/supabase/server";
import { getServerStayQuote } from "@/lib/server-pricing";

const schema = z.object({
  propertyId: z.string().uuid(),
  checkin: z.string().refine(isIsoDate),
  checkout: z.string().refine(isIsoDate),
  guests: z.number().int().min(1).max(20)
});

export async function POST(request: Request) {
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Booking is not configured yet." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || parsed.data.checkout <= parsed.data.checkin) return NextResponse.json({ error: "Choose valid dates and a guest count." }, { status: 400 });
  try {
    const { quote, property } = await getServerStayQuote(service, parsed.data);
    return NextResponse.json({ quote, property: { max_guests: property.max_guests, included_guests: property.included_guests, extra_guest_fee_inr: property.extra_guest_fee_inr, extra_guest_fee_mode: property.extra_guest_fee_mode } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Price could not be calculated." }, { status: 422 });
  }
}
