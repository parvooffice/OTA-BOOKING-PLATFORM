import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("check:data requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.");

  const service = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: properties, error } = await service.from("properties").select("id,slug,name,base_price_inr,max_guests,included_guests,checkin_start,checkin_end,checkout_latest,is_active").in("slug", ["puri", "village-retreat"]).order("slug");
  if (error) throw new Error(`Could not read properties: ${error.message}`);

  const failures: string[] = [];
  for (const property of properties ?? []) {
    const { data: cover, error: coverError } = await service.from("property_images").select("id").eq("property_id", property.id).eq("is_cover", true).maybeSingle();
    const missing: string[] = [];
    if (!property.name?.trim()) missing.push("name");
    if (!property.is_active) missing.push("is_active");
    if (!Number.isInteger(property.base_price_inr) || property.base_price_inr <= 0) missing.push("base_price_inr");
    if (!Number.isInteger(property.max_guests) || property.max_guests < 1) missing.push("max_guests");
    if (!Number.isInteger(property.included_guests) || property.included_guests < 1 || property.included_guests > property.max_guests) missing.push("included_guests");
    if (property.checkin_start !== "10:00:00" && property.checkin_start !== "10:00") missing.push("checkin_start");
    if (property.checkin_end !== "20:00:00" && property.checkin_end !== "20:00") missing.push("checkin_end");
    if (property.checkout_latest !== "09:00:00" && property.checkout_latest !== "09:00") missing.push("checkout_latest");
    if (coverError || !cover) missing.push("cover image");
    if (missing.length) failures.push(`${property.slug}: ${missing.join(", ")}`);
    else console.log(`${property.slug}: ready`);
  }
  for (const slug of ["puri", "village-retreat"]) if (!(properties ?? []).some((property) => property.slug === slug)) failures.push(`${slug}: property row missing`);
  if (failures.length) throw new Error("Missing required host data:\n" + failures.map((item) => `- ${item}`).join("\n"));
  console.log("All required host data is present.");
}

void main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
