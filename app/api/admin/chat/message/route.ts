import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({ conversationId: z.string().uuid(), body: z.string().max(10000).default(""), attachments: z.array(z.object({ path: z.string(), name: z.string() })).max(8).default([]), kind: z.enum(["text", "system"]).default("text") }).refine((body) => body.body.trim().length > 0 || body.attachments.length > 0);

export async function POST(request: Request) {
  const identity = await getAdminIdentityForRequest(request);
  if (!identity) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first." }, { status: 400 });
  const { data: message, error } = await service.from("messages").insert({ conversation_id: parsed.data.conversationId, sender_role: "admin", sender_id: identity.userId, body: parsed.data.body, attachments: parsed.data.attachments, kind: parsed.data.kind }).select("id").single();
  if (error) return NextResponse.json({ error: "Message could not be sent." }, { status: 500 });
  await service.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", parsed.data.conversationId);
  const { data: conversation } = await service.from("conversations").select("guest_id,subject,properties(name)").eq("id", parsed.data.conversationId).single();
  if (conversation && process.env.RESEND_API_KEY) {
    const { data: guest } = await service.auth.admin.getUserById(conversation.guest_id);
    if (guest.user?.email) {
      const property = conversation.properties as unknown as { name: string } | null;
      const resend = new Resend(process.env.RESEND_API_KEY);
      await resend.emails.send({ from: process.env.BOOKING_FROM_EMAIL || "Odisha Retreat <bookings@odisharetreat.com>", to: guest.user.email, subject: `A note from your host · Odisha Retreat`, html: `<p>Your host sent you a message${property?.name ? ` about ${escapeHtml(property.name)}` : ""}.</p><p>${escapeHtml(parsed.data.body.slice(0, 400))}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://odisharetreat.com"}/account">Open your conversation</a></p>` });
    }
  }
  return NextResponse.json({ messageId: message.id }, { status: 201 });
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
