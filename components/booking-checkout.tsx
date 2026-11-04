"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowLeft, CheckCircle2, Clock3, Download, LoaderCircle, LockKeyhole, MessageCircle, ShieldCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/format";
import { CustomTimeRequest } from "@/components/custom-time-request";
import { getProperty } from "@/lib/properties";
import { UI_PREVIEW_MODE } from "@/lib/ui-preview";

type Booking = { id: string; property_id: string; checkin_date: string; checkout_date: string; expected_arrival_time: string; custom_checkin_time: string | null; custom_checkout_time: string | null; guests: number; status: string; hold_expires_at: string | null; subtotal_inr: number; taxes_inr: number; total_inr: number; amount_paid_inr: number; deposit_percent: number | null; properties: { name: string; district: string; slug: string } | null };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => { open: () => void; on: (event: string, callback: (response: unknown) => void) => void }; } }

export function BookingCheckout({ bookingId }: { bookingId: string }) {
  return UI_PREVIEW_MODE ? <BookingCheckoutPreview /> : <LiveBookingCheckout bookingId={bookingId} />;
}

function BookingCheckoutPreview() {
  const [booking, setBooking] = useState({ slug: "puri", checkin: "2026-12-12", checkout: "2026-12-15", guests: 2, arrival: "15:00", total: 23625 });
  const [confirmed, setConfirmed] = useState(false);
  const property = getProperty(booking.slug) ?? getProperty("puri")!;
  const nights = Math.max(1, Math.round((new Date(`${booking.checkout}T00:00:00`).getTime() - new Date(`${booking.checkin}T00:00:00`).getTime()) / 86400000) || 1);
  const subtotal = nights * property.basePriceInr;
  const taxesAndFees = Math.max(0, booking.total - subtotal - property.cleaningFeeInr);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("odisha-retreat-ui-preview-booking");
      if (saved) setBooking((current) => ({ ...current, ...JSON.parse(saved) }));
    } catch { /* Ignore malformed local preview data. */ }
  }, []);

  return <div className="mx-auto max-w-5xl">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-2 border border-lagoon/20 bg-[#e7efeb] px-4 py-3 text-xs text-lagoon"><span className="flex items-center gap-2"><ShieldCheck size={15} /> UI preview · sample booking</span><span>No payment is taken.</span></div>
    <Link href={`/properties/${property.slug}`} className="inline-flex items-center gap-2 text-xs text-ink/55 hover:text-laterite"><ArrowLeft size={14} /> Back to your stay</Link>
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_350px] lg:items-start"><section>
      <p className="eyebrow text-laterite">{confirmed ? "A date to look forward to" : "One last step"}</p><h1 className="mt-3 font-display text-5xl leading-[.94] md:text-6xl">{confirmed ? "Your stay is confirmed." : "Let’s make it official."}</h1><p className="mt-4 max-w-xl text-sm leading-6 text-ink/65">{confirmed ? "This is a sample confirmation screen. No reservation was saved." : "Preview the payment and confirmation screens with sample information."}</p>
      <div className="mt-8 grid gap-4 border-y border-ink/15 py-6 sm:grid-cols-2"><div><p className="eyebrow text-ink/45">Stay</p><p className="mt-2 font-display text-2xl">{property.place}</p><p className="mt-1 text-sm text-ink/60">{property.district} district</p></div><div><p className="eyebrow text-ink/45">Dates & guests</p><p className="mt-2 text-sm">{booking.checkin} → {booking.checkout}</p><p className="mt-1 text-sm text-ink/60">{booking.guests} guests · {nights} nights</p></div><div><p className="eyebrow text-ink/45">Arrival</p><p className="mt-2 flex items-center gap-2 text-sm"><Clock3 size={14} className="text-laterite" /> {previewTimeLabel(booking.arrival)}</p><p className="mt-1 text-xs text-ink/50">Check-out by 9 am</p></div><div><p className="eyebrow text-ink/45">Booking number</p><p className="mt-2 font-mono text-sm">UI-DEMO-2048</p></div></div>
      {confirmed ? <div className="mt-7 flex flex-wrap gap-3"><Link href="/account" className="button-outline"><MessageCircle size={15} /> View guest account</Link><span className="button-outline cursor-default"><CheckCircle2 size={15} /> Sample confirmation</span></div> : <div className="mt-7 border border-turmeric/50 bg-[#f6edda] p-5"><p className="flex items-center gap-2 font-semibold"><Clock3 size={16} className="text-laterite" /> Sample date hold · 10 minutes</p><p className="mt-2 text-xs leading-5 text-ink/60">In the real booking flow, your dates would be held while you pay.</p></div>}
    </section><aside className="border border-ink/15 bg-[#fbf8f1] p-5 md:p-6"><p className="eyebrow text-laterite">Your price breakdown</p><div className="mt-5 grid gap-3 text-sm"><div className="flex justify-between"><span className="text-ink/60">Stay · {nights} nights</span><span>{formatINR(subtotal)}</span></div><div className="flex justify-between"><span className="text-ink/60">Cleaning & estimated GST</span><span>{formatINR(property.cleaningFeeInr + taxesAndFees)}</span></div><div className="mt-1 flex justify-between border-t border-ink/15 pt-3 font-semibold"><span>Total</span><span>{formatINR(booking.total)}</span></div></div>{!confirmed && <><button onClick={() => setConfirmed(true)} className="button-ink mt-5 w-full"><LockKeyhole size={15} /> Preview successful payment</button><p className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-ink/45"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-lagoon" />This button changes only the screen. It does not contact a payment provider.</p></>}</aside></div>
  </div>;
}

