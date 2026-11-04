export type ExtraGuestFeeMode = "per_night" | "per_stay";

export type RetreatProperty = {
  id: string;
  slug: string;
  name: string;
  place: string;
  district: string;
  coordinates: [number, number];
  tagline: string;
  description: string;
  hero: string | null;
  images: string[];
  basePriceInr: number;
  cleaningFeeInr: number;
  maxGuests: number;
  includedGuests: number;
  extraGuestFeeInr: number;
  extraGuestFeeMode: ExtraGuestFeeMode;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  houseRules: string[];
  caption: string;
  accent: string;
};
