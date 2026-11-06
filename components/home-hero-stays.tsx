"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { differenceInCalendarDays, eachDayOfInterval, isBefore, startOfToday } from "date-fns";
import { ArrowRight, ArrowUpRight, CalendarDays, ChevronDown, Minus, Plus } from "lucide-react";
import { motion, useReducedMotion, useSpring } from "framer-motion";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { localDateKey } from "@/lib/format";
import type { RetreatProperty } from "@/lib/properties";

type Block = { checkin_date: string; checkout_date: string };

export function HomeHeroStays({ properties }: { properties: RetreatProperty[] }) {
  const stays = properties.slice(0, 2);
  const [selectedSlug, setSelectedSlug] = useState(stays[0]?.slug ?? "");

  if (stays.length === 0) return <div id="stays" className="relative min-h-[360px] bg-[radial-gradient(ellipse_at_70%_35%,rgba(212,162,61,.5),transparent_38%),linear-gradient(145deg,#758c79_0%,#3d5c58_48%,#2a211a_100%)] md:min-h-[690px]" />;

  const selected = stays.find((property) => property.slug === selectedSlug) ?? stays[0];
  return (
    <div id="stays" className="relative overflow-hidden bg-[radial-gradient(ellipse_at_70%_35%,rgba(212,162,61,.5),transparent_38%),linear-gradient(145deg,#758c79_0%,#3d5c58_48%,#2a211a_100%)] px-4 py-10 sm:px-8 md:min-h-[690px] md:px-10 md:py-12">
      <div className="grain pointer-events-none absolute inset-0 opacity-60" />
      <div className="relative z-10 mx-auto flex h-full max-w-[760px] flex-col justify-start pt-8 md:pt-8">
        <p className="eyebrow mb-5 text-paper/70">Two stays · held close</p>
        <div className="mx-auto grid w-full max-w-[760px] grid-cols-1 items-start gap-5 md:grid-cols-2 md:gap-6">
          {stays.map((property, index) => <StayCard key={property.id} property={property} index={index} onSelect={setSelectedSlug} />)}
        </div>
        <HomeBookingBar properties={stays} selected={selected} selectedSlug={selectedSlug} onSelect={setSelectedSlug} />
      </div>
    </div>
  );
}

