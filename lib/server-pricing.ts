import type { SupabaseClient } from "@supabase/supabase-js";
import { calculateStayQuote, type PricingProperty, type StayQuote } from "@/lib/pricing";
import type { SeasonalRate } from "@/lib/rates";

export async function getServerStayQuote(service: SupabaseClient, input: {
  propertyId: string;
  checkin: string;
  checkout: string;
  guests: number;
}): Promise<{ quote: StayQuote; property: PricingProperty & { id: string; slug: string; name: string } }> {
  const [{ data: property, error: propertyError }, { data: rates, error: rateError }, { data: taxSetting }] = await Promise.all([
    service.from("properties").select("id,slug,name,base_price_inr,cleaning_fee_inr,max_guests,included_guests,extra_guest_fee_inr,extra_guest_fee_mode,is_active").eq("id", input.propertyId).maybeSingle(),
    service.from("seasonal_rates").select("range,nightly_rate_inr").eq("property_id", input.propertyId),
    service.from("admin_settings").select("value").eq("key", "gst_percent").maybeSingle()
  ]);
  if (propertyError) throw new Error("Property pricing could not be loaded.");
  if (rateError) throw new Error("Seasonal rates could not be loaded.");
  if (!property || !property.is_active) throw new Error("This stay is not available for booking.");
  if (property.base_price_inr < 1) throw new Error("Set this stay’s base nightly price in the host desk before accepting bookings.");

  const pricingProperty = property as PricingProperty & { id: string; slug: string; name: string; is_active: boolean };
  const taxPercent = Number(taxSetting?.value ?? 5);
  const quote = calculateStayQuote({
    checkin: input.checkin,
    checkout: input.checkout,
    guests: input.guests,
    property: pricingProperty,
    seasonalRates: (rates ?? []) as SeasonalRate[],
    taxPercent
  });
  return { quote, property: pricingProperty };
}
