import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { getSupabaseServerClient, getSupabaseServiceClient } from "@/lib/supabase/server";

const schema = z.object({ conversationId: z.string().uuid(), body: z.string().max(10000).default(""), attachments: z.array(z.object({ path: z.string().max(500), name: z.string().max(200) })).max(8).default([]) }).refine((message) => message.body.trim().length > 0 || message.attachments.length > 0);

export async function POST(request: Request) {
  const guest = await getSupabaseServerClient(); const service = getSupabaseServiceClient();
  if (!guest || !service) return NextResponse.json({ error: "Messaging is not configured." }, { status: 503 });
  const { data: { user } } = await guest.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to write to your host." }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a note before sending." }, { status: 400 });
  const { data: conversation } = await guest.from("conversations").select("id,guest_id,subject,properties(name)").eq("id", parsed.data.conversationId).eq("guest_id", user.id).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  if (parsed.data.attachments.some((file) => !file.path.startsWith(`${conversation.id}/`))) return NextResponse.json({ error: "Attachment does not belong to this conversation." }, { status: 400 });
  const { error } = await service.from("messages").insert({ conversation_id: conversation.id, sender_role: "guest", sender_id: user.id, body: parsed.data.body.trim(), attachments: parsed.data.attachments, kind: "text" });
  if (error) return NextResponse.json({ error: "Your note could not be sent." }, { status: 500 });
  await service.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversation.id);
  if (process.env.RESEND_API_KEY && process.env.ADMIN_EMAILS) {
    const property = conversation.properties as unknown as { name: string } | null;
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.BOOKING_FROM_EMAIL || "Odisha Retreat <bookings@odisharetreat.com>",
      to: process.env.ADMIN_EMAILS.split(",").map((email) => email.trim()).filter(Boolean),
      subject: `A guest wrote to you · ${property?.name ?? "Odisha Retreat"}`,
      html: `<p>${escapeHtml(user.email ?? "A guest")} sent a note${property?.name ? ` about ${escapeHtml(property.name)}` : ""}.</p><p>${escapeHtml(parsed.data.body.slice(0, 500))}</p><p><a href="${process.env.NEXT_PUBLIC_SITE_URL || "https://odisharetreat.com"}/admin">Open the host inbox</a></p>`
    });
  }
  return NextResponse.json({ sent: true }, { status: 201 });
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
