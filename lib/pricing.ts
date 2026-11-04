import { staySubtotal, type SeasonalRate } from "@/lib/rates";

export type PricingProperty = {
  base_price_inr: number;
  cleaning_fee_inr: number;
  max_guests: number;
  included_guests: number;
  extra_guest_fee_inr: number;
  extra_guest_fee_mode: "per_night" | "per_stay";
};

export type StayQuote = {
  nights: number;
  guests: number;
  extra_guests: number;
  base_total_inr: number;
  extra_guest_total_inr: number;
  cleaning_fee_inr: number;
  subtotal_inr: number;
  tax_percent: number;
  taxes_inr: number;
  total_inr: number;
};

export function calculateStayQuote(input: {
  checkin: string;
  checkout: string;
  guests: number;
  property: PricingProperty;
  seasonalRates?: SeasonalRate[];
  taxPercent: number;
}): StayQuote {
  const nights = Math.round((Date.parse(`${input.checkout}T00:00:00Z`) - Date.parse(`${input.checkin}T00:00:00Z`)) / 86_400_000);
  if (!Number.isInteger(nights) || nights < 1) throw new Error("Check-out must be after check-in.");
  if (!Number.isInteger(input.guests) || input.guests < 1 || input.guests > input.property.max_guests) throw new Error("Guest count exceeds this property capacity.");
  if (!Number.isInteger(input.property.included_guests) || input.property.included_guests < 0 || input.property.included_guests > input.property.max_guests) throw new Error("Included guest count is invalid.");
  if (!Number.isInteger(input.property.extra_guest_fee_inr) || input.property.extra_guest_fee_inr < 0) throw new Error("Extra guest fee is invalid.");
  if (!Number.isFinite(input.taxPercent) || input.taxPercent < 0 || input.taxPercent > 100) throw new Error("Tax percent is invalid.");

  const baseTotal = staySubtotal(input.checkin, input.checkout, input.property.base_price_inr, input.seasonalRates ?? []);
  const extraGuests = Math.max(0, input.guests - input.property.included_guests);
  const feeUnits = input.property.extra_guest_fee_mode === "per_night" ? nights : 1;
  const extraGuestTotal = extraGuests * input.property.extra_guest_fee_inr * feeUnits;
  const cleaningFee = input.property.cleaning_fee_inr;
  const subtotal = baseTotal + extraGuestTotal + cleaningFee;
  const taxPercent = input.taxPercent;
  const taxes = Math.round(subtotal * taxPercent / 100);

  return {
    nights,
    guests: input.guests,
    extra_guests: extraGuests,
    base_total_inr: baseTotal,
    extra_guest_total_inr: extraGuestTotal,
    cleaning_fee_inr: cleaningFee,
    subtotal_inr: subtotal,
    tax_percent: taxPercent,
    taxes_inr: taxes,
    total_inr: subtotal + taxes
  };
}
