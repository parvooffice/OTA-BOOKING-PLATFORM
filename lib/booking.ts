export type Stay = { checkin: string; checkout: string };

/** Stays are half-open: the departure date can be another guest's arrival date. */
export function staysOverlap(left: Stay, right: Stay) {
  return left.checkin < right.checkout && right.checkin < left.checkout;
}

export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}
