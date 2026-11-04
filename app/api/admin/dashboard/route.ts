import { NextResponse } from "next/server";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

function indiaDate(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export async function GET(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const today = indiaDate(new Date());
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const [{ data: properties }, { data: bookings }, { data: payments }, { data: conversations }, { data: settings }, { data: seasonalRates }, { data: blockedDates }] = await Promise.all([
    service.from("properties").select("id,slug,name,tagline,description,lat,lng,address,district,base_price_inr,cleaning_fee_inr,max_guests,bedrooms,bathrooms,amenities,house_rules,checkin_start,checkin_end,checkout_latest,is_active,created_at").order("created_at"),
    service.from("bookings").select("id,property_id,guest_id,checkin_date,checkout_date,expected_arrival_time,custom_checkin_time,custom_checkout_time,guests,status,subtotal_inr,taxes_inr,total_inr,amount_paid_inr,hold_expires_at,created_at,properties(name,slug,district),profiles(full_name,phone)").order("checkin_date").limit(1000),
    service.from("payments").select("id,booking_id,razorpay_order_id,razorpay_payment_id,status,amount_inr,refunded_inr,method,created_at").order("created_at", { ascending: false }).limit(500),
    service.from("conversations").select("id,guest_id,property_id,booking_id,subject,status,last_message_at,created_at,profiles(full_name),properties(name,slug)").order("last_message_at", { ascending: false }).limit(200),
    service.from("admin_settings").select("key,value"),
    service.from("seasonal_rates").select("id,property_id,range,nightly_rate_inr,label,properties(name,slug)").order("range"),
    service.from("blocked_dates").select("id,property_id,range,reason,properties(name,slug)").order("range")
  ]);
  if (!bookings) return NextResponse.json({ error: "Could not load the host desk." }, { status: 500 });
  const guestIds = [...new Set(bookings.map((booking) => booking.guest_id))];
  const { data: userPage } = await service.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const relevantGuestIds = new Set(guestIds);
  const guestEmails = new Map((userPage?.users ?? []).filter((user) => user.email && relevantGuestIds.has(user.id)).map((user) => [user.id, user.email!]));
  const bookingsWithEmail = bookings.map((booking) => ({ ...booking, guest_email: guestEmails.get(booking.guest_id) ?? "" }));
  const activeBookings = bookings.filter((booking) => ["confirmed", "completed"].includes(booking.status));
  const monthRevenue = activeBookings.filter((booking) => booking.created_at >= firstOfMonth).reduce((sum, booking) => sum + booking.amount_paid_inr, 0);
  const stats = {
    arrivalsToday: bookingsWithEmail.filter((booking) => booking.status === "confirmed" && booking.checkin_date === today).length,
    departuresToday: bookingsWithEmail.filter((booking) => booking.status === "confirmed" && booking.checkout_date === today).length,
    stayingToday: bookingsWithEmail.filter((booking) => booking.status === "confirmed" && booking.checkin_date < today && booking.checkout_date > today).length,
    upcoming: bookingsWithEmail.filter((booking) => booking.status === "confirmed" && booking.checkin_date > today).length,
    revenueThisMonth: monthRevenue,
    confirmedBookings: activeBookings.length,
    occupancyThisMonth: calculateOccupancy(bookingsWithEmail, properties ?? [], today.slice(0, 7))
  };
  return NextResponse.json({ today, stats, properties: properties ?? [], bookings: bookingsWithEmail, payments: payments ?? [], conversations: conversations ?? [], seasonalRates: seasonalRates ?? [], blockedDates: blockedDates ?? [], settings: Object.fromEntries((settings ?? []).map((setting) => [setting.key, setting.value])) });
}

function calculateOccupancy(bookings: Array<{ property_id: string; checkin_date: string; checkout_date: string; status: string }>, properties: Array<{ id: string }>, month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const start = new Date(Date.UTC(year, monthNumber - 1, 1));
  const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const bookedNights = bookings.filter((booking) => booking.status === "confirmed").reduce((total, booking) => {
    const first = new Date(`${booking.checkin_date}T00:00:00Z`);
    const last = new Date(`${booking.checkout_date}T00:00:00Z`);
    for (let day = 0; day < days; day++) { const current = new Date(start); current.setUTCDate(current.getUTCDate() + day); if (current >= first && current < last) total += 1; }
    return total;
  }, 0);
  return properties.length ? Math.round(bookedNights / (properties.length * days) * 100) : 0;
}
