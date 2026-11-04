import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({ bookingId: z.string().uuid(), requestType: z.enum(["checkin", "checkout"]), requestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) });

export async function POST(request: Request) {
  const guest = await getSupabaseServerClient();
  const service = getSupabaseServiceClient();
  if (!guest || !service) return NextResponse.json({ error: "Messaging is not configured." }, { status: 503 });
  const { data: { user } } = await guest.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to message your host." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a valid custom time." }, { status: 400 });
  const { bookingId, requestType, requestedTime } = parsed.data;
  const { data: booking } = await guest.from("bookings").select("id,guest_id,property_id,expected_arrival_time,custom_checkin_time,custom_checkout_time,status").eq("id", bookingId).eq("guest_id", user.id).maybeSingle();
  if (!booking || !["held", "confirmed"].includes(booking.status)) return NextResponse.json({ error: "This booking cannot accept a time request." }, { status: 404 });
  const currentTime = requestType === "checkin" ? booking.custom_checkin_time ?? booking.expected_arrival_time : booking.custom_checkout_time ?? "09:00";
  if (requestedTime === currentTime) return NextResponse.json({ error: "That is already the time on your booking." }, { status: 400 });
  let { data: conversation } = await service.from("conversations").select("id").eq("booking_id", booking.id).maybeSingle();
  if (!conversation) {
    const { data: created, error } = await service.from("conversations").insert({ guest_id: user.id, property_id: booking.property_id, booking_id: booking.id, subject: "A note about your arrival time" }).select("id").single();
    if (error?.code === "23505") {
      const result = await service.from("conversations").select("id").eq("booking_id", booking.id).single(); conversation = result.data;
    } else if (error || !created) return NextResponse.json({ error: "We could not open a conversation." }, { status: 500 });
    else conversation = created;
  }
  if (!conversation) return NextResponse.json({ error: "We could not open a conversation." }, { status: 500 });
  const conversationId = conversation.id;
  const label = requestType === "checkin" ? "check-in" : "check-out";
  const { error: messageError } = await service.from("messages").insert({
    conversation_id: conversationId, sender_role: "guest", sender_id: user.id,
    body: `Could I request a custom ${label} time of ${requestedTime}?`, kind: "time_request",
    meta: { request_type: requestType, requested_time: requestedTime, status: "pending", booking_id: booking.id }
  });
  if (messageError) return NextResponse.json({ error: "Your request could not be sent." }, { status: 500 });
  await service.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  return NextResponse.json({ conversationId }, { status: 201 });
}
