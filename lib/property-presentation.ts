export function formatStartingPrice(basePriceInr: number): string {
  return basePriceInr > 0 ? `From ₹${basePriceInr.toLocaleString("en-IN")}` : "Rates soon";
}

export function formatIncludedGuests(includedGuests: number): string {
  return `${includedGuests} guests included`;
}
