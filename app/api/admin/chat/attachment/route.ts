import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getAdminIdentityForRequest } from "@/lib/clerk-admin";
import { getSupabaseServiceClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (!await getAdminIdentityForRequest(request)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const service = getSupabaseServiceClient();
  if (!service) return NextResponse.json({ error: "Database is not configured." }, { status: 503 });
  const form = await request.formData();
  const conversationId = form.get("conversationId"); const file = form.get("file");
  if (typeof conversationId !== "string" || !(file instanceof File) || !file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Choose an image under 8 MB." }, { status: 400 });
  const { data: conversation } = await service.from("conversations").select("id").eq("id", conversationId).maybeSingle();
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  const path = `${conversationId}/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const { error } = await service.storage.from("chat-attachments").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: "Image could not be uploaded." }, { status: 500 });
  return NextResponse.json({ path, name: file.name }, { status: 201 });
}
