"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Clock3, LoaderCircle, ShieldCheck, UsersRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getProperty } from "@/lib/properties";
import { formatINR } from "@/lib/format";
import { staySubtotal, type SeasonalRate } from "@/lib/rates";
import { UI_PREVIEW_MODE } from "@/lib/ui-preview";

type PropertyInfo = { id: string; slug: string; name: string; base_price_inr: number; cleaning_fee_inr: number; max_guests: number; district: string };

export function BookingStart() {
  return UI_PREVIEW_MODE ? <BookingStartPreview /> : <LiveBookingStart />;
}

function BookingStartPreview() {
  const params = useSearchParams();
  const router = useRouter();
  const property = getProperty(params.get("property") ?? "puri") ?? getProperty("puri")!;
  const [checkin, setCheckin] = useState(params.get("checkin") ?? "2026-12-12");
  const [checkout, setCheckout] = useState(params.get("checkout") ?? "2026-12-15");
  const [guests, setGuests] = useState(Math.max(1, Number(params.get("guests") ?? "2")));
  const [arrival, setArrival] = useState("15:00");
  const nights = Math.max(1, Math.round((new Date(`${checkout}T00:00:00`).getTime() - new Date(`${checkin}T00:00:00`).getTime()) / 86400000) || 1);
  const subtotal = nights * property.basePriceInr;
  const beforeTax = subtotal + property.cleaningFeeInr;
  const total = beforeTax + Math.round(beforeTax * 0.05);

  function openCheckout() {
    localStorage.setItem("odisha-retreat-ui-preview-booking", JSON.stringify({ slug: property.slug, checkin, checkout, guests, arrival, total }));
    router.push("/booking/ui-preview");
  }

  return <div className="mx-auto max-w-4xl">
    <div className="mb-6 border border-lagoon/20 bg-[#e7efeb] px-4 py-3 text-xs text-lagoon">UI preview · dates and checkout stay in this browser; no reservation is created.</div>
    <Link href={`/properties/${property.slug}`} className="inline-flex items-center gap-2 text-xs text-ink/55 hover:text-laterite"><ArrowLeft size={14} /> Back to {property.place}</Link>
    <div className="mt-8 grid gap-8 md:grid-cols-[1fr_330px] md:items-start">
      <section><p className="eyebrow text-laterite">Before we put the kettle on</p><h1 className="mt-3 font-display text-5xl md:text-6xl">Let’s make this stay yours.</h1><p className="mt-4 max-w-lg text-sm leading-6 text-ink/65">Explore the booking screens with sample information. Nothing will be sent or charged.</p>
        <div className="mt-8 grid gap-4 border-y border-ink/15 py-6 sm:grid-cols-2"><label className="grid gap-2 text-xs font-semibold">Check-in<input type="date" value={checkin} onChange={(event) => setCheckin(event.target.value)} className="h-11 border border-ink/20 bg-[#fbf8f1] px-3 text-sm font-normal" /></label><label className="grid gap-2 text-xs font-semibold">Check-out<input type="date" value={checkout} onChange={(event) => setCheckout(event.target.value)} className="h-11 border border-ink/20 bg-[#fbf8f1] px-3 text-sm font-normal" /></label><label className="grid gap-2 text-xs font-semibold">Guests<select value={guests} onChange={(event) => setGuests(Number(event.target.value))} className="h-11 border border-ink/20 bg-[#fbf8f1] px-3 text-sm font-normal">{Array.from({ length: property.maxGuests }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} {index === 0 ? "guest" : "guests"}</option>)}</select></label><label className="grid gap-2 text-xs font-semibold">Expected arrival<select value={arrival} onChange={(event) => setArrival(event.target.value)} className="h-11 border border-ink/20 bg-[#fbf8f1] px-3 text-sm font-normal">{["12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"].map((time) => <option key={time} value={time}>{previewTimeLabel(time)}</option>)}</select></label></div>
        <p className="mt-5 flex items-start gap-3 text-xs leading-5 text-ink/55"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-lagoon" />Checkout is a visual demo. Payment and availability are not connected.</p>
      </section>
      <aside className="border border-ink/15 bg-[#fbf8f1] p-5"><p className="eyebrow text-laterite">Your dates</p><h2 className="mt-2 font-display text-3xl">{property.place}</h2><p className="mt-2 text-sm text-ink/60">{checkin} → {checkout}</p><p className="mt-1 flex items-center gap-2 text-xs text-ink/50"><UsersRound size={13} /> {guests} guests · {nights} nights</p><div className="mt-5 grid gap-2 border-t border-ink/10 pt-4 text-sm"><div className="flex justify-between"><span className="text-ink/60">Stay · {nights} nights</span><span>{formatINR(subtotal)}</span></div><div className="flex justify-between"><span className="text-ink/60">Cleaning</span><span>{formatINR(property.cleaningFeeInr)}</span></div><div className="flex justify-between"><span className="text-ink/60">Estimated GST</span><span>{formatINR(total - beforeTax)}</span></div><div className="mt-1 flex justify-between border-t border-ink/10 pt-3 font-semibold"><span>Estimated total</span><span>{formatINR(total)}</span></div></div><button onClick={openCheckout} className="button-ink mt-5 w-full">Preview checkout <ArrowRight size={15} /></button></aside>
    </div>
  </div>;
}

function previewTimeLabel(time: string) {
  const hour = Number(time.slice(0, 2));
  const suffix = hour >= 12 ? "pm" : "am";
  return `${hour % 12 || 12}:${time.slice(3)} ${suffix}`;
}

