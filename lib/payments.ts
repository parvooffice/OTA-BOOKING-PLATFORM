import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyRazorpaySignature(payload: string, signature: string | null | undefined, secret: string | undefined) {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(payload).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "hex"); } catch { return false; }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function verifyCheckoutSignature(orderId: string, paymentId: string, signature: string | null | undefined, secret: string | undefined) {
  return verifyRazorpaySignature(`${orderId}|${paymentId}`, signature, secret);
}

export function paymentAmountInPaise(amountInr: number) {
  if (!Number.isSafeInteger(amountInr) || amountInr < 0) throw new RangeError("Amount must be a non-negative whole rupee value.");
  return amountInr * 100;
}
