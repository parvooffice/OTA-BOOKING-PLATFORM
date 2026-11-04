"use client";

import { useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import { KonarkMark } from "@/components/konark-mark";

export function HomeStory() {
  const section = useRef<HTMLElement>(null);
  const wheel = useRef<SVGSVGElement>(null);
  const number = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let context: { revert: () => void } | undefined;
    let disposed = false;
    const setup = async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([import("gsap"), import("gsap/ScrollTrigger")]);
      if (disposed || !section.current || !wheel.current) return;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        gsap.to(wheel.current, { rotation: 180, ease: "none", scrollTrigger: { trigger: section.current, start: "top bottom", end: "bottom top", scrub: .7 } });
        gsap.fromTo(".story-line", { yPercent: 22, opacity: 0 }, { yPercent: 0, opacity: 1, stagger: .12, duration: .8, ease: "power2.out", scrollTrigger: { trigger: section.current, start: "top 65%" } });
        gsap.fromTo(number.current, { innerText: 0 }, { innerText: 2, duration: 1.4, snap: { innerText: 1 }, ease: "power1.out", scrollTrigger: { trigger: section.current, start: "top 70%" } });
      }, section);
    };
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) void setup();
    return () => { disposed = true; context?.revert(); };
  }, []);

  return (
    <section ref={section} className="relative overflow-hidden bg-laterite px-5 py-20 text-paper md:px-10 md:py-28">
      <KonarkMark svgRef={wheel} className="absolute -right-20 top-1/2 h-[360px] w-[360px] -translate-y-1/2 text-paper/15 md:-right-12 md:h-[560px] md:w-[560px]" />
      <div className="relative mx-auto grid max-w-[1440px] gap-10 md:grid-cols-[.8fr_1.2fr] md:gap-20">
        <div><p className="story-line eyebrow text-[#f0ca76]">An invitation, from our home</p><p className="story-line mt-7 max-w-sm font-display text-[clamp(2.4rem,4vw,4.25rem)] leading-[.98]">The best plans leave a little room.</p><a href="#stays" className="story-line mt-8 inline-flex items-center gap-2 border-b border-paper/60 pb-2 text-sm">See what feels right <ArrowDown size={15} /></a></div>
        <div className="grid max-w-2xl grid-cols-[100px_1fr] items-start gap-5 md:grid-cols-[160px_1fr] md:gap-8"><span ref={number} className="story-line font-display text-[7rem] leading-[.8] text-[#f0ca76] md:text-[12rem]">0</span><div><p className="story-line eyebrow text-paper/60">Places, people, little rituals</p><p className="story-line mt-4 font-display text-3xl leading-[1.12] md:text-5xl">Two homes, one personal welcome.</p><p className="story-line mt-5 max-w-lg text-sm leading-7 text-paper/75 md:text-base">Each home is cared for by the people who welcome you. Ask about the early train, the quiet beach, or the village kitchen. We’ll help you find your way.</p></div></div>
      </div>
    </section>
  );
}
