export const guestIdNamePattern = /^[\p{L}. ]{2,60}$/u;
export const indianMobilePattern = /^[6-9]\d{9}$/;

export function normalizeGuestIdName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isValidGuestIdName(value: string) {
  const name = normalizeGuestIdName(value);
  return name.length >= 2 && name.length <= 60 && guestIdNamePattern.test(name);
}

export function isValidIndianMobile(value: string) {
  return indianMobilePattern.test(value);
}

export function toE164IndianMobile(value: string) {
  return `+91${value}`;
}
