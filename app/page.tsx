import Link from "next/link";
import { ArrowDown, ArrowUpRight, MoveRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { KonarkMark } from "@/components/konark-mark";
import { MapExplorer } from "@/components/map-explorer";
import { getProperties } from "@/lib/property-data";
import { HomeStory } from "@/components/home-story";

export default async function HomePage() {
  const properties = await getProperties();
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative grid min-h-[calc(100svh-76px)] overflow-hidden bg-[#3d332b] text-paper md:grid-cols-[.86fr_1.14fr]">
          <div className="grain relative z-10 flex min-h-[590px] flex-col justify-center px-6 py-16 md:min-h-[690px] md:px-[9vw] md:py-20">
            <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(42,33,26,.95)_0%,rgba(42,33,26,.86)_54%,rgba(42,33,26,.12)_100%)] md:bg-[linear-gradient(90deg,rgba(42,33,26,.94)_0%,rgba(42,33,26,.74)_75%,rgba(42,33,26,.15)_100%)]" />
            <div className="hero-intro relative z-10 max-w-[640px]">
              <p className="eyebrow flex items-center gap-3 text-[#edc56c]"><span className="h-px w-9 bg-[#edc56c]" />ଓଡ଼ିଶା · ODISHA, AT ITS OWN PACE</p>
              <h1 className="mt-8 font-display text-[clamp(3.5rem,7.2vw,7.2rem)] leading-[.91] tracking-[-.055em]">A little<br />closer to<br /><em className="font-normal text-[#e0aa4a]">this place.</em></h1>
              <p className="mt-8 max-w-[390px] text-[15px] leading-7 text-paper/75 md:text-base">Two owner-run stays. One big-hearted corner of India. Find your own small piece of Odisha.</p>
              <div className="mt-8 flex flex-wrap items-center gap-3"><Link href="#stays" className="button-ink !bg-[#d4a23d] !text-ink hover:!bg-paper">Find your stay <ArrowUpRight size={15} /></Link><Link href="#journey" className="inline-flex min-h-12 items-center gap-2 px-2 text-sm text-paper/80 hover:text-white">Take the long way <ArrowDown size={15} /></Link></div>
              <div className="mt-14 flex items-center gap-3 text-xs text-paper/55"><span className="h-px w-12 bg-paper/35" />A small collection, held by hand</div>
            </div>
            <KonarkMark className="hero-wheel absolute -bottom-12 -right-12 z-[1] h-60 w-60 text-[#d4a23d]/30 md:-right-20 md:bottom-3 md:h-[390px] md:w-[390px]" />
          </div>
          <div className="grain relative min-h-[360px] overflow-hidden md:min-h-[690px]">
            <div data-cursor="View" className="hero-kenburns absolute inset-0 bg-[radial-gradient(ellipse_at_70%_35%,rgba(212,162,61,.5),transparent_38%),linear-gradient(145deg,#758c79_0%,#3d5c58_48%,#2a211a_100%)]" style={properties[0]?.hero ? { backgroundImage: `url('${properties[0].hero}')`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#2a211a]/75 via-transparent to-[#2a211a]/10" />
            <div className="absolute bottom-8 left-6 right-6 flex items-end justify-between text-white md:bottom-12 md:left-12 md:right-10"><p className="max-w-[14rem] font-display text-2xl leading-tight">{properties[0]?.caption || properties[0]?.name || "A place to arrive slowly."}</p><span className="eyebrow rounded-full border border-white/40 px-3 py-2">01 / 02 · {properties[0]?.name ?? "Odisha"}</span></div>
          </div>
          <div className="absolute bottom-6 left-6 z-20 hidden md:block"><span className="eyebrow text-paper/55">19°48&apos;48.6&quot;N · 85°49&apos;52.3&quot;E</span></div>
        </section>

        <HomeStory />

        <section id="stays" className="scroll-mt-20 px-5 py-20 md:px-10 md:py-28">
          <div className="mx-auto max-w-[1440px]">
            <div className="mb-10 flex flex-col justify-between gap-5 border-b border-ink/15 pb-6 md:flex-row md:items-end"><div><p className="eyebrow text-laterite">Two keys. Two ways in.</p><h2 className="mt-3 font-display text-5xl leading-none md:text-7xl">Choose your Odisha.</h2></div><p className="max-w-xs text-sm leading-6 text-ink/65">Each home has its own pace, its own people, its own pot of tea. Start wherever you like.</p></div>
            <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2">
              {properties.map((property, index) => <Link key={property.id} href={`/properties/${property.slug}`} className={`group block ${index % 2 === 1 ? "lg:mt-12" : ""}`}>
                <div data-cursor="View" className={`relative overflow-hidden bg-[radial-gradient(ellipse_at_70%_35%,rgba(212,162,61,.5),transparent_38%),linear-gradient(145deg,#758c79_0%,#3d5c58_48%,#2a211a_100%)] ${index % 2 === 0 ? "aspect-[1.1]" : "aspect-[1.1] rotate-[.4deg]"}`} style={property.hero ? { backgroundImage: `url('${property.hero}')`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}><span className="absolute left-3 top-3 bg-paper/90 px-3 py-1.5 font-display text-sm">0{index + 1}</span><span className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-full bg-paper text-ink transition group-hover:bg-laterite group-hover:text-white"><ArrowUpRight size={17} /></span></div>
                <div className="mt-4 flex items-start justify-between gap-2"><div><p className="eyebrow text-laterite">{property.place} · {property.district}</p><h3 className="mt-2 font-display text-3xl">{property.name}</h3></div><span className="mt-5 text-right font-display text-xl text-ink/50">{property.basePriceInr > 0 ? `₹${property.basePriceInr.toLocaleString("en-IN")}` : "Rates soon"}<small className="block text-right font-sans text-[10px]">{property.basePriceInr > 0 ? "per night" : "set by host"}</small></span></div>
                <p className="mt-2 max-w-[20rem] text-sm leading-6 text-ink/65">{property.tagline}</p>
              </Link>)}
            </div>
          </div>
        </section>

        <section id="journey" className="scroll-mt-20 bg-[#e9e1d2] px-5 py-20 md:px-10 md:py-28">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 md:grid-cols-[.8fr_1.2fr] md:gap-20">
            <div className="relative mx-auto w-full max-w-[420px]">
              <KonarkMark className="absolute -left-7 -top-6 z-10 h-24 w-24 -rotate-12 text-laterite md:-left-10 md:-top-10 md:h-32 md:w-32" />
              <div className="aspect-[.93] rotate-[-1.3deg] bg-[radial-gradient(ellipse_at_65%_30%,rgba(212,162,61,.45),transparent_34%),linear-gradient(145deg,#a64d37_0%,#6b4b3b_48%,#263e3d_100%)] shadow-[0_20px_50px_rgba(42,33,26,.16)]" />
              <p className="absolute -bottom-7 right-0 max-w-[220px] rotate-2 bg-paper px-4 py-3 font-display text-xl shadow-lg">No two mornings look alike.</p>
            </div>
            <div><p className="eyebrow text-laterite">Not a collection. A connection.</p><h2 className="mt-4 max-w-2xl font-display text-5xl leading-[.99] md:text-7xl">Here, the stay is part of the story.</h2><p className="mt-7 max-w-xl text-base leading-7 text-ink/70">Odisha is not a place to hurry through. Choose the coast or a village stay, meet the people who welcome you, then leave the rest of the day to you.</p><Link href="#map" className="mt-7 inline-flex items-center gap-3 border-b border-laterite pb-2 text-sm font-semibold text-laterite">A map, and a little more <MoveRight size={16} /></Link></div>
          </div>
        </section>

        <section id="map" className="scroll-mt-20 bg-paper">
          <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-4 px-5 py-12 md:flex-row md:items-end md:px-10"><div><p className="eyebrow text-laterite">Come see where we are</p><h2 className="mt-3 font-display text-5xl leading-none md:text-6xl">Find your corner.</h2></div><p className="max-w-sm text-sm leading-6 text-ink/65">Two homes, from the Puri coast to village quiet. Tap a pin, have a look around.</p></div>
          <MapExplorer properties={properties} />
          <div className="ikat-rule" />
        </section>

        <section className="px-5 py-20 md:px-10 md:py-28"><div className="mx-auto grid max-w-[1440px] gap-8 border-l-[3px] border-laterite pl-6 md:grid-cols-[1fr_auto] md:items-center md:pl-10"><div><p className="eyebrow text-laterite">We’ll be right here</p><p className="mt-3 max-w-3xl font-display text-4xl leading-[1.05] md:text-6xl">Need a little help finding the right stay?</p><p className="mt-4 text-sm text-ink/60">Tell us what you’re looking for. A real person will write back.</p></div><a className="button-ink w-fit" href="mailto:retreatodisha@gmail.com">Write to your host <ArrowUpRight size={16} /></a></div></section>
      </main>
      <SiteFooter />
    </>
  );
}
