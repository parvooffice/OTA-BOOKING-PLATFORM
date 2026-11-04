"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Activity, CalendarDays, CheckCheck, CircleDollarSign, Clock3, LayoutDashboard, LogOut, MapPin, MessageCircle, Settings2, UsersRound } from "lucide-react";
import { AdminChatInbox } from "@/components/admin-chat-inbox";
import { AdminImageManager } from "@/components/admin-image-manager";
import { AdminPropertyManager } from "@/components/admin-property-manager";
import { AdminBookingManager, AdminCalendar, AdminGuestList } from "@/components/admin-operations";
import { AdminPayments } from "@/components/admin-payments";
import { AdminSettingsPanel } from "@/components/admin-settings-panel";
import { getClerkSupabaseBrowserClient } from "@/lib/supabase/clerk-browser";

type AdminBooking = {
  id: string; property_id: string; guest_id: string; guest_email: string; checkin_date: string; checkout_date: string;
  expected_arrival_time: string; custom_checkin_time: string | null; custom_checkout_time: string | null; guests: number;
  status: string; subtotal_inr: number; taxes_inr: number; total_inr: number; amount_paid_inr: number; created_at: string;
  properties: { name: string; slug: string; district: string } | null;
  profiles: { full_name: string; phone: string | null } | null;
};
type AdminPayment = { id: string; booking_id: string; razorpay_order_id: string; razorpay_payment_id: string | null; status: string; amount_inr: number; refunded_inr: number; method: string | null; created_at: string };
type DashboardProperty = { id: string; slug: string; name: string; tagline: string; description: string; lat: number; lng: number; address: string; district: string; base_price_inr: number; cleaning_fee_inr: number; max_guests: number; bedrooms: number; bathrooms: number; amenities: string[]; house_rules: string[]; checkin_start: string; checkin_end: string; checkout_latest: string; is_active: boolean };
type DashboardSettings = Record<string, unknown>;
type DashboardData = {
  today: string;
  stats: { arrivalsToday: number; departuresToday: number; stayingToday: number; upcoming: number; revenueThisMonth: number; confirmedBookings: number; occupancyThisMonth: number };
  properties: DashboardProperty[];
  bookings: AdminBooking[];
  payments: AdminPayment[];
  conversations: Array<{ id: string; unread_count?: number }>;
  settings: DashboardSettings;
  seasonalRates: Array<{ id: string; property_id: string; range: string; nightly_rate_inr: number; label: string; properties: { name: string; slug: string } | null }>;
  blockedDates: Array<{ id: string; property_id: string; range: string; reason: string; properties: { name: string; slug: string } | null }>;
  error?: string;
};
type Tab = "overview" | "properties" | "images" | "bookings" | "guests" | "calendar" | "chat" | "payments" | "settings";
const navigation: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "overview", label: "Overview", icon: LayoutDashboard }, { id: "properties", label: "Properties", icon: MapPin },
  { id: "images", label: "Image manager", icon: Activity }, { id: "bookings", label: "Bookings", icon: CheckCheck },
  { id: "guests", label: "Guest list", icon: UsersRound }, { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "chat", label: "Chat inbox", icon: MessageCircle }, { id: "payments", label: "Payments", icon: CircleDollarSign },
  { id: "settings", label: "Settings", icon: Settings2 }
];

