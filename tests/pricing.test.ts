import assert from "node:assert/strict";
import test from "node:test";
import { calculateStayQuote } from "../lib/pricing";

const property = {
  base_price_inr: 10_000,
  cleaning_fee_inr: 1_000,
  max_guests: 6,
  included_guests: 2,
  extra_guest_fee_inr: 500,
  extra_guest_fee_mode: "per_night" as const
};
const stay = { checkin: "2027-01-01", checkout: "2027-01-04", taxPercent: 5 };

test("included guests pay no extra guest fee", () => {
  const quote = calculateStayQuote({ ...stay, guests: 2, property });
  assert.equal(quote.extra_guests, 0);
  assert.equal(quote.extra_guest_total_inr, 0);
  assert.equal(quote.subtotal_inr, 31_000);
  assert.equal(quote.total_inr, 32_550);
});

test("the third guest adds ₹500 per night", () => {
  const quote = calculateStayQuote({ ...stay, guests: 3, property });
  assert.equal(quote.extra_guests, 1);
  assert.equal(quote.extra_guest_total_inr, 1_500);
  assert.equal(quote.subtotal_inr, 32_500);
  assert.equal(quote.total_inr, 34_125);
});

test("the maximum guest count is priced and any guest above it is rejected", () => {
  const quote = calculateStayQuote({ ...stay, guests: 6, property });
  assert.equal(quote.extra_guests, 4);
  assert.equal(quote.extra_guest_total_inr, 6_000);
  assert.throws(() => calculateStayQuote({ ...stay, guests: 7, property }), /capacity/);
});

test("per-stay fees charge once while per-night fees charge for each night", () => {
  const guests = { ...stay, guests: 3 };
  const perNight = calculateStayQuote({ ...guests, property });
  const perStay = calculateStayQuote({ ...guests, property: { ...property, extra_guest_fee_mode: "per_stay" } });
  assert.equal(perNight.extra_guest_total_inr, 1_500);
  assert.equal(perStay.extra_guest_total_inr, 500);
});
