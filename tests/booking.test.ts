import test from "node:test";
import assert from "node:assert/strict";
import { isIsoDate, staysOverlap } from "@/lib/booking";

test("booking overlap uses half-open nights so checkout can equal next check-in", () => {
  assert.equal(staysOverlap({ checkin: "2026-11-04", checkout: "2026-11-07" }, { checkin: "2026-11-07", checkout: "2026-11-09" }), false);
  assert.equal(staysOverlap({ checkin: "2026-11-04", checkout: "2026-11-07" }, { checkin: "2026-11-06", checkout: "2026-11-09" }), true);
  assert.equal(staysOverlap({ checkin: "2026-11-04", checkout: "2026-11-08" }, { checkin: "2026-11-05", checkout: "2026-11-06" }), true);
});

test("ISO date validation rejects impossible dates and non-date input", () => {
  assert.equal(isIsoDate("2026-02-28"), true);
  assert.equal(isIsoDate("2026-02-30"), false);
  assert.equal(isIsoDate("28/02/2026"), false);
});
