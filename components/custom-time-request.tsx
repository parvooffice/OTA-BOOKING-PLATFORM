"use client";

import { useState } from "react";
import { Clock3, LoaderCircle, MessageCircle } from "lucide-react";
import { GuestChat } from "@/components/guest-chat";

export function CustomTimeRequest({ bookingId, currentCheckin }: { bookingId: string; currentCheckin: string }) {
  const [requestType, setRequestType] = useState<"checkin" | "checkout">("checkin");
  const [requestedTime, setRequestedTime] = useState(currentCheckin.slice(0, 5));
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function requestTime() {
    setBusy(true); setError("");
    const response = await fetch("/api/chat/time-request", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bookingId, requestType, requestedTime }) });
    const body = await response.json().catch(() => ({}));
    if (response.ok) setConversationId(body.conversationId);
    else setError(body.error ?? "We could not send your request.");
    setBusy(false);
  }
  return <div className="mt-8 border border-ink/15 bg-[#fbf8f1] p-5"><p className="eyebrow text-laterite">A different arrival or departure?</p><h2 className="mt-2 font-display text-3xl">Ask your host.</h2><p className="mt-2 text-xs leading-5 text-ink/55">Custom times need the owner’s approval. We’ll open a message with your booking attached.</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="grid gap-2 text-[11px] font-semibold">Request<select value={requestType} onChange={(event) => setRequestType(event.target.value as "checkin" | "checkout")} className="h-11 border border-ink/15 bg-paper px-3 text-sm font-normal"><option value="checkin">Check-in</option><option value="checkout">Check-out</option></select></label><label className="grid gap-2 text-[11px] font-semibold">Preferred time<input type="time" value={requestedTime} onChange={(event) => setRequestedTime(event.target.value)} className="h-11 border border-ink/15 bg-paper px-3 text-sm font-normal" /></label><button onClick={requestTime} disabled={busy} className="button-ink self-end !min-h-11">{busy ? <LoaderCircle size={15} className="animate-spin" /> : <Clock3 size={15} />} Request custom time</button></div>{error && <p role="alert" className="mt-3 text-xs text-laterite">{error}</p>}{conversationId && <div className="mt-5"><p className="mb-3 flex items-center gap-2 text-xs text-lagoon"><MessageCircle size={14} /> Your request has been sent. Your host will reply here.</p><GuestChat conversationId={conversationId} /></div>}</div>;
}
