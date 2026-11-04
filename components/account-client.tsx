"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { ArrowUpRight, CheckCircle2, LoaderCircle, LogOut, Mail, MessageCircle, ShieldCheck, TicketCheck } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatINR } from "@/lib/format";
import { properties } from "@/lib/properties";
import { GuestChat } from "@/components/guest-chat";
import { AccountPreview } from "@/components/account-preview";
import { UI_PREVIEW_MODE } from "@/lib/ui-preview";

type Booking = { id: string; checkin_date: string; checkout_date: string; status: string; total_inr: number; guests: number; properties: { slug: string; name: string; district: string } | null };
type Conversation = { id: string; property_id: string | null; booking_id: string | null; subject: string; status: string; last_message_at: string };

export function AccountClient() {
  return UI_PREVIEW_MODE ? <AccountPreview /> : <LiveAccountClient />;
}

function LiveAccountClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedProperty = searchParams.get("property");
  const requestedBooking = searchParams.get("booking");
  const returnTo = searchParams.get("next");
  const [user, setUser] = useState<User | null>(null);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const supabase = getSupabaseBrowserClient();

  const refresh = useCallback(async (currentUser: User) => {
    if (!supabase) return;
    const [{ data: bookingRows }, { data: threadRows }, { data: profile }] = await Promise.all([
      supabase.from("bookings").select("id,checkin_date,checkout_date,status,total_inr,guests,properties(slug,name,district)").eq("guest_id", currentUser.id).order("created_at", { ascending: false }),
      supabase.from("conversations").select("id,property_id,booking_id,subject,status,last_message_at").eq("guest_id", currentUser.id).order("last_message_at", { ascending: false }),
      supabase.from("profiles").select("full_name,phone").eq("id", currentUser.id).maybeSingle()
    ]);
    setBookings((bookingRows ?? []) as unknown as Booking[]);
    setConversations((threadRows ?? []) as Conversation[]);
    if (profile) { setProfileName(profile.full_name ?? ""); setProfilePhone(profile.phone ?? ""); }
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => { const nextUser = data.session?.user ?? null; setUser(nextUser); if (nextUser) void refresh(nextUser); });
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null; setUser(nextUser); if (nextUser) void refresh(nextUser); else { setBookings([]); setConversations([]); }
    });
    return () => authListener.subscription.unsubscribe();
  }, [refresh, supabase]);

  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase.channel(`account:${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings", filter: `guest_id=eq.${user.id}` }, () => void refresh(user))
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations", filter: `guest_id=eq.${user.id}` }, () => void refresh(user))
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [refresh, supabase, user]);

  useEffect(() => {
    if (!supabase || !user || !requestedProperty || activeConversation) return;
    let active = true;
    const openConversation = async () => {
      const { data: property } = await supabase.from("properties").select("id,name").eq("slug", requestedProperty).maybeSingle();
      if (!active || !property) return;
      const { data: existing } = await supabase.from("conversations").select("id").eq("guest_id", user.id).eq("property_id", property.id).eq("status", "open").is("booking_id", null).limit(1).maybeSingle();
      if (existing) { setActiveConversation(existing.id); return; }
      const { data: created, error } = await supabase.from("conversations").insert({ guest_id: user.id, property_id: property.id, subject: `A note about ${property.name}` }).select("id").single();
      if (created) { setActiveConversation(created.id); void refresh(user); }
      else if (error?.code === "23505") {
        const { data: thread } = await supabase.from("conversations").select("id").eq("guest_id", user.id).eq("property_id", property.id).eq("status", "open").is("booking_id", null).single();
        if (thread) setActiveConversation(thread.id);
      }
    };
    void openConversation();
    return () => { active = false; };
  }, [activeConversation, refresh, requestedProperty, supabase, user]);

  useEffect(() => {
    if (!supabase || !user || !requestedBooking || activeConversation) return;
    let active = true;
    void supabase.from("conversations").select("id").eq("guest_id", user.id).eq("booking_id", requestedBooking).maybeSingle().then(({ data }) => { if (active && data) setActiveConversation(data.id); });
    return () => { active = false; };
  }, [activeConversation, requestedBooking, supabase, user]);

  async function sendOtp(event: React.FormEvent) {
    event.preventDefault(); if (!supabase || !email) return;
    setBusy(true); setNotice("");
    const callback = new URL("/auth/callback", window.location.origin);
    if (returnTo) callback.searchParams.set("next", returnTo);
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback.toString() } });
    setNotice(error ? error.message : "We’ve sent a sign-in code and link. Check your inbox, including spam.");
    setOtpSent(!error); setBusy(false);
  }
  async function verifyOtp(event: React.FormEvent) {
    event.preventDefault(); if (!supabase) return;
    setBusy(true); const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: "email" });
    setNotice(error ? error.message : "You’re in. Welcome back."); setBusy(false);
    if (!error && returnTo) router.push(returnTo.startsWith("/") ? returnTo : "/account");
  }
  async function googleLogin() {
    if (!supabase) return;
    const callback = new URL("/auth/callback", window.location.origin);
    if (returnTo) callback.searchParams.set("next", returnTo);
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callback.toString() } });
    if (error) setNotice(error.message);
  }
  async function saveProfile(event: React.FormEvent) {
    event.preventDefault(); if (!supabase || !user) return;
    setBusy(true); const { error } = await supabase.from("profiles").upsert({ id: user.id, full_name: profileName, phone: profilePhone });
    setNotice(error ? error.message : "Your details are saved."); setBusy(false);
  }

  if (!supabase) return <section className="mx-auto max-w-3xl border border-ink/15 bg-[#fbf8f1] p-8 md:p-12"><p className="eyebrow text-laterite">Your corner of Odisha</p><h1 className="mt-3 font-display text-5xl">Your stays, all in one place.</h1><p className="mt-4 text-sm leading-6 text-ink/60">Guest accounts are ready to connect. Add your Supabase URL and anon key to enable sign-in, bookings and messages.</p></section>;

  if (!user) return <section className="mx-auto grid max-w-5xl gap-10 md:grid-cols-[1.1fr_.9fr] md:items-center"><div><p className="eyebrow text-laterite">Your corner of Odisha</p><h1 className="mt-3 max-w-xl font-display text-6xl leading-[.93] md:text-7xl">Your stays,<br />all in one place.</h1><p className="mt-5 max-w-lg text-sm leading-6 text-ink/65">Sign in to book a stay, see your plans, or send a note to your host. We’ll send a one-time code to your inbox.</p><p className="mt-7 flex items-center gap-2 text-xs text-ink/50"><ShieldCheck size={15} className="text-lagoon" /> Your details are only shared with your host.</p></div><div className="border border-ink/15 bg-[#fbf8f1] p-6 md:p-8"><p className="eyebrow text-laterite">A note from us</p><h2 className="mt-2 font-display text-3xl">Sign in, simply.</h2><form onSubmit={otpSent ? verifyOtp : sendOtp} className="mt-6 grid gap-4"><label className="grid gap-2 text-xs font-semibold" htmlFor="guest-email">Email address<input id="guest-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" className="h-12 border border-ink/20 bg-paper px-3 text-sm font-normal outline-none focus:border-laterite" /></label>{otpSent && <label className="grid gap-2 text-xs font-semibold" htmlFor="guest-otp">Sign-in code<input id="guest-otp" inputMode="numeric" autoComplete="one-time-code" required value={otp} onChange={(event) => setOtp(event.target.value)} placeholder="Enter the code from your email" className="h-12 border border-ink/20 bg-paper px-3 text-sm font-normal outline-none focus:border-laterite" /></label>}<button disabled={busy} className="button-ink w-full">{busy ? <LoaderCircle size={16} className="animate-spin" /> : <Mail size={16} />}{otpSent ? "Verify code" : "Email me a sign-in code"}</button></form><div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-widest text-ink/35"><span className="h-px flex-1 bg-ink/15" />or<span className="h-px flex-1 bg-ink/15" /></div><button onClick={googleLogin} className="button-outline w-full">Continue with Google <ArrowUpRight size={14} /></button>{notice && <p role="status" className="mt-4 text-xs leading-5 text-lagoon">{notice}</p>}</div></section>;

  const property = properties.find((item) => item.slug === requestedProperty);
  return <div className="mx-auto max-w-[1280px]">
    <div className="flex flex-col justify-between gap-5 border-b border-ink/15 pb-7 md:flex-row md:items-end"><div><p className="eyebrow text-laterite">A warm welcome back</p><h1 className="mt-3 font-display text-5xl md:text-6xl">Hello{profileName ? `, ${profileName.split(" ")[0]}` : " there"}.</h1><p className="mt-3 text-sm text-ink/60">Your next little corner is just here.</p></div><button className="button-outline w-fit" onClick={() => void supabase.auth.signOut()}><LogOut size={14} /> Sign out</button></div>
    {notice && <p role="status" className="mt-5 text-sm text-lagoon">{notice}</p>}
    {requestedProperty && <div className="mt-7 grid gap-6 border border-laterite/30 bg-[#f0e0d8] p-5 md:grid-cols-[1fr_auto] md:items-center"><div><p className="eyebrow text-laterite">A note for your host</p><h2 className="mt-2 font-display text-3xl">{property?.place ?? "This stay"}</h2><p className="mt-1 text-sm text-ink/65">You’re signed in. The host will be right with you.</p></div>{activeConversation ? <button className="button-ink w-fit" onClick={() => document.getElementById("guest-chat")?.scrollIntoView({ behavior: "smooth" })}>Open your chat <MessageCircle size={15} /></button> : <span className="text-xs text-ink/50">Opening the conversation…</span>}</div>}
    <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_350px]">
      <section><div className="flex items-end justify-between border-b border-ink/15 pb-4"><div><p className="eyebrow text-laterite">Your plans</p><h2 className="mt-1 font-display text-4xl">Bookings</h2></div><TicketCheck className="text-laterite" /></div>{bookings.length ? <div className="mt-4 grid gap-3">{bookings.map((booking) => <article key={booking.id} className="grid gap-4 border border-ink/10 bg-[#fbf8f1] p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="eyebrow text-ink/50">{booking.properties?.district ?? "Odisha"} · {booking.status}</p><h3 className="mt-1 font-display text-2xl">{booking.properties?.name ?? "Your stay"}</h3><p className="mt-1 text-sm text-ink/60">{booking.checkin_date} → {booking.checkout_date} · {booking.guests} guests</p></div><div className="flex items-center justify-between gap-5"><span className="font-display text-xl">{formatINR(booking.total_inr)}</span><Link className="button-outline !min-h-10 !px-3 !text-xs" href={`/booking/${booking.id}`}>Details <ArrowUpRight size={13} /></Link></div></article>)}</div> : <div className="mt-4 border border-dashed border-ink/20 p-7"><p className="font-display text-2xl">Nothing booked just yet.</p><p className="mt-2 text-sm text-ink/60">There’s no rush. Have a look when you’re ready.</p><Link href="/#stays" className="mt-4 inline-flex items-center gap-2 text-sm text-laterite">Explore the four stays <ArrowUpRight size={14} /></Link></div>}
      <div className="mt-10"><div className="flex items-end justify-between border-b border-ink/15 pb-4"><div><p className="eyebrow text-laterite">One-to-one with the owner</p><h2 className="mt-1 font-display text-4xl">Messages</h2></div><MessageCircle className="text-laterite" /></div>{conversations.length ? <div className="mt-4 grid gap-3">{conversations.map((conversation) => <button key={conversation.id} onClick={() => setActiveConversation(conversation.id)} className={`flex items-center justify-between border p-4 text-left ${activeConversation === conversation.id ? "border-laterite bg-[#f0e0d8]" : "border-ink/10 bg-[#fbf8f1] hover:border-laterite/50"}`}><span><span className="block font-display text-xl">{conversation.subject}</span><span className="mt-1 block text-xs text-ink/50">{new Date(conversation.last_message_at).toLocaleString()}</span></span><MessageCircle size={17} className="text-laterite" /></button>)}</div> : !requestedProperty && <p className="mt-4 border border-dashed border-ink/20 p-6 text-sm text-ink/60">Your host is always nearby if you need a hand.</p>}</div></section>
      <aside><div className="border border-ink/15 bg-[#fbf8f1] p-5"><p className="eyebrow text-laterite">A few details</p><h2 className="mt-2 font-display text-3xl">Your profile</h2><form onSubmit={saveProfile} className="mt-5 grid gap-4"><label className="grid gap-2 text-xs font-semibold">Name<input value={profileName} onChange={(event) => setProfileName(event.target.value)} className="h-11 border border-ink/20 bg-paper px-3 text-sm font-normal outline-none focus:border-laterite" placeholder="Your name" /></label><label className="grid gap-2 text-xs font-semibold">Phone<input value={profilePhone} onChange={(event) => setProfilePhone(event.target.value)} className="h-11 border border-ink/20 bg-paper px-3 text-sm font-normal outline-none focus:border-laterite" placeholder="+91 …" /></label><button className="button-outline">Save details <CheckCircle2 size={15} /></button></form></div><div className="mt-4 border border-ink/10 p-5"><p className="eyebrow text-ink/45">A small reminder</p><p className="mt-2 flex items-start gap-2 text-sm leading-6 text-ink/65"><CheckCircle2 size={15} className="mt-1 shrink-0 text-lagoon" />Your arrival time helps your host put the kettle on at the right moment.</p></div></aside>
    </div>
    {activeConversation && <section id="guest-chat" className="mt-10 max-w-[850px] scroll-mt-8"><GuestChat conversationId={activeConversation} /></section>}
  </div>;
}
