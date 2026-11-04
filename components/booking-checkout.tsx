"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, CheckCircle2, Clock3, Download, LoaderCircle, LockKeyhole, MessageCircle, Minus, Plus, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/format";
import { CustomTimeRequest } from "@/components/custom-time-request";
import { isValidGuestIdName, isValidIndianMobile, normalizeGuestIdName } from "@/lib/guest-details";

type Property = { name: string; district: string; slug: string; max_guests: number; included_guests: number; extra_guest_fee_inr: number; extra_guest_fee_mode: "per_night" | "per_stay" };
type Booking = { id: string; property_id: string; checkin_date: string; checkout_date: string; expected_arrival_time: string; custom_checkin_time: string | null; custom_checkout_time: string | null; guests: number; guest_id_name: string; guest_phone: string; extra_guests: number; extra_guest_total_inr: number; status: string; hold_expires_at: string | null; subtotal_inr: number; taxes_inr: number; total_inr: number; amount_paid_inr: number; deposit_percent: number | null; properties: Property | null };
type Quote = { nights: number; guests: number; extra_guests: number; base_total_inr: number; extra_guest_total_inr: number; cleaning_fee_inr: number; subtotal_inr: number; tax_percent: number; taxes_inr: number; total_inr: number };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, callback: (response: unknown) => void) => void }; } }

