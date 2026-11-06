import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const propertySchema = z.object({ id: z.string().uuid(), name: z.string().min(2).max(100), tagline: z.string().max(240), description: z.string().max(5000), district: z.string().min(2).max(100), address: z.string().max(400), lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180), base_price_inr: z.number().int().min(0), cleaning_fee_inr: z.number().int().min(0), max_guests: z.number().int().min(1).max(20), included_guests: z.number().int().min(1).max(20), extra_guest_fee_inr: z.number().int().min(0), extra_guest_fee_mode: z.enum(["per_night", "per_stay"]), bedrooms: z.number().int().min(0).max(30), bathrooms: z.number().int().min(0).max(30), amenities: z.array(z.string().max(100)).max(40), house_rules: z.array(z.string().max(300)).max(40), checkin_start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), checkin_end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), checkout_latest: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), is_active: z.boolean() }).refine((property) => property.checkin_start < property.checkin_end, "Check-in opens before it closes.").refine((property) => property.included_guests <= property.max_guests, "Complimentary guest count cannot exceed the guest limit.");
const rateSchema = z.object({ property_id: z.string().uuid(), start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), nightly_rate_inr: z.number().int().min(0), label: z.string().max(100) });
const propertySelect = "id,slug,name,tagline,description,address,district,base_price_inr,cleaning_fee_inr,max_guests,included_guests,extra_guest_fee_inr,extra_guest_fee_mode,checkin_start,checkin_end,checkout_latest,is_active";

export async function GET(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Choose a property." }, { status: 400 });
  const { data, error } = await service.from("properties").select(propertySelect).eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: `Property could not be reloaded: ${error.message}` }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Property was not found after saving." }, { status: 404 });
  return NextResponse.json({ property: data });
}

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
  const { data: updated, error } = await service.from("properties").update(updates).eq("id", id).select(propertySelect).maybeSingle();
  if (error) return NextResponse.json({ error: `Property could not be saved: ${error.message}` }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "Property save matched no rows. Check the property id and admin permissions." }, { status: 409 });
  revalidatePath("/", "page");
  revalidatePath(`/properties/${updated.slug}`, "page");
  return NextResponse.json({ saved: true, property: updated });
}