function StayCard({ property, index, onSelect }: { property: RetreatProperty; index: number; onSelect: (slug: string) => void }) {
  const reduceMotion = useReducedMotion() ?? false;
  const [hovered, setHovered] = useState(false);
  const rotateX = useSpring(0, { stiffness: 210, damping: 24, mass: .7 });
  const rotateY = useSpring(0, { stiffness: 210, damping: 24, mass: .7 });
  const tilt = index === 0 ? -3 : 2.5;
  const isVillageLogo = property.slug === "village-retreat" && property.images.length <= 1;
  const photoBackground = property.hero ? "bg-[radial-gradient(ellipse_at_70%_35%,rgba(212,162,61,.5),transparent_38%),linear-gradient(145deg,#758c79_0%,#3d5c58_48%,#2a211a_100%)]" : property.slug === "village-retreat" ? "bg-[#2a211a]" : "bg-[#e9e1d2]";

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (reduceMotion || event.pointerType === "touch" || !window.matchMedia("(pointer: fine)").matches) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    rotateY.set(((event.clientX - bounds.left) / bounds.width - .5) * 12);
    rotateX.set(-((event.clientY - bounds.top) / bounds.height - .5) * 12);
  }

  function resetPointer() {
    rotateX.set(0);
    rotateY.set(0);
    setHovered(false);
  }

  return (
    <motion.div
      className="relative min-w-0"
      style={{ rotateX, rotateY, rotateZ: hovered ? 0 : tilt, zIndex: hovered ? 30 : index + 1, transformPerspective: 900 }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -110, rotate: tilt }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduceMotion ? { duration: .2 } : { type: "spring", stiffness: 145, damping: 12, mass: .8, delay: index * .15 }}
      onPointerMove={onPointerMove}
      onPointerLeave={resetPointer}
      onMouseEnter={() => { setHovered(true); onSelect(property.slug); }}
      onFocus={() => onSelect(property.slug)}
    >
      <motion.div
        animate={reduceMotion ? undefined : { y: [0, -6, 0, 6, 0], rotate: [0, .5, 0, -.5, 0] }}
        transition={reduceMotion ? undefined : { duration: 6, repeat: Infinity, ease: "easeInOut", delay: index * .8 }}
      >
        <Link href={`/properties/${property.slug}`} data-cursor="View" className="group block border-[3px] border-paper/90 bg-paper p-2 shadow-[0_18px_35px_rgba(27,22,18,.28)] transition-[box-shadow] duration-300 md:hover:shadow-[0_28px_55px_rgba(27,22,18,.4)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#f0ca76]">
          <div className={`relative aspect-video overflow-hidden rounded-[30px] ${photoBackground}`}>
            {property.hero && <Image src={property.hero} alt={`${property.place}, Odisha`} fill priority={index === 0} sizes="(max-width: 767px) 45vw, 240px" className={`transition-transform duration-700 md:group-hover:scale-[1.06] ${isVillageLogo ? "object-contain p-7" : "object-cover object-center"}`} />}
            {!property.hero && property.slug === "puri" && <span className="absolute inset-0 grid place-items-center px-4 text-center font-display text-sm text-ink/55">Photo coming soon</span>}
            {!property.hero && property.slug === "village-retreat" && <span className="absolute inset-0 grid place-items-center px-8 text-center font-display text-sm uppercase tracking-[.18em] text-paper">The Village Retreat, Puri</span>}
            <span className="absolute left-2 top-2 bg-paper/95 px-2.5 py-1 font-display text-sm text-ink">0{index + 1}</span>
            <span className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full bg-paper text-ink transition-all duration-300 md:group-hover:rotate-45 md:group-hover:bg-[#d4a23d] md:group-hover:text-ink"><ArrowUpRight size={16} /></span>
          </div>
          <div className="px-1 pb-1 pt-3">
            <p className="eyebrow text-[.52rem] text-laterite">{property.slug === "puri" ? "PURI · ODISHA" : `${property.place} · ${property.district}`}</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <h2 className="font-display text-[clamp(1.35rem,2.4vw,2.1rem)] leading-none text-ink">{property.name}</h2>
              <span className="shrink-0 text-right font-display text-sm text-ink/60">{property.basePriceInr > 0 ? `₹${property.basePriceInr.toLocaleString("en-IN")}` : "Rates soon"}<small className="block font-sans text-[8px]">{property.basePriceInr > 0 ? "per night" : "set by host"}</small></span>
            </div>
          </div>
        </Link>
      </motion.div>
    </motion.div>
  );
}

