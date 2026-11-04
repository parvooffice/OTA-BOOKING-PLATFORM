import { NextResponse } from "next/server";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const conversationId = new URL(request.url).searchParams.get("conversationId");
  if (!conversationId) {
    const { data, error } = await service.from("conversations").select("id,guest_id,property_id,booking_id,subject,status,last_message_at,created_at,profiles(full_name,phone),properties(name,slug)").order("last_message_at", { ascending: false }).limit(200);
    if (error) return NextResponse.json({ error: "Could not load the inbox." }, { status: 500 });
    const ids = (data ?? []).map((item) => item.id);
    const { data: unread } = ids.length ? await service.from("messages").select("conversation_id").in("conversation_id", ids).eq("sender_role", "guest").is("read_at", null) : { data: [] };
    const unreadCounts = (unread ?? []).reduce((counts: Record<string, number>, item) => { counts[item.conversation_id] = (counts[item.conversation_id] ?? 0) + 1; return counts; }, {});
    return NextResponse.json({ conversations: (data ?? []).map((item) => ({ ...item, unread_count: unreadCounts[item.id] ?? 0 })) });
  }
  const { data: messages, error } = await service.from("messages").select("id,conversation_id,sender_role,sender_id,body,attachments,kind,meta,read_at,created_at").eq("conversation_id", conversationId).order("created_at").limit(500);
  if (error) return NextResponse.json({ error: "Could not load conversation." }, { status: 500 });
  const unreadIds = (messages ?? []).filter((message) => message.sender_role === "guest" && !message.read_at).map((message) => message.id);
  if (unreadIds.length) await service.from("messages").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
  return NextResponse.json({ messages: messages ?? [] });
}
