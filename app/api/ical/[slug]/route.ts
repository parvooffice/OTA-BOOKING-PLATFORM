import { getSupabaseServiceClient } from "@/lib/supabase/server";

function icalDate(value: string) { return value.replaceAll("-", ""); }
function escapeIcal(value: string) { return value.replaceAll("\\", "\\\\").replaceAll(",", "\\,").replaceAll(";", "\\;").replaceAll("\n", "\\n"); }

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = getSupabaseServiceClient();
  if (!supabase) return new Response("Calendar is not configured", { status: 503 });
  const { data: property } = await supabase.from("properties").select("id,name").eq("slug", slug).eq("is_active", true).maybeSingle();
  if (!property) return new Response("Not found", { status: 404 });
  const [{ data: bookings }, { data: blocks }] = await Promise.all([
    supabase.from("bookings").select("id,checkin_date,checkout_date").eq("property_id", property.id).in("status", ["held", "confirmed"]).or(`status.eq.confirmed,hold_expires_at.gt.${new Date().toISOString()}`),
    supabase.from("blocked_dates").select("range").eq("property_id", property.id)
  ]);
  const events = (bookings ?? []).map((booking) => `BEGIN:VEVENT\r\nUID:${booking.id}@odisharetreat.com\r\nDTSTAMP:${icalDate(new Date().toISOString().slice(0, 10))}T000000Z\r\nDTSTART;VALUE=DATE:${icalDate(booking.checkin_date)}\r\nDTEND;VALUE=DATE:${icalDate(booking.checkout_date)}\r\nSUMMARY:Reserved\r\nEND:VEVENT`);
  for (const block of blocks ?? []) {
    const match = /^\[(\d{4}-\d{2}-\d{2}),(\d{4}-\d{2}-\d{2})\)$/.exec(block.range);
    if (match) events.push(`BEGIN:VEVENT\r\nUID:${slug}-${match[1]}@odisharetreat.com\r\nDTSTAMP:${icalDate(new Date().toISOString().slice(0, 10))}T000000Z\r\nDTSTART;VALUE=DATE:${icalDate(match[1])}\r\nDTEND;VALUE=DATE:${icalDate(match[2])}\r\nSUMMARY:Unavailable\r\nEND:VEVENT`);
  }
  const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Odisha Retreat//Property Calendar//EN", "CALSCALE:GREGORIAN", `X-WR-CALNAME:${escapeIcal(property.name)}`, ...events, "END:VCALENDAR"].join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": `attachment; filename="${slug}.ics"`, "Cache-Control": "no-store" } });
}
