"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-40 border-b border-ink/10 bg-paper">
      <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 md:px-10">
        <Link href="/" aria-label="Odisha Retreat home" className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-laterite text-laterite"><span className="font-display text-xl">O</span></span>
          <span className="leading-tight"><span className="block font-display text-[1.12rem]">Odisha Retreat</span><span className="eyebrow !text-[.52rem] !tracking-[.2em] text-ink/55">Four stays, held close</span></span>
        </Link>
        <nav className="hidden items-center gap-9 md:flex" aria-label="Main navigation">
          <Link className="text-sm hover:text-laterite" href="/#stays">The stays</Link>
          <Link className="text-sm hover:text-laterite" href="/#journey">Our Odisha</Link>
          <Link className="text-sm hover:text-laterite" href="/account">Your booking</Link>
          {process.env.NODE_ENV === "development" && <Link className="text-sm hover:text-laterite" href="/admin">Host desk preview</Link>}
          <Link className="button-ink !min-h-10 !text-sm" href="/#map">Find your place <span aria-hidden="true">↗</span></Link>
        </nav>
        <button type="button" className="flex h-11 w-11 items-center justify-center md:hidden" aria-label={open ? "Close navigation" : "Open navigation"} aria-expanded={open} onClick={() => setOpen(!open)}>{open ? <X /> : <Menu />}</button>
      </div>
      {open && <nav className="absolute left-0 right-0 top-full border-b border-ink/10 bg-paper p-5 shadow-lg md:hidden" aria-label="Mobile navigation"><div className="grid gap-4"><Link href="/#stays" onClick={() => setOpen(false)}>The stays</Link><Link href="/#journey" onClick={() => setOpen(false)}>Our Odisha</Link><Link href="/account" onClick={() => setOpen(false)}>Your booking</Link>{process.env.NODE_ENV === "development" && <Link href="/admin" onClick={() => setOpen(false)}>Host desk preview</Link>}<Link className="button-ink" href="/#map" onClick={() => setOpen(false)}>Find your place ↗</Link></div></nav>}
    </header>
  );
}
