import Link from "next/link";
import { ArrowDown, ArrowUpRight, MoveRight } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { KonarkMark } from "@/components/konark-mark";
import { getProperties } from "@/lib/property-data";
import { HomeStory } from "@/components/home-story";
import { HomeHeroStays } from "@/components/home-hero-stays";

export default async function HomePage() {
  const properties = await getProperties();
  return (
    <>
      <SiteHeader />
      <main>
        <section className="relative grid min-h-[calc(100svh-76px)] overflow-hidden bg-[#3d332b] text-paper md:grid-cols-[.52fr_1fr]">
          <div className="grain relative z-10 flex min-h-[590px] flex-col justify-center bg-[#f4efe6] px-6 py-14 text-ink md:min-h-[690px] md:px-[7vw] md:py-16">
            <div className="hero-intro relative z-10 max-w-[640px]">
              <p className="hero-eyebrow relative -top-10 flex items-center gap-3 whitespace-nowrap text-[#b8841f] md:-top-14"><span className="h-px w-9 bg-[#b8841f]" /><span className="odia-word">ଓଡ଼ିଶା</span><span className="latin-word">· ODISHA, AT ITS OWN PACE</span></p>
              <h1 className="mt-7 font-display text-[clamp(3rem,4.9vw,4.65rem)] leading-[.88] tracking-[-.055em]">A little<br />closer to<br /><em className="font-normal text-[#b8841f]">this place.</em></h1>
              <p className="mt-7 max-w-[390px] text-base leading-7 text-ink/75">Two owner-run stays. One big-hearted corner of India. Find your own small piece of Odisha.</p>
              <div className="mt-7 flex flex-wrap items-center gap-3"><Link href="#journey" className="inline-flex min-h-12 items-center gap-2 px-0 text-sm text-ink/80 hover:text-ink">Take the long way <ArrowDown size={15} /></Link></div>
              <div className="mt-10 flex items-center gap-3 text-xs text-ink/55"><span className="h-px w-12 bg-ink/35" />A small collection, held by hand</div>
            </div>
            <KonarkMark className="hero-wheel absolute -bottom-16 -left-20 z-[1] h-60 w-60 text-[#8f6a42]/25 md:-bottom-24 md:-left-24 md:h-[340px] md:w-[340px]" />
          </div>
          <HomeHeroStays properties={properties} />
          <div className="absolute bottom-6 left-6 z-20 hidden md:block"><span className="eyebrow text-ink/55">19°48&apos;48.6&quot;N · 85°49&apos;52.3&quot;E</span></div>
        </section>

        <HomeStory />

        <section id="journey" className="scroll-mt-20 bg-[#e9e1d2] px-5 py-20 md:px-10 md:py-28">
          <div className="mx-auto grid max-w-[1440px] items-center gap-12 md:grid-cols-[.8fr_1.2fr] md:gap-20">
            <div className="relative mx-auto w-full max-w-[420px]">
              <KonarkMark className="absolute -left-7 -top-6 z-10 h-24 w-24 -rotate-12 text-laterite md:-left-10 md:-top-10 md:h-32 md:w-32" />
              <div className="aspect-[.93] rotate-[-1.3deg] bg-[radial-gradient(ellipse_at_65%_30%,rgba(212,162,61,.45),transparent_34%),linear-gradient(145deg,#a64d37_0%,#6b4b3b_48%,#263e3d_100%)] shadow-[0_20px_50px_rgba(42,33,26,.16)]" />
              <p className="absolute -bottom-7 right-0 max-w-[220px] rotate-2 bg-paper px-4 py-3 font-display text-xl shadow-lg">No two mornings look alike.</p>
            </div>
            <div><p className="eyebrow text-laterite">Not a collection. A connection.</p><h2 className="mt-4 max-w-2xl font-display text-5xl leading-[.99] md:text-7xl">Here, the stay is part of the story.</h2><p className="mt-7 max-w-xl text-base leading-7 text-ink/70">Odisha is not a place to hurry through. Choose the coast or a village stay, meet the people who welcome you, then leave the rest of the day to you.</p><Link href="#stays" className="mt-7 inline-flex items-center gap-3 border-b border-laterite pb-2 text-sm font-semibold text-laterite">See the two stays <MoveRight size={16} /></Link></div>
          </div>
        </section>

        <section className="px-5 py-20 md:px-10 md:py-28"><div className="mx-auto grid max-w-[1440px] gap-8 border-l-[3px] border-laterite pl-6 md:grid-cols-[1fr_auto] md:items-center md:pl-10"><div><p className="eyebrow text-laterite">We’ll be right here</p><p className="mt-3 max-w-3xl font-display text-4xl leading-[1.05] md:text-6xl">Need a little help finding the right stay?</p><p className="mt-4 text-sm text-ink/60">Tell us what you’re looking for. A real person will write back.</p></div><a className="button-ink w-fit" href="mailto:retreatodisha@gmail.com">Write to your host <ArrowUpRight size={16} /></a></div></section>
      </main>
      <SiteFooter />
    </>
  );
}
