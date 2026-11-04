import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { paymentAmountInPaise, verifyCheckoutSignature, verifyRazorpaySignature } from "@/lib/payments";

test("Razorpay checkout signatures verify only for the exact order and payment pair", () => {
  const secret = "test_secret";
  const payload = "order_123|pay_456";
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  assert.equal(verifyCheckoutSignature("order_123", "pay_456", signature, secret), true);
  assert.equal(verifyCheckoutSignature("order_other", "pay_456", signature, secret), false);
  assert.equal(verifyCheckoutSignature("order_123", "pay_456", "bad-signature", secret), false);
  assert.equal(verifyCheckoutSignature("order_123", "pay_456", signature, undefined), false);
});

test("webhook HMAC and INR to paise conversion are strict", () => {
  const raw = "{\"event\":\"payment.captured\"}";
  const signature = createHmac("sha256", "hook_secret").update(raw).digest("hex");
  assert.equal(verifyRazorpaySignature(raw, signature, "hook_secret"), true);
  assert.equal(verifyRazorpaySignature(`${raw} `, signature, "hook_secret"), false);
  assert.equal(paymentAmountInPaise(1250), 125000);
  assert.throws(() => paymentAmountInPaise(12.5), RangeError);
});
