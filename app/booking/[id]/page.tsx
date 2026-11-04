import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { BookingCheckout } from "@/components/booking-checkout";

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <><SiteHeader /><main className="min-h-[70vh] px-5 py-12 md:px-10 md:py-20"><BookingCheckout bookingId={id} /></main><SiteFooter /></>;
}