export function BookingCheckout({ bookingId }: { bookingId: string }) {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [guestName, setGuestName] = useState("");
  const [mobile, setMobile] = useState("");
  const [guestCount, setGuestCount] = useState(1);
  const [detailsSaved, setDetailsSaved] = useState(false);
  const initialized = useRef(false);
  const quoteSequence = useRef(0);
  const [depositEnabled, setDepositEnabled] = useState(false);
  const [depositPercent, setDepositPercent] = useState(30);
  const [payInFull, setPayInFull] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const refresh = async (currentUser?: User | null) => {
      const nextUser = currentUser ?? (await supabase.auth.getUser()).data.user;
      if (!mounted) return;
      setUser(nextUser ?? null);
      if (!nextUser) return;
      const [{ data: stay }, { data: settings }] = await Promise.all([
        supabase.from("bookings").select("id,property_id,checkin_date,checkout_date,expected_arrival_time,custom_checkin_time,custom_checkout_time,guests,guest_id_name,guest_phone,extra_guests,extra_guest_total_inr,status,hold_expires_at,subtotal_inr,taxes_inr,total_inr,amount_paid_inr,deposit_percent,properties(name,district,slug,max_guests,included_guests,extra_guest_fee_inr,extra_guest_fee_mode)").eq("id", bookingId).eq("guest_id", nextUser.id).maybeSingle(),
        supabase.from("admin_settings").select("key,value").in("key", ["deposit_enabled", "deposit_percent"])
      ]);
      if (!mounted) return;
      const row = stay as unknown as Booking | null;
      setBooking(row);
      if (row && !initialized.current) {
        setGuestName(row.guest_id_name ?? "");
        setMobile(row.guest_phone?.replace(/^\+91/, "") ?? "");
        setGuestCount(row.guests);
        setDetailsSaved(Boolean(row.guest_id_name && row.guest_phone));
        initialized.current = true;
      }
      setDepositEnabled(settings?.find((setting) => setting.key === "deposit_enabled")?.value === true);
      setDepositPercent(Number(settings?.find((setting) => setting.key === "deposit_percent")?.value ?? 30));
    };
    void refresh();
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => void refresh(session?.user));
    let channel: ReturnType<typeof supabase.channel> | null = null;
    void supabase.auth.getUser().then(({ data }) => {
      if (!data.user || !mounted) return;
      channel = supabase.channel(`booking:${data.user.id}`).on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `guest_id=eq.${data.user.id}` }, () => void refresh(data.user)).subscribe();
    });
    return () => { mounted = false; authListener.subscription.unsubscribe(); if (channel) void supabase.removeChannel(channel); };
  }, [bookingId, supabase]);

  useEffect(() => {
    if (!booking) return;
    const sequence = ++quoteSequence.current;
    void fetch("/api/bookings/quote", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertyId: booking.property_id, checkin: booking.checkin_date, checkout: booking.checkout_date, guests: guestCount }) })
      .then(async (response) => ({ response, result: await response.json().catch(() => ({})) }))
      .then(({ response, result }) => { if (sequence === quoteSequence.current) setQuote(response.ok ? result.quote as Quote : null); });
  }, [booking, guestCount]);

  function changedDetails() { setDetailsSaved(false); setNotice(""); }

  async function saveGuestDetails(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanName = normalizeGuestIdName(guestName);
    if (!isValidGuestIdName(cleanName)) { setError("Enter a full name using 2 to 60 letters, spaces or dots."); return; }
    if (!isValidIndianMobile(mobile)) { setError("Enter a valid 10-digit Indian mobile number."); return; }
    if (!booking?.properties || guestCount > booking.properties.max_guests) { setError("Guest count exceeds this property’s limit."); return; }
    setBusy(true); setError(""); setNotice("");
    const response = await fetch("/api/bookings/guest-details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, guestIdName: cleanName, mobile, guests: guestCount }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "Guest details could not be saved."); setBusy(false); return; }
    setGuestName(cleanName); setDetailsSaved(true); setQuote(result.quote as Quote); setNotice("Guest details saved to your held booking."); setBusy(false);
  }

  async function pay() {
    if (!detailsSaved) { setError("Save your guest details before continuing to payment."); return; }
    setBusy(true); setError(""); setNotice("");
    const orderResponse = await fetch("/api/payments/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, payInFull }) });
    const order = await orderResponse.json().catch(() => ({}));
    if (!orderResponse.ok) { setError(order.error ?? "We could not start checkout."); setBusy(false); return; }
    if (order.quote) setQuote(order.quote as Quote);
    try {
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay Checkout did not load.");
      const checkout = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, name: "Odisha Retreat",
        description: `${booking?.properties?.name ?? "Odisha stay"} · ${booking?.checkin_date} to ${booking?.checkout_date}`,
        order_id: order.orderId, prefill: { name: guestName, email: user?.email, contact: mobile }, notes: { booking_id: bookingId }, theme: { color: "#a64d37" },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          const verification = await fetch("/api/payments/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature }) });
          const result = await verification.json().catch(() => ({}));
          if (verification.ok) setNotice(result.message ?? "Payment received. We are confirming your booking.");
          else setError(result.error ?? "We could not verify the payment.");
          setBusy(false);
        }
      });
      checkout.on("payment.failed", (rawResponse: unknown) => { const response = rawResponse as { error?: { description?: string } }; setError(response.error?.description ?? "Payment did not go through. Your date hold is still active for a few minutes."); setBusy(false); });
      checkout.open();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Checkout could not open."); setBusy(false); }
  }

  if (!supabase) return <div className="mx-auto max-w-3xl border border-ink/15 bg-[#fbf8f1] p-8"><p className="eyebrow text-laterite">Checkout setup</p><h1 className="mt-3 font-display text-4xl">Booking service unavailable.</h1><p className="mt-3 text-sm text-ink/60">Connect this app to its Supabase project to complete a reservation.</p></div>;
  if (!user) return <div className="mx-auto max-w-2xl border border-ink/15 bg-[#fbf8f1] p-8"><p className="eyebrow text-laterite">Your dates are waiting</p><h1 className="mt-3 font-display text-4xl">Sign in to continue.</h1><p className="mt-3 text-sm leading-6 text-ink/60">Sign in to view your held booking and provide guest details.</p><Link className="button-ink mt-6" href={`/account?next=${encodeURIComponent(`/booking/${bookingId}`)}`}>Sign in to your account</Link></div>;
  if (!booking) return <div className="mx-auto max-w-3xl border border-ink/15 p-8"><p className="text-sm text-ink/55">Loading your stay…</p></div>;

  const holdExpired = booking.status === "held" && (!booking.hold_expires_at || new Date(booking.hold_expires_at) <= new Date());
  const requestedArrival = booking.custom_checkin_time ?? booking.expected_arrival_time;
  const nights = quote?.nights ?? Math.max(1, Math.round((new Date(booking.checkout_date).getTime() - new Date(booking.checkin_date).getTime()) / 86_400_000));
  const maxGuests = booking.properties?.max_guests ?? guestCount;
  return <div className="mx-auto max-w-5xl"><Link href={booking.properties ? `/properties/${booking.properties.slug}` : "/#stays"} className="inline-flex items-center gap-2 text-xs text-ink/55 hover:text-laterite"><ArrowLeft size={14} /> Back to your stay</Link><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_350px] lg:items-start"><section><p className="eyebrow text-laterite">{booking.status === "confirmed" ? "A date to look forward to" : "One last step"}</p><h1 className="mt-3 font-display text-5xl leading-[.94] md:text-6xl">{booking.status === "confirmed" ? "Your stay is confirmed." : "Let’s make it official."}</h1><p className="mt-4 max-w-xl text-sm leading-6 text-ink/65">{booking.status === "confirmed" ? "Your host has your dates. We’ll be in touch before you arrive." : "Your host will be ready with a warm welcome."}</p><div className="mt-8 grid gap-4 border-y border-ink/15 py-6 sm:grid-cols-2"><div><p className="eyebrow text-ink/45">Stay</p><p className="mt-2 font-display text-2xl">{booking.properties?.name ?? "Your Odisha stay"}</p><p className="mt-1 text-sm text-ink/60">{booking.properties?.district ?? "Odisha"}</p></div><div><p className="eyebrow text-ink/45">Dates & guests</p><p className="mt-2 text-sm">{booking.checkin_date} → {booking.checkout_date}</p><p className="mt-1 text-sm text-ink/60">{booking.guests} guests · {nights} nights</p></div><div><p className="eyebrow text-ink/45">Guest details</p><p className="mt-2 text-sm">{booking.guest_id_name || guestName || "—"}</p><p className="mt-1 text-sm text-ink/60">{booking.guest_phone || (mobile ? `+91${mobile}` : "—")}</p></div><div><p className="eyebrow text-ink/45">Arrival</p><p className="mt-2 flex items-center gap-2 text-sm"><Clock3 size={14} className="text-laterite" /> {new Date(`2000-01-01T${requestedArrival}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p><p className="mt-1 text-xs text-ink/50">Check-out by 9 am</p></div><div><p className="eyebrow text-ink/45">Booking number</p><p className="mt-2 font-mono text-sm">{booking.id.slice(0, 8).toUpperCase()}</p></div></div>
    {booking.status === "confirmed" ? <div className="mt-7 flex flex-wrap gap-3"><a href={`/api/invoices/${booking.id}`} className="button-outline"><Download size={15} /> Download GST invoice</a><Link href={`/account?booking=${booking.id}`} className="button-outline"><MessageCircle size={15} /> Chat with your host</Link></div> : <div className="mt-7 border border-turmeric/50 bg-[#f6edda] p-5"><p className="flex items-center gap-2 font-semibold"><Clock3 size={16} className="text-laterite" /> Date hold is active for ten minutes.</p><p className="mt-2 text-xs leading-5 text-ink/60">Your reservation becomes confirmed only after Razorpay verifies the payment.</p></div>}
    {booking.status === "confirmed" && <CustomTimeRequest bookingId={booking.id} currentCheckin={booking.custom_checkin_time ?? booking.expected_arrival_time} />}
    {notice && <p role="status" className="mt-5 border border-lagoon/25 bg-[#e7efeb] p-4 text-sm text-lagoon">{notice}</p>}{error && <p role="alert" className="mt-5 border border-laterite/25 bg-[#f0e0d8] p-4 text-sm text-laterite">{error}</p>}
    {booking.status === "held" && !holdExpired && <form onSubmit={(event) => void saveGuestDetails(event)} className="mt-7 border border-ink/15 bg-[#fbf8f1] p-5 md:p-6"><p className="eyebrow text-laterite">Guest details</p><h2 className="mt-2 font-display text-3xl">Who will be checking in?</h2><div className="mt-5 grid gap-4"><label className="grid gap-2 text-xs font-semibold">Full name as on government ID<input required minLength={2} maxLength={60} value={guestName} onChange={(event) => { setGuestName(event.target.value); changedDetails(); }} autoComplete="name" className="h-11 border border-ink/20 bg-paper px-3 text-sm font-normal outline-none focus:border-laterite" aria-describedby="guest-name-help" /><span id="guest-name-help" className="text-[11px] font-normal leading-5 text-ink/55">Enter your name exactly as it appears on your ID card. You'll need to show this ID at check-in.</span></label><label className="grid gap-2 text-xs font-semibold">Mobile number<div className="flex h-11 border border-ink/20 bg-paper focus-within:border-laterite"><span className="grid place-items-center border-r border-ink/10 px-3 text-sm text-ink/60">+91</span><input required type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} pattern="[6-9][0-9]{9}" value={mobile} onChange={(event) => { setMobile(event.target.value.replace(/\D/g, "").slice(0, 10)); changedDetails(); }} className="min-w-0 flex-1 bg-transparent px-3 text-sm font-normal outline-none" aria-describedby="guest-mobile-help" /></div><span id="guest-mobile-help" className="text-[11px] font-normal leading-5 text-ink/55">We'll use this for booking updates and check-in coordination.</span></label><div><p className="text-xs font-semibold">Number of guests</p><div className="mt-2 inline-flex h-11 items-center border border-ink/20 bg-paper"><button type="button" aria-label="Remove one guest" disabled={guestCount <= 1} onClick={() => { setGuestCount((count) => Math.max(1, count - 1)); changedDetails(); }} className="grid h-10 w-10 place-items-center disabled:opacity-35"><Minus size={14} /></button><span className="min-w-12 text-center text-sm" aria-live="polite">{guestCount}</span><button type="button" aria-label="Add one guest" disabled={guestCount >= maxGuests} onClick={() => { setGuestCount((count) => Math.min(maxGuests, count + 1)); changedDetails(); }} className="grid h-10 w-10 place-items-center disabled:opacity-35"><Plus size={14} /></button></div><p className="mt-1 text-[11px] text-ink/50">Maximum {maxGuests} guests for this property.</p></div><button disabled={busy || holdExpired} className="button-outline w-fit disabled:opacity-45">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Save guest details</button></div></form>}
    </section><aside className="border border-ink/15 bg-[#fbf8f1] p-5 md:p-6"><p className="eyebrow text-laterite">Your price breakdown</p><div className="mt-5 grid gap-3 text-sm">{quote ? <><div className="flex justify-between"><span className="text-ink/60">Base ({booking.properties?.included_guests ?? 2} guests included) · {quote.nights} {quote.nights === 1 ? "night" : "nights"}</span><span>{formatINR(quote.base_total_inr)}</span></div>{quote.extra_guests > 0 && <div className="flex justify-between gap-3"><span className="text-ink/60">Extra guests: {quote.extra_guests} × {formatINR(booking.properties?.extra_guest_fee_inr ?? 500)}{booking.properties?.extra_guest_fee_mode === "per_stay" ? " × 1 stay" : ` × ${quote.nights} ${quote.nights === 1 ? "night" : "nights"}`}</span><span>{formatINR(quote.extra_guest_total_inr)}</span></div>}<div className="flex justify-between"><span className="text-ink/60">Cleaning</span><span>{formatINR(quote.cleaning_fee_inr)}</span></div><div className="flex justify-between"><span className="text-ink/60">GST ({quote.tax_percent}%)</span><span>{formatINR(quote.taxes_inr)}</span></div><div className="mt-1 flex justify-between border-t border-ink/15 pt-3 font-semibold"><span>Total</span><span>{formatINR(quote.total_inr)}</span></div>{booking.amount_paid_inr > 0 && <div className="flex justify-between text-lagoon"><span>Paid so far</span><span>{formatINR(booking.amount_paid_inr)}</span></div>}</> : <p className="text-xs text-ink/45">Calculating server price…</p>}</div>
      {booking.status === "held" && !holdExpired ? <><div className="mt-5 border-t border-ink/10 pt-4">{depositEnabled && quote && <fieldset className="grid gap-2 text-sm"><legend className="eyebrow mb-2 text-ink/50">Payment choice</legend><label className="flex cursor-pointer items-center justify-between border border-ink/15 p-3"><span><input type="radio" name="payment" checked={!payInFull} onChange={() => setPayInFull(false)} className="mr-2 accent-laterite" />Pay {depositPercent}% today</span><span>{formatINR(Math.ceil(quote.total_inr * depositPercent / 100))}</span></label><label className="flex cursor-pointer items-center justify-between border border-ink/15 p-3"><span><input type="radio" name="payment" checked={payInFull} onChange={() => setPayInFull(true)} className="mr-2 accent-laterite" />Pay in full</span><span>{formatINR(quote.total_inr)}</span></label></fieldset>}</div><button onClick={() => void pay()} disabled={busy || !detailsSaved || !quote} className="button-ink mt-5 w-full disabled:opacity-50">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <LockKeyhole size={15} />} {detailsSaved ? "Pay securely with Razorpay" : "Save guest details to continue"}</button><p className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-ink/45"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-lagoon" />Payment details are handled by Razorpay. The host never sees your card number.</p></> : booking.status !== "confirmed" && <div className="mt-5"><p className="text-xs text-laterite">This date hold has ended.</p><Link className="button-outline mt-3 w-full" href={`/properties/${booking.properties?.slug ?? "puri"}`}>Choose new dates</Link></div>}
    </aside></div></div>;
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Razorpay Checkout could not load.")); document.body.appendChild(script);
  });
}
