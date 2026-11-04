import { loadEnvConfig } from "@next/env";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { properties } from "@/lib/properties";

async function main() {
  loadEnvConfig(process.cwd());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before seeding.");
  const supabase = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

  for (const property of properties) {
    const payload = {
      slug: property.slug, name: property.name, tagline: property.tagline, description: property.description,
      lat: property.coordinates[1], lng: property.coordinates[0], address: property.place, district: property.district,
      base_price_inr: property.basePriceInr, cleaning_fee_inr: property.cleaningFeeInr, max_guests: property.maxGuests,
      bedrooms: property.bedrooms, bathrooms: property.bathrooms, amenities: property.amenities,
      house_rules: property.houseRules, is_active: true
    };
    const { data: row, error: propertyError } = await supabase.from("properties").upsert(payload, { onConflict: "slug" }).select("id,slug").single();
    if (propertyError || !row) throw new Error(`Could not seed ${property.slug}: ${propertyError?.message ?? "missing property row"}`);

    const photoRows = [];
    for (let order = 0; order < 3; order++) {
      const sourcePath = order === 0 ? `public/properties/${property.slug}/hero.png` : `public/properties/${property.slug}/gallery/0${order}.png`;
      const thumbPath = `public/properties/${property.slug}/thumbs/0${order + 1}.png`;
      const source = await readFile(path.join(process.cwd(), sourcePath));
      const thumb = await readFile(path.join(process.cwd(), thumbPath));
      const displayPath = `${property.slug}/${order === 0 ? "hero.png" : `gallery/0${order}.png`}`;
      const storageThumbPath = `${property.slug}/thumbs/0${order + 1}.png`;
      const originalPath = `${property.slug}/originals/0${order + 1}.png`;
      for (const [objectPath, data] of [[displayPath, source], [storageThumbPath, thumb], [originalPath, source]] as const) {
        const { error } = await supabase.storage.from("property-images").upload(objectPath, data, { contentType: "image/png", upsert: true });
        if (error) throw new Error(`Could not upload ${objectPath}: ${error.message}`);
      }
      photoRows.push({ property_id: row.id, storage_path: displayPath, thumb_path: storageThumbPath, original_path: originalPath, alt: `${property.place} stay, photo ${order + 1}`, sort_order: order, is_cover: order === 0, edit_params: {} });
    }
    const { error: imageError } = await supabase.from("property_images").upsert(photoRows, { onConflict: "property_id,sort_order" });
    if (imageError) throw new Error(`Could not seed ${property.slug} photos: ${imageError.message}`);
    console.log(`Seeded ${property.name} · ${property.place}`);
  }
  console.log("Done. Replace the clearly labeled Property 1–4 copy and generated PNG illustrations before launch.");
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
