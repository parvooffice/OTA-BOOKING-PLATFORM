import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowUpRight, BedDouble, MapPin, ShowerHead, Sparkles, UsersRound } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PropertyGallery } from "@/components/property-gallery";
import { PropertyBookingPanel } from "@/components/property-booking-panel";
import { LocationMap } from "@/components/location-map";
import { getPropertyData } from "@/lib/property-data";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const property = await getPropertyData(slug);
  if (!property) return { title: "Stay not found" };
  return {
    title: `${property.place} — a private Odisha stay`,
    description: property.description,
    openGraph: { title: `${property.place} · Odisha Retreat`, description: property.tagline || `${property.place}, Odisha`, images: property.hero ? [property.hero] : [] }
  };
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getPropertyData(slug);
  if (!property) notFound();
  const lodgingBusiness = {
    "@context": "https://schema.org", "@type": "LodgingBusiness", name: `${property.name} · Odisha Retreat`,
    description: property.description || `${property.place}, Odisha`, ...(property.images.length ? { image: property.images } : {}),
    address: { "@type": "PostalAddress", addressLocality: property.place, addressRegion: "Odisha", addressCountry: "IN" },
    geo: { "@type": "GeoCoordinates", latitude: property.coordinates[1], longitude: property.coordinates[0] },
    ...(property.basePriceInr > 0 ? { priceRange: `₹${property.basePriceInr.toLocaleString("en-IN")} per night` } : {})
  };

  return (
    <>
      <SiteHeader />
      <main>
        <div className="mx-auto max-w-[1440px] px-5 pt-6 md:px-10 md:pt-9"><Link href="/#stays" className="inline-flex items-center gap-2 text-xs text-ink/55 hover:text-laterite"><ArrowLeft size={14} /> All stays</Link></div>
        <section className="mx-auto max-w-[1440px] px-5 pb-16 pt-7 md:px-10 md:pb-24 md:pt-10">
          <div className="mb-8 grid gap-6 md:grid-cols-[1fr_auto] md:items-end"><div><p className="eyebrow text-laterite">{property.district} district · ଓଡ଼ିଶା</p><h1 className="mt-3 font-display text-6xl leading-[.9] md:text-8xl">{property.place}<span className="ml-3 text-laterite">.</span></h1>{property.tagline && <p className="mt-4 max-w-xl font-display text-2xl text-ink/60 md:text-3xl">{property.tagline}</p>}</div><div className="flex flex-wrap gap-2 text-xs text-ink/65">{property.bedrooms > 0 && <span className="inline-flex items-center gap-2 border border-ink/15 px-3 py-2"><BedDouble size={14} className="text-laterite" /> {property.bedrooms} bedrooms</span>}{property.bathrooms > 0 && <span className="inline-flex items-center gap-2 border border-ink/15 px-3 py-2"><ShowerHead size={15} className="text-laterite" /> {property.bathrooms} bathrooms</span>}<span className="inline-flex items-center gap-2 border border-ink/15 px-3 py-2"><UsersRound size={14} className="text-laterite" /> Up to {property.maxGuests}</span></div></div>
          <PropertyGallery slug={property.slug} place={property.place} images={property.images} caption={property.caption} />

          <div className="mt-12 grid items-start gap-12 lg:grid-cols-[1fr_390px] lg:gap-16">
            <div>
              {property.description && <><p className="eyebrow text-laterite">A note from the host</p><h2 className="mt-3 max-w-3xl font-display text-4xl leading-[1.05] md:text-5xl">{property.description}</h2></>}
              {(property.amenities.length > 0 || property.houseRules.length > 0) && <div className="mt-11 grid gap-10 border-y border-ink/15 py-8 md:grid-cols-2">{property.amenities.length > 0 && <div><p className="eyebrow">The comforts</p><ul className="mt-5 grid gap-4">{property.amenities.map((amenity) => <li className="flex items-center gap-3 text-sm" key={amenity}><Sparkles size={15} className="text-laterite" />{amenity}</li>)}</ul></div>}{property.houseRules.length > 0 && <div><p className="eyebrow">A few house notes</p><ul className="mt-5 grid gap-4">{property.houseRules.map((rule) => <li className="flex items-start gap-3 text-sm leading-5" key={rule}><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-turmeric" />{rule}</li>)}</ul></div>}</div>}
              <div className="mt-10"><div className="flex items-end justify-between gap-4"><div><p className="eyebrow text-laterite">Outside the front door</p><h2 className="mt-2 font-display text-4xl">{property.place}, Odisha</h2></div><span className="hidden items-center gap-1 text-xs text-ink/50 sm:flex"><MapPin size={13} /> Approximate location</span></div><div className="mt-5 h-[300px] overflow-hidden border border-ink/10"><LocationMap center={property.coordinates} label={property.place} /></div><p className="mt-3 text-xs leading-5 text-ink/50">We’ll share the exact address and directions once your stay is confirmed.</p></div>
              <div className="mt-10 border-t border-ink/15 pt-8"><p className="eyebrow text-laterite">Have a question?</p><h3 className="mt-2 font-display text-3xl">The host is a message away.</h3><p className="mt-2 max-w-lg text-sm leading-6 text-ink/60">Ask about a quieter room, a train that gets in late, or the best place for breakfast. We’re happy to help.</p><Link className="button-outline mt-5" href={`/account?property=${property.slug}`}><span>Chat with the host</span><ArrowUpRight size={15} /></Link></div>
            </div>
            <div className="lg:sticky lg:top-6"><PropertyBookingPanel property={property} /></div>
          </div>
        </section>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(lodgingBusiness).replace(/</g, "\\u003c") }} />
    </>
  );
}
