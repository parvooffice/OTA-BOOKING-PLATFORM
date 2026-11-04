import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

type SeedProperty = {
  slug: string; name: string; lat: number; lng: number; district: string; address: string;
  tagline: string; description: string; base_price_inr: number; cleaning_fee_inr: number;
  max_guests: number; included_guests: number; extra_guest_fee_inr: number;
  extra_guest_fee_mode: "per_night" | "per_stay"; bedrooms: number; bathrooms: number;
  amenities: string[]; house_rules: string[]; checkin_start: string; checkin_end: string;
  checkout_latest: string; is_active: boolean;
};

const properties: SeedProperty[] = [
  {
    slug: "puri", name: "Puri", lat: 19.8135, lng: 85.8312, district: "Puri",
    address: "", tagline: "", description: "", base_price_inr: 0, cleaning_fee_inr: 0,
    max_guests: 2, included_guests: 2, extra_guest_fee_inr: 500, extra_guest_fee_mode: "per_night",
    bedrooms: 0, bathrooms: 0, amenities: [], house_rules: [],
    checkin_start: "10:00", checkin_end: "20:00", checkout_latest: "09:00", is_active: true
  },
  {
    // Initial village pin carried forward from the former second map location; edit it in /admin.
    slug: "village-retreat", name: "Village Retreat", lat: 19.7168, lng: 85.3205, district: "Odisha",
    address: "", tagline: "", description: "", base_price_inr: 0, cleaning_fee_inr: 0,
    max_guests: 2, included_guests: 2, extra_guest_fee_inr: 500, extra_guest_fee_mode: "per_night",
    bedrooms: 0, bathrooms: 0, amenities: [], house_rules: [],
    checkin_start: "10:00", checkin_end: "20:00", checkout_latest: "09:00", is_active: true
  }
];

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  for (const property of properties) {
    const { data: existing, error: lookupError } = await supabase.from("properties").select("id,slug,name").eq("slug", property.slug).maybeSingle();
    if (lookupError) throw new Error(`Could not look up ${property.slug}: ${lookupError.message}`);
    if (existing) { console.log(`Already exists: ${existing.name} (${existing.slug})`); continue; }
    const { data, error } = await supabase.from("properties").insert(property).select("id,slug,name").single();
    if (error || !data) throw new Error(`Could not seed ${property.slug}: ${error?.message ?? "missing property row"}`);
    console.log(`Created: ${data.name} (${data.slug})`);
  }
  console.log("Seeded only the two editable property rows. No users, bookings, messages or photos were created.");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
