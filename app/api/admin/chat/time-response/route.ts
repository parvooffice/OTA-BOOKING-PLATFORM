import { NextResponse } from "next/server";
import { z } from "zod";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({ messageId: z.string().uuid(), decision: z.enum(["approved", "declined"]), feeInr: z.number().int().min(0).max(100000).default(0), note: z.string().max(500).default("") });

export async function POST(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Admin database is not configured." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { data: message } = await service.from("messages").select("id,conversation_id,meta,kind").eq("id", parsed.data.messageId).eq("kind", "time_request").maybeSingle();
  if (!message) return NextResponse.json({ error: "Time request not found." }, { status: 404 });
  const metadata = message.meta as { booking_id?: string; request_type?: "checkin" | "checkout"; requested_time?: string; status?: string };
  if (!metadata.booking_id || !metadata.request_type || !metadata.requested_time || metadata.status !== "pending") return NextResponse.json({ error: "This request has already been handled." }, { status: 409 });
  const decision = parsed.data.decision;
  if (decision === "approved") {
    const field = metadata.request_type === "checkin" ? "custom_checkin_time" : "custom_checkout_time";
    const { data: booking } = await service.from("bookings").select("id,total_inr,custom_time_fee_inr").eq("id", metadata.booking_id).maybeSingle();
    if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
    const fee = parsed.data.feeInr;
    const { error } = await service.from("bookings").update({ [field]: metadata.requested_time, custom_time_fee_inr: booking.custom_time_fee_inr + fee, total_inr: booking.total_inr + fee }).eq("id", booking.id);
    if (error) return NextResponse.json({ error: "Could not approve that time." }, { status: 500 });
  }
  await service.from("messages").update({ meta: { ...metadata, status: decision, fee_inr: decision === "approved" ? parsed.data.feeInr : 0, owner_note: parsed.data.note } }).eq("id", message.id);
  const { data: conversation } = await service.from("conversations").select("guest_id").eq("id", message.conversation_id).single();
  const action = decision === "approved" ? `Your custom ${metadata.request_type} time of ${metadata.requested_time} is approved${parsed.data.feeInr ? ` with a ₹${parsed.data.feeInr} fee` : ""}.` : `We’re sorry, we can’t approve ${metadata.requested_time} for ${metadata.request_type}.`;
  await service.from("messages").insert({ conversation_id: message.conversation_id, sender_role: "admin", sender_id: (await getAdminIdentityForRequest(request))?.userId ?? "admin", body: parsed.data.note ? `${action} ${parsed.data.note}` : action, kind: "time_approval", meta: { request_message_id: message.id, status: decision, fee_inr: decision === "approved" ? parsed.data.feeInr : 0 } });
  await service.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", message.conversation_id);
  return NextResponse.json({ status: decision, guestId: conversation?.guest_id });
}
