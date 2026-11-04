"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { differenceInCalendarDays, eachDayOfInterval, isBefore, startOfToday } from "date-fns";
import { ArrowRight, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatINR, localDateKey } from "@/lib/format";

type Block = { checkin_date: string; checkout_date: string };
type Quote = { nights: number; guests: number; extra_guests: number; base_total_inr: number; extra_guest_total_inr: number; cleaning_fee_inr: number; subtotal_inr: number; tax_percent: number; taxes_inr: number; total_inr: number };

export function PropertyBookingPanel({ property }: { property: { id: string; slug: string; basePriceInr: number; cleaningFeeInr: number; maxGuests: number; includedGuests: number; extraGuestFeeInr: number; extraGuestFeeMode: "per_night" | "per_stay" } }) {
  const router = useRouter();
  const [range, setRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState(Math.min(2, property.maxGuests));
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteLoaded, setQuoteLoaded] = useState(false);
  const quoteSequence = useRef(0);
  const [availabilityReady, setAvailabilityReady] = useState(false);

  useEffect(() => {
    const client = getSupabaseBrowserClient();
    if (!client || !property.id.match(/^[0-9a-f-]{36}$/i)) return;
    let mounted = true;
    const refresh = async () => {
      const { data, error } = await client.from("public_availability").select("checkin_date,checkout_date").eq("property_id", property.id).gte("checkout_date", localDateKey(startOfToday())).limit(250);
      if (!mounted) return;
      if (!error && data) setBlocks(data as Block[]);
      setAvailabilityReady(true);
    };
    void refresh();
    const channel = client.channel(`availability:${property.id}`)
      .on("broadcast", { event: "availability_changed" }, () => void refresh())
      .subscribe();
    return () => { mounted = false; void client.removeChannel(channel); };
  }, [property.id]);

  const checkin = range?.from && range.to ? localDateKey(range.from) : "";
  const checkout = range?.from && range.to ? localDateKey(range.to) : "";
  useEffect(() => {
    if (!checkin || !checkout) { setQuote(null); setQuoteLoaded(false); return; }
    const sequence = ++quoteSequence.current;
    setQuoteLoaded(false);
    void fetch("/api/bookings/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: property.id, checkin, checkout, guests }) })
      .then(async (response) => ({ response, result: await response.json().catch(() => ({})) }))
      .then(({ response, result }) => { if (sequence === quoteSequence.current) { setQuote(response.ok ? result.quote as Quote : null); setQuoteLoaded(true); } });
  }, [property.id, checkin, checkout, guests]);
  const nights = quote?.nights ?? (range?.from && range.to ? differenceInCalendarDays(range.to, range.from) : 0);
  const blockedDays = useMemo(() => blocks.flatMap((block) => {
    const start = new Date(`${block.checkin_date}T12:00:00`);
    const finalNight = new Date(`${block.checkout_date}T12:00:00`);
    finalNight.setDate(finalNight.getDate() - 1);
    return isBefore(finalNight, start) ? [] : eachDayOfInterval({ start, end: finalNight });
  }), [blocks]);

  function startBooking() {
    if (!range?.from || !range.to) return;
    const search = new URLSearchParams({ checkin: localDateKey(range.from), checkout: localDateKey(range.to), guests: String(guests) });
    router.push(`/booking/new?property=${property.slug}&${search.toString()}`);
  }

  return (
    <aside className="border border-ink/15 bg-[#fbf8f1] p-5 shadow-[0_12px_36px_rgba(42,33,26,.08)] md:p-7">
      <div className="flex items-start justify-between gap-4 border-b border-ink/10 pb-5"><div><p className="eyebrow text-laterite">A night at this home</p><p className="mt-2 font-display text-3xl">{property.basePriceInr > 0 ? formatINR(property.basePriceInr) : "Pricing soon"} {property.basePriceInr > 0 && <span className="font-sans text-xs text-ink/45">/ night</span>}</p></div><CalendarDays className="mt-1 text-laterite" /></div>
      <div className="mt-5 flex items-center justify-between"><div><p className="eyebrow text-ink/55">Choose your dates</p><p className="mt-1 text-xs text-ink/50">Nights, not calendar days</p></div>{availabilityReady && <span className="text-[10px] text-lagoon">Live availability</span>}</div>
      <div className="mt-3 overflow-hidden"><DayPicker mode="range" selected={range} onSelect={setRange} numberOfMonths={2} disabled={[{ before: startOfToday() }, ...blockedDays]} showOutsideDays className="booking-calendar" modifiersClassNames={{ selected: "booking-selected", range_start: "booking-range-start", range_end: "booking-range-end", range_middle: "booking-range-middle", disabled: "booking-disabled" }} /></div>
      <label className="mt-4 flex items-center justify-between border-y border-ink/10 py-4"><span className="flex items-center gap-2 text-sm"><UsersRound size={16} className="text-laterite" /> Guests</span><select value={guests} onChange={(event) => setGuests(Number(event.target.value))} className="bg-transparent text-sm outline-none" aria-label="Number of guests">{Array.from({ length: property.maxGuests }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? "guest" : "guests"}</option>)}</select></label>
      {nights > 0 && <div className="grid gap-2 py-4 text-sm">{quote ? <><div className="flex justify-between"><span className="text-ink/60">Base ({property.includedGuests} guests included) · {nights} {nights === 1 ? "night" : "nights"}</span><span>{formatINR(quote.base_total_inr)}</span></div>{quote.extra_guests > 0 && <div className="flex justify-between gap-3"><span className="text-ink/60">Extra guests: {quote.extra_guests} × {formatINR(property.extraGuestFeeInr)}{property.extraGuestFeeMode === "per_night" ? ` × ${nights} ${nights === 1 ? "night" : "nights"}` : " × 1 stay"}</span><span>{formatINR(quote.extra_guest_total_inr)}</span></div>}<div className="flex justify-between"><span className="text-ink/60">Cleaning</span><span>{formatINR(quote.cleaning_fee_inr)}</span></div><div className="flex justify-between"><span className="text-ink/60">GST ({quote.tax_percent}%)</span><span>{formatINR(quote.taxes_inr)}</span></div><div className="mt-1 flex justify-between border-t border-ink/15 pt-3 font-semibold"><span>Total</span><span>{formatINR(quote.total_inr)}</span></div></> : <p className="text-xs text-ink/45">{quoteLoaded ? "The host is setting this stay’s price." : "Calculating price…"}</p>}</div>}
      <button onClick={startBooking} disabled={!range?.from || !range.to || !quote} className="button-ink mt-5 w-full disabled:cursor-not-allowed disabled:opacity-40">Continue to booking <ArrowRight size={16} /></button>
      <p className="mt-3 flex items-start gap-2 text-[11px] leading-5 text-ink/50"><Clock3 size={14} className="mt-0.5 shrink-0" /> Check-in 10 am–8 pm · check-out by 9 am. Custom times are always a conversation with your host.</p>
    </aside>
  );
}