function LiveBookingStart() {
  const params = useSearchParams();
  const router = useRouter();
  const slug = params.get("property") ?? "";
  const checkin = params.get("checkin") ?? "";
  const checkout = params.get("checkout") ?? "";
  const guests = Math.max(1, Number(params.get("guests") ?? "2"));
  const [property, setProperty] = useState<PropertyInfo | null>(null);
  const [rates, setRates] = useState<SeasonalRate[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [arrival, setArrival] = useState("15:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supabase = getSupabaseBrowserClient();
  const fallback = getProperty(slug);

  useEffect(() => {
    if (!supabase || !slug) return;
    let active = true;
    void Promise.all([supabase.from("properties").select("id,slug,name,base_price_inr,cleaning_fee_inr,max_guests,district").eq("slug", slug).maybeSingle(), supabase.auth.getUser()]).then(async ([propertyResult, authResult]) => {
      if (propertyResult.data) {
        if (active) setProperty(propertyResult.data as PropertyInfo);
        const { data } = await supabase.from("seasonal_rates").select("range,nightly_rate_inr").eq("property_id", propertyResult.data.id);
        if (active && data) setRates(data as SeasonalRate[]);
      }
      if (active) setUserId(authResult.data.user?.id ?? null);
    });
    return () => { active = false; };
  }, [slug, supabase]);

  const signInUrl = `/account?next=${encodeURIComponent(`/booking/new?${params.toString()}`)}`;
  const nights = Math.max(0, Math.round((new Date(`${checkout}T00:00:00`).getTime() - new Date(`${checkin}T00:00:00`).getTime()) / 86400000));
  const rate = property?.base_price_inr ?? fallback?.basePriceInr ?? 0;
  const cleaning = property?.cleaning_fee_inr ?? fallback?.cleaningFeeInr ?? 0;
  const stay = staySubtotal(checkin, checkout, rate, rates);
  const total = stay + cleaning;

  async function holdDates() {
    if (!userId) return;
    if (!property) { setError("This stay is not connected to the booking service yet."); return; }
    setBusy(true); setError("");
    const response = await fetch("/api/bookings/hold", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: property.id, checkin, checkout, guests, expectedArrivalTime: arrival }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) { setError(body.error ?? "We could not hold those dates."); setBusy(false); return; }
    router.push(`/booking/${body.booking.id}`);
  }

  return <div className="mx-auto max-w-4xl"><Link href={`/properties/${slug}`} className="inline-flex items-center gap-2 text-xs text-ink/55 hover:text-laterite"><ArrowLeft size={14} /> Back to {fallback?.place ?? "the stay"}</Link><div className="mt-8 grid gap-8 md:grid-cols-[1fr_330px] md:items-start"><section><p className="eyebrow text-laterite">Before we put the kettle on</p><h1 className="mt-3 font-display text-5xl md:text-6xl">Let’s make this stay yours.</h1><p className="mt-4 max-w-lg text-sm leading-6 text-ink/65">Your dates are held for ten minutes once you continue to checkout. Payment confirms your booking.</p><div className="mt-8 border-y border-ink/15 py-6"><p className="eyebrow text-ink/50">Your arrival</p><label className="mt-3 flex max-w-sm items-center justify-between gap-5 border border-ink/15 bg-[#fbf8f1] px-4 py-3"><span className="flex items-center gap-2 text-sm"><Clock3 size={15} className="text-laterite" /> Expected check-in</span><select value={arrival} onChange={(event) => setArrival(event.target.value)} className="bg-transparent text-sm outline-none" aria-label="Expected check-in time">{Array.from({ length: 21 }, (_, index) => { const minutes = 10 * 60 + index * 30; const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`; return <option value={time} key={time}>{previewTimeLabel(time)}</option>; })}</select></label><p className="mt-3 text-xs text-ink/50">Check-in is 10 am–8 pm. Check-out is by 9 am. If you need another time, just ask your host.</p></div><div className="mt-6 flex items-start gap-3 text-xs leading-5 text-ink/55"><ShieldCheck size={16} className="mt-0.5 shrink-0 text-lagoon" />Your stay is held in a secure, owner-run booking system. The host sees the details needed to get ready for you.</div></section><aside className="border border-ink/15 bg-[#fbf8f1] p-5"><p className="eyebrow text-laterite">Your dates</p><h2 className="mt-2 font-display text-3xl">{fallback?.place ?? property?.name ?? "Odisha stay"}</h2><p className="mt-2 text-sm text-ink/60">{checkin} → {checkout}</p><p className="mt-1 flex items-center gap-2 text-xs text-ink/50"><UsersRound size={13} /> {guests} guests · {nights} nights</p><div className="mt-5 grid gap-2 border-t border-ink/10 pt-4 text-sm"><div className="flex justify-between"><span className="text-ink/60">Stay · {nights} nights</span><span>{formatINR(stay)}</span></div><div className="flex justify-between"><span className="text-ink/60">Cleaning</span><span>{formatINR(cleaning)}</span></div><p className="text-[11px] text-ink/45">GST is finalized from your host’s tax settings in checkout.</p><div className="mt-1 flex justify-between border-t border-ink/10 pt-3 font-semibold"><span>Before GST</span><span>{formatINR(total)}</span></div></div>{userId ? <button onClick={holdDates} disabled={busy || !property} className="button-ink mt-5 w-full disabled:opacity-45">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <>Hold these dates <ArrowRight size={15} /></>}</button> : <Link className="button-ink mt-5 w-full" href={signInUrl}>Sign in to continue <ArrowRight size={15} /></Link>}{error && <p role="alert" className="mt-3 text-xs text-laterite">{error}</p>}{!property && supabase && <p className="mt-3 text-[11px] text-ink/45">Connect and seed Supabase to reserve these starter properties.</p>}</aside></div></div>;
}
