"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, LoaderCircle, ShieldCheck, UsersRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/format";

type PropertyInfo = { id: string; slug: string; name: string; max_guests: number; district: string; checkin_start: string; checkin_end: string; checkout_latest: string };
type Quote = { nights: number; guests: number; extra_guests: number; base_total_inr: number; extra_guest_total_inr: number; cleaning_fee_inr: number; taxes_inr: number; total_inr: number };

export function BookingStart() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("property") ?? "";
  const checkin = params.get("checkin") ?? "";
  const checkout = params.get("checkout") ?? "";
  const requestedGuests = Math.max(1, Number(params.get("guests") ?? "2"));
  const [guests, setGuests] = useState(requestedGuests);
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [arrival, setArrival] = useState("15:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    if (!supabase || !slug) return;
    let active = true;
    void Promise.all([
      supabase.from("properties").select("id,slug,name,max_guests,district,checkin_start,checkin_end,checkout_latest").eq("slug", slug).eq("is_active", true).maybeSingle(),
      supabase.auth.getUser()
    ]).then(([propertyResult, authResult]) => {
      if (!active) return;
      if (propertyResult.data) {
        setProperty(propertyResult.data as PropertyInfo);
        setGuests(Math.min(requestedGuests, propertyResult.data.max_guests));
      }
      setUserId(authResult.data.user?.id ?? null);
    });
    return () => { active = false; };
  }, [requestedGuests, slug, supabase]);

  useEffect(() => {
    if (!property || !checkin || !checkout) return;
    let active = true;
    void fetch("/api/bookings/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: property.id, checkin, checkout, guests }) })
      .then(async (response) => ({ response, result: await response.json().catch(() => ({})) }))
      .then(({ response, result }) => { if (active) setQuote(response.ok ? result.quote as Quote : null); });
    return () => { active = false; };
  }, [property, checkin, checkout, guests]);

  const signInUrl = `/account?next=${encodeURIComponent(`/booking/new?${params.toString()}`)}`;
  const nights = quote?.nights ?? 0;

  async function holdDates() {
    if (!userId || !property) return;
    setBusy(true); setError("");
    const response = await fetch("/api/bookings/hold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: property.id, checkin, checkout, guests, expectedArrivalTime: arrival }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error ?? "We could not hold those dates."); setBusy(false); return; }
    router.push(`/booking/${body.booking.id}`);
  }

  if (!supabase) return <section className="mx-auto max-w-3xl border border-ink/15 bg-[#fbf8f1] p-8"><p className="eyebrow text-laterite">Booking setup</p><h1 className="mt-3 font-display text-4xl">Booking service unavailable.</h1><p className="mt-3 text-sm text-ink/60">Connect this app to its Supabase project to continue.</p></section>;
  if (!property) return <p className="mx-auto max-w-3xl text-sm text-ink/55">Loading this stay…</p>;

  return <div className="mx-auto max-w-4xl"><Link href={`/properties/${slug}`} className="inline-flex items-center gap-2 text-xs text-ink/55 hover:text-laterite"><ArrowLeft size={14} /> Back to {property.name}</Link><div className="mt-8 grid gap-8 md:grid-cols-[1fr_330px] md:items-start"><section><p className="eyebrow text-laterite">Before we put the kettle on</p><h1 className="mt-3 font-display text-5xl md:text-6xl">Let’s make this stay yours.</h1><p className="mt-4 max-w-lg text-sm leading-6 text-ink/65">Your dates are held for ten minutes once you continue to checkout. Payment confirms your booking.</p><div className="mt-8 border-y border-ink/15 py-6"><p className="eyebrow text-ink/50">Your arrival</p><label className="mt-3 flex max-w-sm items-center justify-between gap-5 border border-ink/15 bg-[#fbf8f1] px-4 py-3"><span className="flex items-center gap-2 text-sm"><Clock3 size={15} className="text-laterite" /> Expected check-in</span><select value={arrival} onChange={(event) => setArrival(event.target.value)} className="bg-transparent text-sm outline-none" aria-label="Expected check-in time">{timeOptions(property.checkin_start, property.checkin_end).map((time) => <option value={time} key={time}>{timeLabel(time)}</option>)}</select></label><p className="mt-3 text-xs text-ink/50">Check-in is {timeLabel(property.checkin_start)}–{timeLabel(property.checkin_end)}. Check-out is by {timeLabel(property.checkout_latest)}.</p></div><div className="mt-6 flex items-start gap-3 text-xs leading-5 text-ink/55"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-lagoon" />Your stay is held in the booking system. The host sees the details needed to get ready for you.</div></section><aside className="border border-ink/15 bg-[#fbf8f1] p-5"><p className="eyebrow text-laterite">Your dates</p><h2 className="mt-2 font-display text-3xl">{property.name}</h2><p className="mt-2 text-sm text-ink/60">{checkin} → {checkout}</p><label className="mt-2 flex items-center gap-2 text-xs text-ink/50"><UsersRound size={13} /><span>Guests</span><select value={guests} onChange={(event) => setGuests(Number(event.target.value))} className="ml-auto bg-transparent text-right text-sm outline-none">{Array.from({ length: property.max_guests }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><div className="mt-5 grid gap-2 border-t border-ink/10 pt-4 text-sm">{quote ? <><div className="flex justify-between"><span className="text-ink/60">Base stay · {nights} nights</span><span>{formatINR(quote.base_total_inr)}</span></div>{quote.extra_guests > 0 && <div className="flex justify-between"><span className="text-ink/60">Extra guests</span><span>{formatINR(quote.extra_guest_total_inr)}</span></div>}<div className="flex justify-between"><span className="text-ink/60">Cleaning</span><span>{formatINR(quote.cleaning_fee_inr)}</span></div><div className="flex justify-between"><span className="text-ink/60">GST</span><span>{formatINR(quote.taxes_inr)}</span></div><div className="mt-1 flex justify-between border-t border-ink/10 pt-3 font-semibold"><span>Total</span><span>{formatINR(quote.total_inr)}</span></div></> : <p className="text-xs text-ink/45">Loading server price…</p>}</div>{userId ? <button onClick={holdDates} disabled={busy || !quote} className="button-ink mt-5 w-full disabled:opacity-45">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <>Hold these dates <ArrowRight size={15} /></>}</button> : <Link className="button-ink mt-5 w-full" href={signInUrl}>Sign in to continue <ArrowRight size={15} /></Link>}{error && <p role="alert" className="mt-3 text-xs text-laterite">{error}</p>}</aside></div></div>;
}

function timeLabel(time: string) {
  const hour = Number(time.slice(0, 2));
  return `${hour % 12 || 12}:${time.slice(3)} ${hour >= 12 ? "pm" : "am"}`;
}

function timeOptions(start: string, end: string) {
  const startMinutes = Number(start.slice(0, 2)) * 60 + Number(start.slice(3, 5));
  const endMinutes = Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5));
  return Array.from({ length: Math.max(1, Math.floor((endMinutes - startMinutes) / 30) + 1) }, (_, index) => {
    const minutes = startMinutes + index * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
  });
}
