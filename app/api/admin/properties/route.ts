import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const propertySchema = z.object({ id: z.string().uuid(), name: z.string().min(2).max(100), tagline: z.string().max(240), description: z.string().max(5000), district: z.string().min(2).max(100), address: z.string().max(400), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), base_price_inr: z.number().int().min(0), cleaning_fee_inr: z.number().int().min(0), max_guests: z.number().int().min(1).max(20), bedrooms: z.number().int().min(0).max(30), bathrooms: z.number().int().min(0).max(30), amenities: z.array(z.string().max(100)).max(40), house_rules: z.array(z.string().max(300)).max(40), checkin_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), checkin_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), checkout_latest: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), is_active: z.boolean() }).refine((property) => property.checkin_start < property.checkin_end, "Check-in opens before it closes.");
const rateSchema = z.object({ property_id: z.string().uuid(), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), nightly_rate_inr: z.number().int().min(0), label: z.string().max(100) });

export async function PUT(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const body = await request.json().catch(() => null);
  if (body?.seasonalRate) {
    const parsedRate = rateSchema.safeParse(body.seasonalRate);
    if (!parsedRate.success || parsedRate.data.end_date <= parsedRate.data.start_date) return NextResponse.json({ error: "Choose valid seasonal dates and rate." }, { status: 400 });
    const rate = parsedRate.data;
    const { error } = await service.from("seasonal_rates").insert({ property_id: rate.property_id, range: `[${rate.start_date},${rate.end_date})`, nightly_rate_inr: rate.nightly_rate_inr, label: rate.label });
    if (error) return NextResponse.json({ error: "Seasonal rate could not be saved. Remove overlapping rates first." }, { status: 409 });
    return NextResponse.json({ saved: true });
  }
  const parsed = propertySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the property details." }, { status: 400 });
  const { id, ...updates } = parsed.data;
  const { error } = await service.from("properties").update(updates).eq("id", id);
  if (error) return NextResponse.json({ error: "Property could not be saved." }, { status: 500 });
  return NextResponse.json({ saved: true });
}
