import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { RetreatProperty } from "@/lib/properties";

type DbProperty = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  lat: number;
  lng: number;
  district: string;
  base_price_inr: number;
  cleaning_fee_inr: number;
  max_guests: number;
  included_guests: number;
  extra_guest_fee_inr: number;
  extra_guest_fee_mode: "per_night" | "per_stay";
  checkin_start: string;
  checkin_end: string;
  checkout_latest: string;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  house_rules: string[];
};

type DbImage = { id: string; property_id: string; storage_path: string; sort_order: number; is_cover: boolean };

export async function getProperties(): Promise<RetreatProperty[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const [{ data: rows, error }, { data: images, error: imageError }] = await Promise.all([
    supabase.from("properties").select("id,slug,name,tagline,description,lat,lng,district,base_price_inr,cleaning_fee_inr,max_guests,included_guests,extra_guest_fee_inr,extra_guest_fee_mode,checkin_start,checkin_end,checkout_latest,bedrooms,bathrooms,amenities,house_rules").eq("is_active", true).order("created_at"),
    supabase.from("property_images").select("id,property_id,storage_path,sort_order,is_cover").order("sort_order")
  ]);
  if (error) throw new Error(`Properties could not be loaded: ${error.message}`);
  if (imageError) throw new Error(`Property photos could not be loaded: ${imageError.message}`);

  const imageRows = (images ?? []) as DbImage[];
  const urls = new Map(imageRows.map((image) => [image.id, supabase.storage.from("property-images").getPublicUrl(image.storage_path).data.publicUrl]));
  return ((rows ?? []) as DbProperty[]).map((row) => {
    const photos = imageRows.filter((image) => image.property_id === row.id)
      .sort((left, right) => Number(right.is_cover) - Number(left.is_cover) || left.sort_order - right.sort_order)
      .map((image) => urls.get(image.id)).filter((url): url is string => Boolean(url));
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      place: row.name,
      district: row.district,
      coordinates: [row.lng, row.lat],
      tagline: row.tagline,
      description: row.description,
      hero: photos[0] ?? null,
      images: photos,
      basePriceInr: row.base_price_inr,
      cleaningFeeInr: row.cleaning_fee_inr,
      maxGuests: row.max_guests,
      includedGuests: row.included_guests,
      extraGuestFeeInr: row.extra_guest_fee_inr,
      extraGuestFeeMode: row.extra_guest_fee_mode,
      checkinStart: row.checkin_start,
      checkinEnd: row.checkin_end,
      checkoutLatest: row.checkout_latest,
      bedrooms: row.bedrooms,
      bathrooms: row.bathrooms,
      amenities: row.amenities ?? [],
      houseRules: row.house_rules ?? [],
      caption: "",
      accent: "#a64d37"
    };
  });
}

export async function getProperty(slug: string) {
  const list = await getProperties();
  return list.find((property) => property.slug === slug);
}

export const getPropertyData = getProperty;
