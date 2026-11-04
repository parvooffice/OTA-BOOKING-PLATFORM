"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { ImagePlus, MessageCircle, Send } from "lucide-react";

type Sender = "guest" | "host";
type PreviewMessage = { id: string; sender: Sender; text: string; time: string; attachments?: string[] };

const storageKey = "odisha-retreat-ui-preview-chat";
const starterMessages: PreviewMessage[] = [
  { id: "welcome", sender: "host", text: "Hello Maya, we’re so glad you found us. Let us know if there’s anything you’d like to know about the stay.", time: "Yesterday · 4:18 pm" },
  { id: "question", sender: "guest", text: "Could you recommend a quiet place for breakfast nearby?", time: "Yesterday · 4:26 pm" },
  { id: "answer", sender: "host", text: "Of course. There’s a little family-run place just around the lane. I’ll leave you a note with directions when you arrive.", time: "Yesterday · 4:31 pm" }
];

export function PreviewChat({ role }: { role: Sender }) {
  const [messages, setMessages] = useState<PreviewMessage[]>(starterMessages);
  const [ready, setReady] = useState(false);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [notice, setNotice] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as PreviewMessage[];
        if (Array.isArray(parsed)) setMessages(parsed);
      }
    } catch {
      localStorage.removeItem(storageKey);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) localStorage.setItem(storageKey, JSON.stringify(messages));
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, ready]);

  function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!text && files.length === 0) return;
    setMessages((current) => [...current, {
      id: crypto.randomUUID(), sender: role, text,
      time: new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      attachments: files.map((file) => file.name)
    }]);
    setBody("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
    setNotice("Saved in this browser preview only.");
  }

  return <section className="overflow-hidden border border-ink/15 bg-[#fbf8f1]">
    <div className="flex items-center justify-between border-b border-ink/10 px-4 py-3">
      <div><p className="eyebrow text-laterite">{role === "guest" ? "A private note to your host" : "Guest conversation"}</p><p className="mt-1 flex items-center gap-2 font-display text-xl"><MessageCircle size={16} className="text-laterite" /> Maya Sen · Puri</p></div>
      <span className="border border-lagoon/25 bg-[#e7efeb] px-2 py-1 text-[9px] uppercase tracking-widest text-lagoon">Local demo</span>
    </div>
    <div ref={listRef} className="flex max-h-[390px] min-h-[250px] flex-col gap-3 overflow-y-auto p-4">
      {messages.map((message) => <article key={message.id} className={`max-w-[88%] ${message.sender === role ? "self-end" : "self-start"}`}>
        <div className={`px-4 py-3 text-sm leading-6 ${message.sender === role ? "bg-[#e6d9c5]" : "bg-[#f0e0d8]"}`}>
          <p className="mb-1 text-[9px] uppercase tracking-widest text-ink/45">{message.sender === "guest" ? "Maya · guest" : "Your host"}</p>
          {message.text && <p>{message.text}</p>}
          {message.attachments?.map((name) => <p key={name} className="mt-2 border-t border-ink/10 pt-2 text-xs text-ink/60">Photo attached · {name}</p>)}
        </div>
        <p className="mt-1 text-[10px] text-ink/40">{message.time}</p>
      </article>)}
      {messages.length === 0 && <p className="m-auto max-w-xs text-center font-display text-xl text-ink/45">A hello is a good place to start.</p>}
    </div>
    <form onSubmit={send} className="border-t border-ink/10 p-3">
      <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={2} maxLength={4000} placeholder={role === "guest" ? "Write your host a note…" : "Write back to Maya…"} className="w-full resize-none bg-transparent px-2 py-2 text-sm outline-none" aria-label="Preview message" />
      {files.length > 0 && <p className="px-2 text-[11px] text-ink/50">{files.map((file) => file.name).join(", ")} · kept on this device</p>}
      <div className="flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2 px-2 py-2 text-xs text-ink/55 hover:text-laterite"><ImagePlus size={15} /> Add a photo<input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>
        <button disabled={!body.trim() && files.length === 0} className="button-ink !min-h-10 disabled:opacity-40"><Send size={14} /> Send preview message</button>
      </div>
      <p role="status" className="min-h-4 px-2 text-[10px] text-lagoon">{notice}</p>
    </form>
  </section>;
}