export function AdminDashboard({ adminEmail }: { adminEmail: string }) {
  const { getToken, signOut } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [propertyId, setPropertyId] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
    const result = await response.json().catch(() => null) as DashboardData | null;
    if (!response.ok || !result) { setError(result?.error ?? "Host desk data could not load."); setBusy(false); return; }
    setData(result);
    setPropertyId((current) => current || result.properties?.[0]?.id || "");
    setError(""); setBusy(false);
  }, []);

  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 15000); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => {
    let client: ReturnType<typeof getClerkSupabaseBrowserClient> | null = null;
    let cancelled = false;
    const connect = async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        client = getClerkSupabaseBrowserClient(token);
        if (!client) return;
        await client.realtime.setAuth(token);
        const channel = client.channel("admin:dashboard")
          .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => void refresh())
          .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void refresh())
          .on("postgres_changes", { event: "*", schema: "public", table: "payments" }, () => void refresh())
          .subscribe();
        void channel;
      } catch { /* Polling remains available if the Clerk Supabase JWT template is not set up. */ }
    };
    void connect();
    return () => { cancelled = true; if (client) void client.removeAllChannels(); };
  }, [getToken, refresh]);

  const selectedProperty = data?.properties.find((property) => property.id === propertyId);
  return <main className="min-h-[100svh] bg-paper text-ink">
    <header className="sticky top-0 z-30 flex h-[68px] items-center justify-between border-b border-ink/10 bg-paper/95 px-4 backdrop-blur md:px-8"><Link href="/" className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full border border-laterite font-display text-xl text-laterite">O</span><span><span className="block font-display text-lg">Odisha Retreat</span><span className="eyebrow block !text-[.5rem] text-ink/40">Host desk</span></span></Link><div className="flex items-center gap-3"><span className="hidden text-xs text-ink/50 md:block">{adminEmail}</span><button className="grid h-10 w-10 place-items-center border border-ink/15 hover:border-laterite hover:text-laterite" title="Sign out" onClick={() => void signOut({ redirectUrl: "/admin" })}><LogOut size={15} /></button></div></header>
    <div className="mx-auto grid max-w-[1600px] md:grid-cols-[230px_1fr]"><aside className="sticky top-[68px] z-20 overflow-x-auto border-b border-ink/10 bg-paper p-2 md:h-[calc(100svh-68px)] md:overflow-y-auto md:border-b-0 md:border-r md:p-4"><nav className="flex gap-1 md:grid" aria-label="Host desk sections">{navigation.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex shrink-0 items-center gap-3 px-3 py-2.5 text-left text-xs transition ${tab === id ? "bg-ink text-paper" : "text-ink/60 hover:bg-[#e9e1d2] hover:text-ink"}`}><Icon size={15} />{label}{id === "chat" && data?.conversations.some((conversation) => (conversation.unread_count ?? 0) > 0) && <span className="ml-auto h-2 w-2 rounded-full bg-laterite" />}</button>)}</nav><div className="mt-7 hidden border-t border-ink/10 pt-4 md:block"><p className="eyebrow text-ink/35">The four stays</p>{data?.properties.map((property) => <button key={property.id} onClick={() => { setPropertyId(property.id); setTab("properties"); }} className={`mt-2 block w-full border-l-2 py-1.5 pl-3 text-left text-xs ${property.id === propertyId ? "border-laterite text-laterite" : "border-transparent text-ink/50"}`}>{property.name} · {property.district}</button>)}</div></aside>
      <section className="min-w-0 px-4 py-6 md:px-8 md:py-8"><div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-end"><div><p className="eyebrow text-laterite">{data?.today ? new Date(`${data.today}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", month: "long", day: "numeric" }) : "Your properties, your guests"}</p><h1 className="mt-2 font-display text-4xl md:text-5xl">{navigation.find((item) => item.id === tab)?.label}</h1></div>{data && <button onClick={() => void refresh()} className="button-outline !min-h-9 w-fit !px-3 !text-[11px]">Refresh desk <Activity size={13} /></button>}</div>
        {error && <p role="alert" className="mb-5 border border-laterite/20 bg-[#f0e0d8] p-3 text-xs text-laterite">{error}</p>}
        {busy && !data ? <div className="grid min-h-[320px] place-items-center"><p className="text-sm text-ink/50">Opening the host desk…</p></div> : data && <>
          {tab === "overview" && <Overview data={data} onTab={setTab} />}
          {tab === "properties" && <AdminPropertyManager properties={data.properties} seasonalRates={data.seasonalRates} />}
          {tab === "images" && <div><label className="mb-5 flex max-w-md items-center gap-3 text-xs">Choose stay<select value={propertyId} onChange={(event) => setPropertyId(event.target.value)} className="h-11 flex-1 border border-ink/15 bg-[#fbf8f1] px-3 text-sm">{data.properties.map((property) => <option key={property.id} value={property.id}>{property.name} · {property.district}</option>)}</select></label>{propertyId && <AdminImageManager key={propertyId} propertyId={propertyId} />}</div>}
          {tab === "bookings" && <AdminBookingManager bookings={data.bookings} properties={data.properties} />}
          {tab === "guests" && <AdminGuestList bookings={data.bookings} today={data.today} />}
          {tab === "calendar" && <AdminCalendar bookings={data.bookings} blockedDates={data.blockedDates} properties={data.properties} />}
          {tab === "chat" && <AdminChatInbox />}
          {tab === "payments" && <AdminPayments payments={data.payments} bookings={data.bookings} />}
          {tab === "settings" && <AdminSettingsPanel settings={data.settings} />}
        </>}
      </section>
    </div>
    <footer className="border-t border-ink/10 px-5 py-4 text-center text-[10px] text-ink/40 md:ml-[230px]">One owner, four stays · {selectedProperty?.name ?? "Odisha Retreat"}</footer>
  </main>;
}

