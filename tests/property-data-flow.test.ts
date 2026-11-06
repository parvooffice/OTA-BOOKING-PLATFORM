import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";
import { formatIncludedGuests, formatStartingPrice } from "../lib/property-presentation";

test("a saved price is displayed instead of Rates soon", () => {
  assert.equal(formatStartingPrice(4500), "From ₹4,500");
  assert.notEqual(formatStartingPrice(4500), "Rates soon");
});

test("zero pricing remains visibly unconfigured", () => {
  assert.equal(formatStartingPrice(0), "Rates soon");
  assert.equal(formatIncludedGuests(2), "2 guests included");
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const testPropertyId = process.env.SUPABASE_TEST_PROPERTY_ID;

test("anon can read pricing but cannot write it", { skip: !(supabaseUrl && anonKey && testPropertyId) }, async () => {
  const anon = createClient(supabaseUrl!, anonKey!, { auth: { persistSession: false } });
  const read = await anon.from("properties").select("base_price_inr,cleaning_fee_inr,included_guests,extra_guest_fee_inr,extra_guest_fee_mode,max_guests").eq("id", testPropertyId!).single();
  assert.ifError(read.error);
  assert.ok(read.data);
  const write = await anon.from("properties").update({ base_price_inr: read.data!.base_price_inr }).eq("id", testPropertyId!).select("id");
  assert.ok(write.error || !write.data?.length, "anon must not update properties");
});