function HomeBookingBar({ properties, selected, selectedSlug, onSelect }: { properties: RetreatProperty[]; selected: RetreatProperty; selectedSlug: string; onSelect: (slug: string) => void }) {
  const router = useRouter();
  const [range, setRange] = useState<DateRange | undefined>();
  const [guests, setGuests] = useState(Math.min(2, selected.maxGuests));
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    setRange(undefined);
    setGuests(Math.min(2, selected.maxGuests));
    setCalendarOpen(false);
  }, [selected.maxGuests, selected.slug]);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    void supabase.from("public_availability").select("checkin_date,checkout_date").eq("property_id", selected.id).gte("checkout_date", localDateKey(startOfToday())).limit(250).then(({ data }) => { if (active) setBlocks((data ?? []) as Block[]); });
    return () => { active = false; };
  }, [selected.id, supabase]);

  const blockedDays = useMemo(() => blocks.flatMap((block) => {
    const start = new Date(`${block.checkin_date}T12:00:00`);
    const end = new Date(`${block.checkout_date}T12:00:00`);
    end.setDate(end.getDate() - 1);
    return isBefore(end, start) ? [] : eachDayOfInterval({ start, end });
  }), [blocks]);
  const nights = range?.from && range.to ? differenceInCalendarDays(range.to, range.from) : 0;

  function continueToStay() {
    if (!range?.from || !range.to) return;
    const params = new URLSearchParams({ checkin: localDateKey(range.from), checkout: localDateKey(range.to), guests: String(guests) });
    router.push(`/properties/${selected.slug}?${params.toString()}`);
  }

  const controls = (
    <div className="relative border border-ink/15 bg-[#fbf8f1] p-4 text-ink shadow-[0_14px_40px_rgba(42,33,26,.18)] sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3"><div><p className="eyebrow text-laterite">Book a date</p><p className="mt-1 text-[11px] text-ink/50">Choose a stay, then choose your days.</p></div><div className="flex gap-1 rounded-full border border-ink/10 p-1" role="group" aria-label="Choose a stay">{properties.map((property) => <button key={property.slug} type="button" onClick={() => onSelect(property.slug)} className={`rounded-full px-2.5 py-1 text-[10px] transition-colors ${property.slug === selectedSlug ? "bg-ink text-paper" : "text-ink/55 hover:text-ink"}`}>{property.slug === "puri" ? "Puri" : "Village Retreat"}</button>)}</div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <DateField label="Check-in" date={range?.from} onClick={() => setCalendarOpen(true)} />
        <DateField label="Check-out" date={range?.to} onClick={() => setCalendarOpen(true)} />
        <div className="flex items-end justify-between gap-3 border border-ink/15 px-3 py-2 sm:min-w-[128px]"><div><p className="text-[9px] uppercase tracking-[.16em] text-ink/45">Guests</p><p className="mt-1 text-xs text-ink/70">{guests} guests</p></div><div className="flex items-center gap-1"><button type="button" onClick={() => setGuests((value) => Math.max(1, value - 1))} className="flex h-6 w-6 items-center justify-center rounded-full border border-ink/15" aria-label="Remove a guest"><Minus size={12} /></button><button type="button" onClick={() => setGuests((value) => Math.min(selected.maxGuests, value + 1))} className="flex h-6 w-6 items-center justify-center rounded-full border border-ink/15" aria-label="Add a guest"><Plus size={12} /></button></div></div>
      </div>
      <p className="mt-2 text-[10px] text-ink/50">{selected.includedGuests} guests included · up to {selected.maxGuests} guests</p>
      {calendarOpen && <div className="absolute left-0 right-0 top-full z-40 mt-2 border border-ink/15 bg-[#fbf8f1] p-3 shadow-[0_18px_50px_rgba(42,33,26,.2)]"><div className="flex items-center justify-between px-2"><p className="eyebrow text-laterite">Availability · {selected.name}</p><button type="button" onClick={() => setCalendarOpen(false)} className="text-xs text-ink/50">Close</button></div><DayPicker mode="range" selected={range} onSelect={(next) => { setRange(next); if (next?.from && next.to) setCalendarOpen(false); }} numberOfMonths={1} disabled={[{ before: startOfToday() }, ...blockedDays]} showOutsideDays className="booking-calendar" /></div>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-ink/50">Check-in 10 AM to 8 PM · Check-out by 9 AM{nights > 0 ? ` · ${nights} ${nights === 1 ? "night" : "nights"}` : ""}</p><button type="button" onClick={continueToStay} disabled={!range?.from || !range.to} className="button-ink !min-h-10 !px-4 !text-xs disabled:cursor-not-allowed disabled:opacity-45">Check availability <ArrowRight size={14} /></button></div>
    </div>
  );

  return <div id="booking-bar" className="mt-10 md:mt-14"><div className="hidden md:block">{controls}</div><div className="md:hidden"><button type="button" onClick={() => setMobileOpen((open) => !open)} className="flex w-full items-center justify-between border border-ink/15 bg-[#fbf8f1] px-4 py-3 text-left shadow-[0_10px_30px_rgba(42,33,26,.2)]"><span><span className="eyebrow block text-laterite">Book a date</span><span className="mt-1 block text-xs text-ink/65">{range?.from && range.to ? `${localDateKey(range.from)} → ${localDateKey(range.to)}` : "Choose your stay and dates"}</span></span><ChevronDown size={17} className={mobileOpen ? "rotate-180 transition-transform" : "transition-transform"} /></button>{mobileOpen && <div className="fixed inset-x-3 bottom-3 z-[90] max-h-[calc(100svh-100px)] overflow-y-auto">{controls}</div>}</div></div>;
}

function DateField({ label, date, onClick }: { label: string; date?: Date; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="flex min-h-[52px] items-center justify-between border border-ink/15 px-3 py-2 text-left hover:border-laterite"><span><span className="block text-[9px] uppercase tracking-[.16em] text-ink/45">{label}</span><span className="mt-1 block text-xs text-ink/70">{date ? localDateKey(date) : "Choose a date"}</span></span><CalendarDays size={15} className="text-laterite" /></button>;
}
