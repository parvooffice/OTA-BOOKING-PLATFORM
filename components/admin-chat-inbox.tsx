"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, MessageCircle, Send, UserRound } from "lucide-react";
import { getClerkSupabaseBrowserClient } from "@/lib/supabase/clerk-browser";

type Thread = { id: string; guest_id: string; subject: string; status: string; last_message_at: string; unread_count: number; profiles: { full_name: string; phone: string | null } | null; properties: { name: string; slug: string } | null; booking_id: string | null };
type Message = { id: string; conversation_id: string; sender_role: "guest" | "admin"; body: string; attachments: { path: string; name: string }[]; kind: string; meta: Record<string, unknown>; read_at: string | null; created_at: string };

export function AdminChatInbox() {
  const { getToken } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fee, setFee] = useState(0);
  const [busy, setBusy] = useState(false);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<NonNullable<ReturnType<typeof getClerkSupabaseBrowserClient>>["channel"]> | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadThreads = useCallback(async () => {
    const response = await fetch("/api/admin/chat", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json(); setThreads(data.conversations ?? []);
    if (!activeId && data.conversations?.length) setActiveId(data.conversations[0].id);
  }, [activeId]);
  const loadMessages = useCallback(async (id: string) => {
    const response = await fetch(`/api/admin/chat?conversationId=${encodeURIComponent(id)}`, { cache: "no-store" });
    if (response.ok) { const data = await response.json(); setMessages(data.messages ?? []); }
  }, []);

  useEffect(() => { void loadThreads(); const timer = setInterval(() => void loadThreads(), 15000); return () => clearInterval(timer); }, [loadThreads]);
  useEffect(() => { if (activeId) void loadMessages(activeId); }, [activeId, loadMessages]);
  useEffect(() => {
    let client: ReturnType<typeof getClerkSupabaseBrowserClient> | null = null;
    let cancelled = false;
    const connect = async () => {
      try {
        const token = await getToken({ template: "supabase" });
        if (!token || cancelled) return;
        client = getClerkSupabaseBrowserClient(token);
        if (!client) return;
        await client.realtime.setAuth(token);
        const channel = client.channel("admin:chat")
          .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => { const conversationId = (payload.new as { conversation_id?: string })?.conversation_id; if (conversationId) { void loadThreads(); if (conversationId === activeId) void loadMessages(conversationId); } })
          .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => void loadThreads())
          .subscribe();
        if (activeId) channelRef.current = client.channel(`conversation:${activeId}`).on("broadcast", { event: "typing" }, ({ payload }) => setTyping(payload?.sender_role === "guest" && payload?.typing === true)).subscribe();
        void channel;
      } catch { /* The REST inbox continues to refresh if the Clerk JWT template is not configured. */ }
    };
    void connect();
    return () => { cancelled = true; channelRef.current = null; if (client) void client.removeAllChannels(); };
  }, [activeId, getToken, loadMessages, loadThreads]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  function announceTyping() {
    const channel = channelRef.current;
    if (!channel) return;
    void channel.send({ type: "broadcast", event: "typing", payload: { sender_role: "admin", typing: true } });
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { void channel.send({ type: "broadcast", event: "typing", payload: { sender_role: "admin", typing: false } }); }, 1200);
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault(); if (!activeId || (!body.trim() && !file)) return;
    setBusy(true); setError("");
    let attachments: { path: string; name: string }[] = [];
    if (file) {
      const form = new FormData(); form.set("conversationId", activeId); form.set("file", file);
      const upload = await fetch("/api/admin/chat/attachment", { method: "POST", body: form });
      const result = await upload.json().catch(() => ({}));
      if (!upload.ok) { setError(result.error ?? "Image could not be uploaded."); setBusy(false); return; }
      attachments = [result];
    }
    const response = await fetch("/api/admin/chat/message", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: activeId, body: body.trim(), attachments }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Message could not be sent.");
    else { setBody(""); setFile(null); void loadMessages(activeId); void loadThreads(); }
    setBusy(false);
  }

  async function respondToTime(message: Message, decision: "approved" | "declined") {
    setBusy(true); setError("");
    const response = await fetch("/api/admin/chat/time-response", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId: message.id, decision, feeInr: decision === "approved" ? fee : 0 }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) setError(result.error ?? "Time request could not be updated.");
    else { setFee(0); if (activeId) { await loadMessages(activeId); void loadThreads(); } }
    setBusy(false);
  }

  const active = threads.find((thread) => thread.id === activeId);
  return <div className="grid min-h-[620px] overflow-hidden border border-ink/15 bg-[#fbf8f1] md:grid-cols-[280px_1fr]"><aside className="border-b border-ink/10 md:border-b-0 md:border-r"><div className="flex items-center justify-between px-4 py-4"><div><p className="eyebrow text-laterite">One-to-one notes</p><h2 className="mt-1 font-display text-2xl">Host inbox</h2></div><MessageCircle className="text-laterite" /></div><div className="max-h-[240px] overflow-y-auto md:max-h-[560px]">{threads.map((thread) => <button key={thread.id} onClick={() => setActiveId(thread.id)} className={`flex w-full items-start gap-3 border-t border-ink/10 p-4 text-left ${activeId === thread.id ? "bg-[#f0e0d8]" : "hover:bg-paper"}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#e6d9c5] text-laterite"><UserRound size={16} /></span><span className="min-w-0 flex-1"><span className="flex justify-between gap-2"><span className="truncate text-sm font-semibold">{thread.profiles?.full_name || "Guest"}</span>{thread.unread_count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-laterite px-1 text-[10px] text-white">{thread.unread_count}</span>}</span><span className="mt-1 block truncate text-xs text-ink/50">{thread.properties?.name ?? thread.subject}</span><span className="mt-1 block text-[10px] text-ink/40">{new Date(thread.last_message_at).toLocaleDateString()}</span></span></button>)}{threads.length === 0 && <p className="p-5 text-xs text-ink/50">When a guest writes, they’ll appear here.</p>}</div></aside>
    <section className="flex min-h-[620px] min-w-0 flex-col"><div className="flex items-center justify-between border-b border-ink/10 px-4 py-3"><div><p className="eyebrow text-laterite">{active?.properties?.name ?? "Guest conversation"}</p><p className="mt-1 font-display text-xl">{active?.profiles?.full_name ?? "Choose a message"}</p></div>{active?.profiles?.phone && <a href={`https://wa.me/${active.profiles.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="button-outline !min-h-9 !px-3 !text-[11px]">Open WhatsApp ↗</a>}</div><div ref={listRef} className="flex min-h-[300px] flex-1 flex-col gap-3 overflow-y-auto p-4">{messages.map((message) => <div key={message.id} className={`max-w-[85%] ${message.sender_role === "admin" ? "self-end" : "self-start"}`}><div className={`px-4 py-3 text-sm leading-6 ${message.sender_role === "admin" ? "bg-[#e6d9c5]" : "bg-[#f0e0d8]"}`}>{message.kind === "time_request" && <div className="mb-3 border-b border-ink/10 pb-3"><p className="eyebrow text-laterite">Custom time request</p><p className="mt-1 text-sm">{String(message.meta.request_type)} · {String(message.meta.requested_time)}</p>{message.meta.status === "pending" ? <div className="mt-3 flex flex-wrap items-end gap-2"><label className="grid gap-1 text-[10px]">Optional fee (₹)<input type="number" min={0} value={fee} onChange={(event) => setFee(Number(event.target.value))} className="h-9 w-24 border border-ink/15 bg-paper px-2 text-xs" /></label><button onClick={() => void respondToTime(message, "approved")} disabled={busy} className="button-ink !min-h-9 !px-3 !text-[11px]">Approve</button><button onClick={() => void respondToTime(message, "declined")} disabled={busy} className="button-outline !min-h-9 !px-3 !text-[11px]">Decline</button></div> : <p className="mt-2 text-xs text-lagoon">{String(message.meta.status)}</p>}</div>}{message.body && <p>{message.body}</p>}{message.attachments?.map((attachment) => <AdminAttachment key={attachment.path} path={attachment.path} name={attachment.name} />)}</div><p className="mt-1 text-[10px] text-ink/40">{message.sender_role === "guest" ? "Guest" : "You"} · {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></div>)}{typing && <p className="text-xs italic text-ink/45">Guest is writing…</p>}{messages.length === 0 && <p className="m-auto text-center font-display text-xl text-ink/40">A quiet inbox, for now.</p>}</div>
    <div className="flex flex-wrap gap-2 border-t border-ink/10 px-3 py-2">{["Early check-in approved", "We’ll have the kettle on", "Thanks for writing — we’ll get back to you soon"].map((reply) => <button key={reply} onClick={() => setBody(reply)} className="border border-ink/15 px-2 py-1 text-[10px] text-ink/55 hover:border-laterite hover:text-laterite">{reply}</button>)}</div><form onSubmit={sendMessage} className="border-t border-ink/10 p-3"><textarea value={body} onChange={(event) => { setBody(event.target.value); announceTyping(); }} disabled={!activeId} rows={2} maxLength={10000} placeholder="Write a thoughtful reply…" className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none" />{file && <p className="px-2 text-[10px] text-ink/50">{file.name}</p>}{error && <p role="alert" className="px-2 pb-2 text-xs text-laterite">{error}</p>}<div className="flex items-center justify-between"><label className="flex cursor-pointer items-center gap-2 px-2 py-2 text-xs text-ink/55 hover:text-laterite"><ImagePlus size={15} /> Add image<input type="file" accept="image/*" className="sr-only" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label><button disabled={busy || !activeId || (!body.trim() && !file)} className="button-ink !min-h-10 disabled:opacity-40">{busy ? <LoaderCircle size={14} className="animate-spin" /> : <Send size={14} />} Send</button></div></form></section></div>;
}

function AdminAttachment({ path, name }: { path: string; name: string }) {
  const { getToken } = useAuth();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { void getToken({ template: "supabase" }).then((token) => { if (!token) return; const client = getClerkSupabaseBrowserClient(token); if (client) void client.storage.from("chat-attachments").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null)); }); }, [getToken, path]);
  return url ? <a href={url} target="_blank" rel="noreferrer" className="mt-2 block text-xs underline">{name}</a> : <span className="mt-2 block text-xs text-ink/50">{name}</span>;
}
