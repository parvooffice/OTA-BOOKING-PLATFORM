export type RetreatProperty = {
  id: string;
  slug: string;
  name: string;
  place: string;
  district: string;
  coordinates: [number, number];
  tagline: string;
  description: string;
  hero: string;
  images: string[];
  basePriceInr: number;
  cleaningFeeInr: number;
  maxGuests: number;
  bedrooms: number;
  bathrooms: number;
  amenities: string[];
  houseRules: string[];
  caption: string;
  accent: string;
};

// The four entries are clearly marked starter records; replace copy and PNGs before launch.
export const properties: RetreatProperty[] = [
  {
    id: "property-1", slug: "puri", name: "Property 1", place: "Puri", district: "Puri",
    coordinates: [85.8312, 19.8135], tagline: "A slower morning by the Bay of Bengal.",
    description: "A privately hosted coastal home for salty hair, long lunches and the sound of the tide finding its way back. Come early; chai is on us.",
    hero: "/properties/puri/hero.png", images: ["/properties/puri/hero.png", "/properties/puri/gallery/01.png", "/properties/puri/gallery/02.png"],
    basePriceInr: 7200, cleaningFeeInr: 900, maxGuests: 4, bedrooms: 2, bathrooms: 2,
    amenities: ["Sea-facing verandah", "Breakfast on request", "Locally guided walks", "Air conditioning", "Wi-Fi"],
    houseRules: ["No smoking indoors", "Quiet hours after 10 pm", "Please leave shells where the sea put them"],
    caption: "The coast, just before the day begins.", accent: "#a64d37"
  },
  {
    id: "property-2", slug: "chilika", name: "Property 2", place: "Chilika Lagoon", district: "Puri",
    coordinates: [85.3205, 19.7168], tagline: "Wake with the birds, linger by the water.",
    description: "A small, easygoing base beside India's great brackish lagoon. The mornings belong to the birds; the afternoon is yours to spend as you like.",
    hero: "/properties/chilika/hero.png", images: ["/properties/chilika/hero.png", "/properties/chilika/gallery/01.png", "/properties/chilika/gallery/02.png"],
    basePriceInr: 6400, cleaningFeeInr: 800, maxGuests: 4, bedrooms: 2, bathrooms: 1,
    amenities: ["Lagoon-side deck", "Birding guide on request", "Home-cooked breakfast", "Wi-Fi", "Parking"],
    houseRules: ["Keep the jetty quiet at dawn", "No single-use plastic by the water", "Pets by prior arrangement"],
    caption: "A little blue between land and sky.", accent: "#4d817b"
  },
  {
    id: "property-3", slug: "gopalpur", name: "Property 3", place: "Gopalpur", district: "Ganjam",
    coordinates: [84.8851, 19.2583], tagline: "A quiet corner of the southern coast.",
    description: "A warm coastal hideaway near the old port. Bare feet, a book you have been meaning to finish, and nowhere you need to be.",
    hero: "/properties/gopalpur/hero.png", images: ["/properties/gopalpur/hero.png", "/properties/gopalpur/gallery/01.png", "/properties/gopalpur/gallery/02.png"],
    basePriceInr: 5800, cleaningFeeInr: 750, maxGuests: 3, bedrooms: 2, bathrooms: 1,
    amenities: ["Garden courtyard", "Beach bicycles", "Home-cooked meals", "Air conditioning", "Parking"],
    houseRules: ["Shoes off inside, if you like", "No parties", "Let us know about late arrivals"],
    caption: "The old port, in a softer light.", accent: "#d4a23d"
  },
  {
    id: "property-4", slug: "similipal", name: "Property 4", place: "Similipal", district: "Mayurbhanj",
    coordinates: [86.3401, 21.9287], tagline: "Forest air and a fire after the rain.",
    description: "An unhurried base on the forest's edge. Start early with a local guide, come home to a hot pot of dalma, and let the evening arrive on its own.",
    hero: "/properties/similipal/hero.png", images: ["/properties/similipal/hero.png", "/properties/similipal/gallery/01.png", "/properties/similipal/gallery/02.png"],
    basePriceInr: 6900, cleaningFeeInr: 850, maxGuests: 4, bedrooms: 2, bathrooms: 2,
    amenities: ["Forest-side sit-out", "Local nature guide", "Home-cooked meals", "Hot water", "Parking"],
    houseRules: ["Follow forest entry rules", "No loud music outdoors", "Wildlife stays wild: keep a distance"],
    caption: "The forest keeps its own hours.", accent: "#6f7952"
  }
];

export function getProperty(slug: string) {
  return properties.find((property) => property.slug === slug);
}
