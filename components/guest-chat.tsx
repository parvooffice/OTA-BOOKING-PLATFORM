"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Send } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Message = { id: string; sender_role: "guest" | "admin"; body: string; attachments: { path: string; name: string }[]; kind: string; meta: Record<string, unknown>; created_at: string; read_at: string | null };

export function GuestChat({ conversationId }: { conversationId: string }) {
  const supabase = getSupabaseBrowserClient();
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [hostTyping, setHostTyping] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const channelRef = useRef<ReturnType<NonNullable<typeof supabase>["channel"]> | null>(null);

  useEffect(() => {
    if (!supabase) return;
    let mounted = true;
    const refresh = async () => {
      const { data } = await supabase.from("messages").select("id,sender_role,body,attachments,kind,meta,created_at,read_at").eq("conversation_id", conversationId).order("created_at");
      if (!mounted || !data) return;
      setMessages(data as Message[]);
      const unread = data.filter((message) => message.sender_role === "admin" && !message.read_at).map((message) => message.id);
      if (unread.length) await supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", unread);
    };
    void refresh();
    const channel = supabase.channel(`conversation:${conversationId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, () => void refresh())
      .on("broadcast", { event: "typing" }, ({ payload }) => setHostTyping(payload?.sender_role === "admin" && payload?.typing === true))
      .subscribe();
    channelRef.current = channel;
    return () => { mounted = false; channelRef.current = null; if (typingTimer.current) clearTimeout(typingTimer.current); void supabase.removeChannel(channel); };
  }, [conversationId, supabase]);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: "smooth" }); }, [messages, hostTyping]);

  function announceTyping() {
    if (!supabase) return;
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "typing", payload: { sender_role: "guest", typing: true } });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { void channel.send({ type: "broadcast", event: "typing", payload: { sender_role: "guest", typing: false } }); }, 1200);
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault(); if (!supabase || (!body.trim() && files.length === 0)) return;
    setBusy(true);
    const attachments: { path: string; name: string }[] = [];
    for (const file of files) {
      if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) continue;
      const path = `${conversationId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const { error } = await supabase.storage.from("chat-attachments").upload(path, file, { contentType: file.type, upsert: false });
      if (!error) attachments.push({ path, name: file.name });
    }
    const response = await fetch("/api/chat/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId, body: body.trim(), attachments }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setBody(`Could not send: ${result.error ?? "please try again"}`);
    else { setBody(""); setFiles([]); }
    setBusy(false);
  }

  if (!supabase) return null;
  return <div className="overflow-hidden border border-ink/15 bg-[#fbf8f1]"><div className="flex items-center justify-between border-b border-ink/10 px-4 py-3"><div><p className="eyebrow text-laterite">A private note to your host</p><p className="mt-1 font-display text-xl">Odisha Retreat</p></div><span className="h-2 w-2 rounded-full bg-lagoon" aria-label="Conversation available" /></div><div ref={list} className="flex max-h-[420px] min-h-[200px] flex-col gap-3 overflow-y-auto p-4">{messages.map((message) => <div key={message.id} className={`max-w-[85%] ${message.sender_role === "guest" ? "self-end" : "self-start"}`}><div className={`px-4 py-3 text-sm leading-6 ${message.sender_role === "guest" ? "bg-[#e6d9c5]" : "bg-[#f0e0d8]"}`}>{message.kind === "time_request" && <p className="mb-2 border-b border-ink/10 pb-2 text-xs font-semibold text-laterite">Custom time request · {String(message.meta.request_type ?? "stay")}</p>}{message.kind === "time_approval" && <p className="mb-2 border-b border-ink/10 pb-2 text-xs font-semibold text-lagoon">Host update · {String(message.meta.status ?? "updated")}{Number(message.meta.fee_inr ?? 0) > 0 ? ` · ${formatINR(Number(message.meta.fee_inr))}` : ""}</p>}{message.body && <p>{message.body}</p>}{message.attachments?.map((attachment) => <AttachmentLink key={attachment.path} path={attachment.path} name={attachment.name} />)}</div><p className="mt-1 text-[10px] text-ink/40">{new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{message.sender_role === "guest" && message.read_at ? " · Seen" : ""}</p></div>)}{hostTyping && <p className="text-xs italic text-ink/45">Your host is writing…</p>}{messages.length === 0 && <p className="m-auto max-w-xs text-center font-display text-xl text-ink/45">A hello is always a good place to start.</p>}</div><form onSubmit={sendMessage} className="border-t border-ink/10 p-3"><textarea value={body} onChange={(event) => { setBody(event.target.value); announceTyping(); }} rows={2} maxLength={10000} placeholder="Write your host a note…" className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none" aria-label="Message to host" />{files.length > 0 && <p className="px-2 text-[11px] text-ink/50">{files.map((file) => file.name).join(", ")}</p>}<div className="flex items-center justify-between"><label className="flex cursor-pointer items-center gap-2 px-2 py-2 text-xs text-ink/55 hover:text-laterite"><ImagePlus size={15} /> Add a photo<input type="file" accept="image/*" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label><button disabled={busy || (!body.trim() && files.length === 0)} className="button-ink !min-h-10 disabled:opacity-40">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Send size={14} />} Send</button></div></form></div>;
}

import { formatINR } from "@/lib/format";

function AttachmentLink({ path, name }: { path: string; name: string }) {
  const client = getSupabaseBrowserClient();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { if (client) void client.storage.from("chat-attachments").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null)); }, [client, path]);
  return url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 block text-xs underline">{name}</a> : <span className="mt-2 block text-xs text-ink/50">{name}</span>;
}
