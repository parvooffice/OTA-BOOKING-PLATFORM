import { NextResponse } from "next/server";
import { createInvoicePdf } from "@/lib/invoice";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(_request: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const supabase = await getSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Invoice service is not configured." }, { status: 503 });
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your invoice." }, { status: 401 });
  const { data: booking } = await supabase.from("bookings").select("id,guest_id,created_at,checkin_date,checkout_date,guests,subtotal_inr,taxes_inr,total_inr,amount_paid_inr,properties(name,district)").eq("id", bookingId).eq("guest_id", user.id).maybeSingle();
  if (!booking) return NextResponse.json({ error: "Invoice not found." }, { status: 404 });
  const service = getSupabaseServiceClient();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    service ? service.from("admin_settings").select("key,value").in("key", ["invoice_legal_name", "invoice_gstin", "invoice_address", "gst_percent"]) : Promise.resolve({ data: [] })
  ]);
  const relation = (booking as unknown as { properties: { name: string; district: string } | null }).properties;
  const settingsMap = Object.fromEntries((settings ?? []).map((item) => [item.key, item.value]));
  const pdf = await createInvoicePdf({ ...booking, guestName: profile?.full_name ?? "", guestEmail: user.email ?? "", propertyName: relation?.name ?? "Odisha Retreat stay", district: relation?.district ?? "Odisha", legalName: String(settingsMap.invoice_legal_name ?? ""), gstin: String(settingsMap.invoice_gstin ?? ""), legalAddress: String(settingsMap.invoice_address ?? ""), gstPercent: Number(settingsMap.gst_percent ?? 5) });
  return new NextResponse(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="Odisha-Retreat-invoice-${bookingId.slice(0, 8)}.pdf"`, "Cache-Control": "private, no-store" } });
}