function previewTimeLabel(time: string) {
  const hour = Number(time.slice(0, 2));
  const suffix = hour >= 12 ? "pm" : "am";
  return `${hour % 12 || 12}:${time.slice(3)} ${suffix}`;
}

function LiveBookingCheckout({ bookingId }: { bookingId: string }) {
  const supabase = getSupabaseBrowserClient();
  const [user, setUser] = useState<User | null>(null);
  const [booking, setBooking] = useState<Booking | null>(null);
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
        supabase.from("bookings").select("id,property_id,checkin_date,checkout_date,expected_arrival_time,custom_checkin_time,custom_checkout_time,guests,status,hold_expires_at,subtotal_inr,taxes_inr,total_inr,amount_paid_inr,deposit_percent,properties(name,district,slug)").eq("id", bookingId).eq("guest_id", nextUser.id).maybeSingle(),
        supabase.from("admin_settings").select("key,value").in("key", ["deposit_enabled", "deposit_percent"])
      ]);
      if (!mounted) return;
      setBooking(stay as unknown as Booking | null);
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

  async function pay() {
    setBusy(true); setError(""); setNotice("");
    const orderResponse = await fetch("/api/payments/order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, payInFull }) });
    const order = await orderResponse.json().catch(() => ({}));
    if (!orderResponse.ok) { setError(order.error ?? "We could not start checkout."); setBusy(false); return; }
    try {
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay Checkout did not load.");
      const checkout = new window.Razorpay({
        key: order.keyId, amount: order.amount, currency: order.currency, name: "Odisha Retreat",
        description: `${booking?.properties?.name ?? "Odisha stay"} · ${booking?.checkin_date} to ${booking?.checkout_date}`,
        order_id: order.orderId, prefill: { email: user?.email }, notes: { booking_id: bookingId }, theme: { color: "#a64d37" },
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

  if (!supabase) return <div className="mx-auto max-w-3xl border border-ink/15 bg-[#fbf8f1] p-8"><p className="eyebrow text-laterite">Checkout setup</p><h1 className="mt-3 font-display text-4xl">Your booking is almost there.</h1><p className="mt-3 text-sm text-ink/60">Connect Supabase and Razorpay to complete a reservation.</p></div>;
  if (!user) return <div className="mx-auto max-w-2xl border border-ink/15 bg-[#fbf8f1] p-8"><p className="eyebrow text-laterite">Your dates are waiting</p><h1 className="mt-3 font-display text-4xl">Sign in to continue.</h1><p className="mt-3 text-sm leading-6 text-ink/60">We need a name to hold these dates and send the confirmation.</p><Link className="button-ink mt-6" href={`/account?next=${encodeURIComponent(`/booking/${bookingId}`)}`}>Sign in to your account</Link></div>;
  if (!booking) return <div className="mx-auto max-w-3xl border border-ink/15 p-8"><p className="text-sm text-ink/55">Loading your stay…</p></div>;

  const holdExpired = booking.status === "held" && (!booking.hold_expires_at || new Date(booking.hold_expires_at) <= new Date());
  const requestedArrival = booking.custom_checkin_time ?? booking.expected_arrival_time;
  return <div className="mx-auto max-w-5xl"><Link href={booking.properties ? `/properties/${booking.properties.slug}` : "/#stays"} className="inline-flex items-center gap-2 text-xs text-ink/55 hover:text-laterite"><ArrowLeft size={14} /> Back to your stay</Link><div className="mt-8 grid gap-8 lg:grid-cols-[1fr_350px] lg:items-start"><section><p className="eyebrow text-laterite">{booking.status === "confirmed" ? "A date to look forward to" : "One last step"}</p><h1 className="mt-3 font-display text-5xl leading-[.94] md:text-6xl">{booking.status === "confirmed" ? "Your stay is confirmed." : "Let’s make it official."}</h1><p className="mt-4 max-w-xl text-sm leading-6 text-ink/65">{booking.status === "confirmed" ? "Your host has your dates. We’ll be in touch before you arrive." : "Your host will be ready with a warm welcome and the kettle on."}</p><div className="mt-8 grid gap-4 border-y border-ink/15 py-6 sm:grid-cols-2"><div><p className="eyebrow text-ink/45">Stay</p><p className="mt-2 font-display text-2xl">{booking.properties?.name ?? "Your Odisha stay"}</p><p className="mt-1 text-sm text-ink/60">{booking.properties?.district ?? "Odisha"}</p></div><div><p className="eyebrow text-ink/45">Dates & guests</p><p className="mt-2 text-sm">{booking.checkin_date} → {booking.checkout_date}</p><p className="mt-1 text-sm text-ink/60">{booking.guests} guests · {booking.total_inr ? Math.round((new Date(booking.checkout_date).getTime() - new Date(booking.checkin_date).getTime()) / 86400000) : 0} nights</p></div><div><p className="eyebrow text-ink/45">Arrival</p><p className="mt-2 flex items-center gap-2 text-sm"><Clock3 size={14} className="text-laterite" /> {new Date(`2000-01-01T${requestedArrival}`).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p><p className="mt-1 text-xs text-ink/50">Check-out by 9 am</p></div><div><p className="eyebrow text-ink/45">Booking number</p><p className="mt-2 font-mono text-sm">{booking.id.slice(0, 8).toUpperCase()}</p></div></div>
    {booking.status === "confirmed" ? <div className="mt-7 flex flex-wrap gap-3"><a href={`/api/invoices/${booking.id}`} className="button-outline"><Download size={15} /> Download GST invoice</a><Link href={`/account?booking=${booking.id}`} className="button-outline"><MessageCircle size={15} /> Chat with your host</Link></div> : <div className="mt-7 border border-turmeric/50 bg-[#f6edda] p-5"><p className="flex items-center gap-2 font-semibold"><Clock3 size={16} className="text-laterite" /> Date hold is active for ten minutes.</p><p className="mt-2 text-xs leading-5 text-ink/60">Your reservation becomes confirmed only after we receive Razorpay’s signed payment webhook.</p></div>}
    {booking.status === "confirmed" && <CustomTimeRequest bookingId={booking.id} currentCheckin={booking.custom_checkin_time ?? booking.expected_arrival_time} />}
    {notice && <p role="status" className="mt-5 border border-lagoon/25 bg-[#e7efeb] p-4 text-sm text-lagoon">{notice} We’ll update this page as soon as your host’s system confirms it.</p>}{error && <p role="alert" className="mt-5 border border-laterite/25 bg-[#f0e0d8] p-4 text-sm text-laterite">{error}</p>}</section>
    <aside className="border border-ink/15 bg-[#fbf8f1] p-5 md:p-6"><p className="eyebrow text-laterite">Your price breakdown</p><div className="mt-5 grid gap-3 text-sm"><div className="flex justify-between"><span className="text-ink/60">Stay</span><span>{formatINR(booking.subtotal_inr)}</span></div><div className="flex justify-between"><span className="text-ink/60">GST & fees</span><span>{formatINR(booking.total_inr - booking.subtotal_inr)}</span></div><div className="mt-1 flex justify-between border-t border-ink/15 pt-3 font-semibold"><span>Total</span><span>{formatINR(booking.total_inr)}</span></div>{booking.amount_paid_inr > 0 && <div className="flex justify-between text-lagoon"><span>Paid so far</span><span>{formatINR(booking.amount_paid_inr)}</span></div>}{booking.amount_paid_inr < booking.total_inr && booking.amount_paid_inr > 0 && <div className="flex justify-between"><span>Balance at check-in</span><span>{formatINR(booking.total_inr - booking.amount_paid_inr)}</span></div>}</div>
      {booking.status === "held" && !holdExpired ? <><div className="mt-5 border-t border-ink/10 pt-4">{depositEnabled && <fieldset className="grid gap-2 text-sm"><legend className="eyebrow mb-2 text-ink/50">Payment choice</legend><label className="flex cursor-pointer items-center justify-between border border-ink/15 p-3"><span><input type="radio" name="payment" checked={!payInFull} onChange={() => setPayInFull(false)} className="mr-2 accent-laterite" />Pay {depositPercent}% today</span><span>{formatINR(Math.ceil(booking.total_inr * depositPercent / 100))}</span></label><label className="flex cursor-pointer items-center justify-between border border-ink/15 p-3"><span><input type="radio" name="payment" checked={payInFull} onChange={() => setPayInFull(true)} className="mr-2 accent-laterite" />Pay in full</span><span>{formatINR(booking.total_inr)}</span></label></fieldset>}</div><button onClick={pay} disabled={busy} className="button-ink mt-5 w-full disabled:opacity-50">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <LockKeyhole size={15} />} Pay securely with Razorpay</button><p className="mt-3 flex items-start gap-2 text-[10px] leading-5 text-ink/45"><ShieldCheck size={13} className="mt-0.5 shrink-0 text-lagoon" />Payment details are handled by Razorpay. The host never sees your card number.</p></> : booking.status !== "confirmed" && <div className="mt-5"><p className="text-xs text-laterite">This date hold has ended.</p><Link className="button-outline mt-3 w-full" href={`/properties/${booking.properties?.slug ?? "puri"}`}>Choose new dates</Link></div>}
    </aside></div></div>;
}

function loadRazorpay() {
  if (window.Razorpay) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://checkout.razorpay.com/v1/checkout.js"; script.onload = () => resolve(); script.onerror = () => reject(new Error("Razorpay Checkout could not load.")); document.body.appendChild(script);
  });
}
