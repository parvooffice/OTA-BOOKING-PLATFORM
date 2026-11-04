import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BookingStart } from "@/components/booking-start";

export default function BookingStartPage() {
  return <><SiteHeader /><main className="min-h-[70vh] px-5 py-12 md:px-10 md:py-20"><Suspense fallback={<p className="mx-auto max-w-3xl text-sm text-ink/55">Checking those dates…</p>}><BookingStart /></Suspense></main><SiteFooter /></>;
}
