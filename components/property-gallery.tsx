"use client";

import Image from "next/image";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Expand, X } from "lucide-react";

export function PropertyGallery({ slug, place, images, caption }: { slug: string; place: string; images: string[]; caption: string }) {
  const [active, setActive] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const previous = useCallback(() => setActive((current) => current === null ? null : (current + images.length - 1) % images.length), [images.length]);
  const next = useCallback(() => setActive((current) => current === null ? null : (current + 1) % images.length), [images.length]);

  useEffect(() => {
    if (active === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActive(null);
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [active, next, previous]);

  return (
    <>
      {images.length === 0 ? <div className="grid min-h-[280px] place-items-center border border-dashed border-ink/20 bg-[#e9e1d2] p-8 text-center"><p className="font-display text-2xl text-ink/65">Photos will appear here</p></div> : <>
      <motion.div layoutId={`map-card-${slug}`} className="grid gap-3 md:grid-cols-[1.4fr_.6fr]">
        <button type="button" onClick={() => setActive(0)} className="group relative aspect-[1.05] overflow-hidden bg-[#ddd0ba] text-left md:aspect-[1.22]" aria-label={`Open ${place} photo gallery`}>
          <motion.div layoutId={`property-image-${slug}-0`} className="absolute inset-0">
            <Image src={images[0]} alt={`${place}, Odisha`} fill priority sizes="(max-width: 768px) 100vw, 64vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.025]" />
          </motion.div>
          <span className="absolute bottom-5 left-5 bg-paper/90 px-3 py-2 font-display text-xl">{caption}</span><span className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-paper/90"><Expand size={16} /></span><span className="pointer-events-none absolute bottom-5 right-5 hidden rounded-full bg-ink/75 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-white transition group-hover:block">View</span>
        </button>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-1">
          {images.slice(1, 3).map((image, index) => <button key={image} type="button" onClick={() => setActive(index + 1)} className={`group relative aspect-[1.2] overflow-hidden bg-[#ddd0ba] md:aspect-[1.5] ${index === 1 ? "hidden md:block" : ""}`} aria-label={`Open gallery image ${index + 2}`}>
            <motion.div layoutId={`property-image-${slug}-${index + 1}`} className="absolute inset-0"><Image src={image} alt={`${place}, property detail ${index + 1}`} fill sizes="(max-width: 768px) 50vw, 30vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" /></motion.div><span className="absolute bottom-3 right-3 rounded-full bg-paper/90 px-3 py-1 text-[10px] font-bold uppercase tracking-widest">{index === 1 ? "All photos" : "View"}</span>
          </button>)}
        </div>
      </motion.div>
      <AnimatePresence>
        {active !== null && <motion.div className="fixed inset-0 z-[100] flex flex-col bg-[#211b17] text-paper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduceMotion ? 0 : .2 }} role="dialog" aria-modal="true" aria-label={`${place} photo gallery`}>
          <div className="flex items-center justify-between px-5 py-4 md:px-8"><p className="font-display text-xl">{place}<span className="ml-3 font-sans text-xs text-paper/50">{String(active + 1).padStart(2, "0")} / {String(images.length).padStart(2, "0")}</span></p><button className="flex h-11 w-11 items-center justify-center" onClick={() => setActive(null)} aria-label="Close gallery"><X /></button></div>
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-3 pb-4 md:px-16"><button onClick={previous} aria-label="Previous photo" className="absolute left-2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-paper/10 hover:bg-paper/20 md:left-6"><ChevronLeft /></button>
            <AnimatePresence mode="wait" initial={false}><motion.div key={active} layoutId={`property-image-${slug}-${active}`} className="relative h-full max-h-[calc(100vh-170px)] w-full max-w-[1500px] overflow-hidden" drag={reduceMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} onDragEnd={(_, info) => { if (info.offset.x < -90) next(); else if (info.offset.x > 90) previous(); }} initial={reduceMotion ? false : { opacity: .7, scale: .985 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: .65, scale: .985 }} transition={{ duration: reduceMotion ? 0 : .25 }}><Image src={images[active]} alt={`${place} gallery image ${active + 1}`} fill priority sizes="100vw" className="object-contain" /></motion.div></AnimatePresence>
            <button onClick={next} aria-label="Next photo" className="absolute right-2 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-paper/10 hover:bg-paper/20 md:right-6"><ChevronRight /></button></div>
          <div className="flex justify-center gap-2 overflow-x-auto px-4 pb-5">{images.map((image, index) => <button key={image} onClick={() => setActive(index)} aria-label={`Show photo ${index + 1}`} aria-current={active === index} className={`relative h-[52px] w-[72px] shrink-0 overflow-hidden border-2 ${active === index ? "border-turmeric opacity-100" : "border-transparent opacity-55 hover:opacity-100"}`}><Image src={image} alt="" fill sizes="72px" className="object-cover" /></button>)}</div>
        </motion.div>}
      </AnimatePresence>
      </>}
    </>
  );
}
