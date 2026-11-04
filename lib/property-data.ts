import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";
import { getProperty, properties, type RetreatProperty } from "@/lib/properties";

type DbProperty = {
  id: string; slug: string; name: string; tagline: string; description: string; lat: number; lng: number;
  district: string; base_price_inr: number; cleaning_fee_inr: number; max_guests: number; bedrooms: number;
  bathrooms: number; amenities: string[]; house_rules: string[];
};
type DbImage = { id: string; property_id: string; storage_path: string; thumb_path: string; alt: string; sort_order: number; is_cover: boolean };

function fromRows(row: DbProperty, images: DbImage[], urls: Map<string, string>): RetreatProperty {
  const fallback = getProperty(row.slug);
  const photos = images.filter((image) => image.property_id === row.id).sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || a.sort_order - b.sort_order).map((image) => urls.get(image.id)).filter((url): url is string => Boolean(url));
  return {
    id: row.id, slug: row.slug, name: row.name, place: fallback?.place ?? row.name, district: row.district,
    coordinates: [row.lng, row.lat], tagline: row.tagline, description: row.description,
    hero: photos[0] ?? fallback?.hero ?? "/brand/mark.svg", images: photos.length ? photos : fallback?.images ?? [],
    basePriceInr: row.base_price_inr, cleaningFeeInr: row.cleaning_fee_inr, maxGuests: row.max_guests,
    bedrooms: row.bedrooms, bathrooms: row.bathrooms, amenities: row.amenities ?? [], houseRules: row.house_rules ?? [],
    caption: fallback?.caption ?? "A field note from Odisha.", accent: fallback?.accent ?? "#a64d37"
  };
}

export async function getProperties() {
  if (process.env.NODE_ENV === "development") return properties;
  const supabase = await getSupabaseServerClient();
  if (!supabase) return properties;
  const service = getSupabaseServiceClient();
  const [{ data: rows, error }, { data: images }] = await Promise.all([
    supabase.from("properties").select("id,slug,name,tagline,description,lat,lng,district,base_price_inr,cleaning_fee_inr,max_guests,bedrooms,bathrooms,amenities,house_rules").eq("is_active", true).order("created_at"),
    supabase.from("property_images").select("id,property_id,storage_path,thumb_path,alt,sort_order,is_cover").order("sort_order")
  ]);
  if (error || !rows?.length) return properties;
  const imageRows = (images ?? []) as DbImage[];
  const urls = new Map<string, string>();
  if (service) {
    const signed = await Promise.all(imageRows.map((image) => service.storage.from("property-images").createSignedUrl(image.storage_path, 60 * 60 * 24 * 6)));
    signed.forEach(({ data }, index) => { if (data?.signedUrl) urls.set(imageRows[index].id, data.signedUrl); });
  }
  return (rows as DbProperty[]).map((row) => fromRows(row, imageRows, urls));
}

export async function getPropertyData(slug: string) {
  const list = await getProperties();
  return list.find((property) => property.slug === slug) ?? getProperty(slug);
}
