"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowUpRight, CheckCircle2, MessageCircle, ShieldCheck, TicketCheck } from "lucide-react";
import { PreviewChat } from "@/components/preview-chat";
import { formatINR } from "@/lib/format";

const bookings = [
  { id: "ui-preview", place: "Puri", district: "Puri district", dates: "12 Dec → 15 Dec 2026", guests: 2, status: "confirmed", total: 23625 },
  { id: "ui-preview", place: "Chilika Lagoon", district: "Puri district", dates: "22 Jan → 24 Jan 2027", guests: 3, status: "upcoming", total: 13600 }
];

export function AccountPreview() {
  const [name, setName] = useState("Maya Sen");
  const [phone, setPhone] = useState("+91 98765 43210");
  const [saved, setSaved] = useState(false);

  return <div className="mx-auto max-w-[1280px]">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border border-lagoon/20 bg-[#e7efeb] px-4 py-3 text-xs text-lagoon"><span className="flex items-center gap-2"><ShieldCheck size={15} /> UI preview · signed in as a sample guest</span><span>No account or backend is used.</span></div>
    <div className="flex flex-col justify-between gap-5 border-b border-ink/15 pb-7 md:flex-row md:items-end"><div><p className="eyebrow text-laterite">A warm welcome back</p><h1 className="mt-3 font-display text-5xl md:text-6xl">Hello, {name.split(" ")[0]}.</h1><p className="mt-3 text-sm text-ink/60">Your next little corner is just here.</p></div><Link href="/admin" className="button-outline w-fit">Open host desk <ArrowUpRight size={14} /></Link></div>
    <div className="mt-9 grid gap-9 xl:grid-cols-[1fr_360px]">
      <div>
        <section>
          <div className="flex items-end justify-between border-b border-ink/15 pb-4"><div><p className="eyebrow text-laterite">Your plans</p><h2 className="mt-1 font-display text-4xl">Bookings</h2></div><TicketCheck className="text-laterite" /></div>
          <div className="mt-4 grid gap-3">{bookings.map((booking, index) => <article key={`${booking.place}-${index}`} className="grid gap-4 border border-ink/10 bg-[#fbf8f1] p-4 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="eyebrow text-ink/50">{booking.district} · {booking.status}</p><h3 className="mt-1 font-display text-2xl">{booking.place}</h3><p className="mt-1 text-sm text-ink/60">{booking.dates} · {booking.guests} guests</p></div><div className="flex items-center justify-between gap-5"><span className="font-display text-xl">{formatINR(booking.total)}</span><Link className="button-outline !min-h-10 !px-3 !text-xs" href="/booking/ui-preview">Details <ArrowUpRight size={13} /></Link></div></article>)}</div>
        </section>
        <section className="mt-9">
          <div className="flex items-end justify-between border-b border-ink/15 pb-4"><div><p className="eyebrow text-laterite">One-to-one with the owner</p><h2 className="mt-1 font-display text-4xl">Messages</h2></div><MessageCircle className="text-laterite" /></div>
          <div className="mt-4 grid gap-3 sm:grid-cols-[230px_1fr]"><button className="flex items-center justify-between border border-laterite bg-[#f0e0d8] p-4 text-left"><span><span className="block font-display text-xl">A note about Puri</span><span className="mt-1 block text-xs text-ink/50">Host replied · Yesterday</span></span><MessageCircle size={17} className="text-laterite" /></button><p className="self-center px-2 text-xs leading-5 text-ink/55">Try sending a message or attaching a photo. The sample chat stays in this browser.</p></div>
          <div className="mt-4"><PreviewChat role="guest" /></div>
        </section>
      </div>
      <aside>
        <div className="border border-ink/15 bg-[#fbf8f1] p-5"><p className="eyebrow text-laterite">A few details</p><h2 className="mt-2 font-display text-3xl">Your profile</h2><form onSubmit={(event) => { event.preventDefault(); setSaved(true); }} className="mt-5 grid gap-4"><label className="grid gap-2 text-xs font-semibold">Name<input value={name} onChange={(event) => { setName(event.target.value); setSaved(false); }} className="h-11 border border-ink/20 bg-paper px-3 text-sm font-normal outline-none focus:border-laterite" /></label><label className="grid gap-2 text-xs font-semibold">Phone<input value={phone} onChange={(event) => { setPhone(event.target.value); setSaved(false); }} className="h-11 border border-ink/20 bg-paper px-3 text-sm font-normal outline-none focus:border-laterite" /></label><button className="button-outline">Save preview details <CheckCircle2 size={15} /></button>{saved && <p role="status" className="text-xs text-lagoon">Saved in this preview.</p>}</form></div>
        <div className="mt-4 border border-ink/10 p-5"><p className="eyebrow text-ink/45">A small reminder</p><p className="mt-2 flex items-start gap-2 text-sm leading-6 text-ink/65"><CheckCircle2 size={15} className="mt-1 shrink-0 text-lagoon" />Your arrival time helps your host put the kettle on at the right moment.</p></div>
        <Link href="/#stays" className="mt-4 flex items-center justify-between border border-ink/10 bg-[#e9e1d2] p-5"><span><span className="eyebrow text-laterite">Ready for another trip?</span><span className="mt-1 block font-display text-xl">Explore the four stays</span></span><ArrowUpRight size={16} className="text-laterite" /></Link>
      </aside>
    </div>
  </div>;
}