function Overview({ data, onTab }: { data: DashboardData; onTab: (tab: Tab) => void }) {
  const cards = [
    { label: "Arriving today", value: data.stats.arrivalsToday, icon: MapPin, hint: `${data.stats.stayingToday} currently staying` },
    { label: "Departing today", value: data.stats.departuresToday, icon: Clock3, hint: `${data.stats.upcoming} upcoming stays` },
    { label: "Revenue this month", value: `₹${data.stats.revenueThisMonth.toLocaleString("en-IN")}`, icon: CircleDollarSign, hint: "Payments received" },
    { label: "Occupancy", value: `${data.stats.occupancyThisMonth}%`, icon: Activity, hint: `${data.stats.confirmedBookings} confirmed stays` }
  ];
  const todayArrivals = data.bookings.filter((booking) => booking.checkin_date === data.today && booking.status === "confirmed");
  const todayDepartures = data.bookings.filter((booking) => booking.checkout_date === data.today && booking.status === "confirmed");
  return <div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, hint }) => <article key={label} className="border border-ink/10 bg-[#fbf8f1] p-4"><div className="flex items-center justify-between"><p className="eyebrow text-ink/45">{label}</p><Icon size={16} className="text-laterite" /></div><p className="mt-4 font-display text-4xl">{value}</p><p className="mt-2 text-[11px] text-ink/45">{hint}</p></article>)}</div><div className="mt-8 grid gap-6 xl:grid-cols-[1fr_1fr_300px]"><GuestToday title="Arriving today" bookings={todayArrivals} empty="No one arriving today." /><GuestToday title="Departing today" bookings={todayDepartures} empty="No one departing today." /><aside className="border border-ink/10 bg-[#e9e1d2] p-5"><p className="eyebrow text-laterite">Four homes, one host</p><h2 className="mt-2 font-display text-3xl">The day, at a glance.</h2><p className="mt-3 text-xs leading-5 text-ink/60">Check arrival times and any notes from guests before setting off.</p><button onClick={() => onTab("guests")} className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-laterite">Open guest list <UsersRound size={14} /></button><button onClick={() => onTab("chat")} className="mt-4 flex items-center gap-2 text-xs font-semibold text-laterite">Open messages <MessageCircle size={14} /></button></aside></div><div className="mt-8"><p className="eyebrow text-laterite">The full collection</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{data.properties.map((property, index) => <article key={property.id} className="border-t-2 border-laterite bg-[#fbf8f1] p-4"><p className="font-display text-3xl">0{index + 1}</p><h3 className="mt-2 font-display text-xl">{property.name}</h3><p className="mt-1 text-xs text-ink/50">{property.district} · ₹{property.base_price_inr.toLocaleString("en-IN")} / night</p><p className="mt-3 text-[10px] uppercase tracking-widest text-lagoon">{property.is_active ? "Taking bookings" : "Hidden from guests"}</p></article>)}</div></div></div>;
}

function GuestToday({ title, bookings, empty }: { title: string; bookings: AdminBooking[]; empty: string }) {
  return <section className="border border-ink/10 bg-[#fbf8f1]"><div className="flex items-center justify-between border-b border-ink/10 px-4 py-3"><h2 className="font-display text-2xl">{title}</h2><span className="font-display text-xl text-laterite">{bookings.length}</span></div>{bookings.length ? bookings.map((booking) => <article key={booking.id} className="flex items-start justify-between gap-4 border-b border-ink/5 px-4 py-3 last:border-0"><div><p className="font-semibold text-sm">{booking.profiles?.full_name || "Guest"}</p><p className="mt-1 text-xs text-ink/50">{booking.properties?.name} · {booking.expected_arrival_time?.slice(0, 5) ?? "—"}</p><p className="mt-1 text-[10px] text-ink/45">{booking.profiles?.phone ?? "Phone not provided"}</p><a className="mt-1 block text-[10px] text-laterite" href={`mailto:${booking.guest_email ?? ""}`}>{booking.guest_email}</a></div><span className="text-[10px] text-lagoon">{booking.guests} guests</span></article>) : <p className="px-4 py-6 text-xs text-ink/45">{empty}</p>}</section>;
}
