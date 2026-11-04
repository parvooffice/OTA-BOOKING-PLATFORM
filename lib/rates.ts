export type SeasonalRate = { range: string; nightly_rate_inr: number };

function rangeBounds(range: string) {
  const match = /^[[(](\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})[)\]]$/.exec(range);
  return match ? { start: match[1], end: match[2] } : null;
}

export function nightlyRateFor(date: string, baseRate: number, rates: SeasonalRate[]) {
  const active = rates.find((rate) => { const bounds = rangeBounds(rate.range); return Boolean(bounds && date >= bounds.start && date < bounds.end); });
  return active?.nightly_rate_inr ?? baseRate;
}

export function staySubtotal(checkin: string, checkout: string, baseRate: number, rates: SeasonalRate[]) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkin) || !/^\d{4}-\d{2}-\d{2}$/.test(checkout) || checkout <= checkin) return 0;
  let subtotal = 0;
  for (let date = new Date(`${checkin}T00:00:00Z`); date.toISOString().slice(0, 10) < checkout; date.setUTCDate(date.getUTCDate() + 1)) {
    subtotal += nightlyRateFor(date.toISOString().slice(0, 10), baseRate, rates);
  }
  return subtotal;
}
