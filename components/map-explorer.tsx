"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AttributionControl, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { ArrowUpRight, MapPin, MoveRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { properties as fallbackProperties, type RetreatProperty } from "@/lib/properties";

setWorkerUrl("/maplibre-gl-worker.mjs");

export function MapExplorer({ properties = fallbackProperties }: { properties?: RetreatProperty[] }) {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();
  const property = properties.find((item) => item.slug === selected);

  const flyTo = useCallback((slug: string) => {
    const item = properties.find((entry) => entry.slug === slug);
    if (!item || !mapRef.current) return;
    setSelected(item.slug);
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current.flyTo({ center: item.coordinates, zoom: 8.3, duration: reducedMotion ? 0 : 1700, essential: !reducedMotion, curve: 1.3 });
  }, [properties]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    const map = new MapLibreMap({
      container: mapNode.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [85.5, 20.3], zoom: 5.9, minZoom: 4.5, maxZoom: 12,
      attributionControl: false, cooperativeGestures: true
    });
    map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
    map.addControl(new AttributionControl({ compact: true }), "bottom-left");
    map.on("load", () => {
      const colors: Record<string, string> = { water: "#9bbfbb", landcover: "#e7dfcf", landuse: "#e7dfcf", building: "#d9cbb4" };
      for (const [layer, color] of Object.entries(colors)) {
        if (map.getLayer(layer)) map.setPaintProperty(layer, "fill-color", color);
      }
    });
    markersRef.current = properties.map((item, index) => {
      const node = document.createElement("button");
      node.type = "button";
      node.className = "map-pin";
      node.setAttribute("aria-label", `Explore ${item.place}`);
      node.dataset.cursor = "Explore";
      node.innerHTML = `<span class="map-pin__number">0${index + 1}</span><span class="map-pin__dot"></span>`;
      node.addEventListener("click", () => flyTo(item.slug));
      return new Marker({ element: node, anchor: "bottom" }).setLngLat(item.coordinates).addTo(map);
    });
    mapRef.current = map;
    return () => { markersRef.current.forEach((marker) => marker.remove()); map.remove(); mapRef.current = null; };
  }, [flyTo, properties]);

  return (
    <div className="relative min-h-[590px] overflow-hidden bg-[#dce7df] md:min-h-[700px]">
      <div ref={mapNode} className="absolute inset-0" aria-label="Map of four host stays in Odisha" role="application" />
      <div className="pointer-events-none absolute left-4 top-4 z-10 max-w-[calc(100%-2rem)] md:left-8 md:top-8">
        <div className="pointer-events-auto max-w-[22rem] border border-ink/10 bg-paper/95 p-5 shadow-[0_14px_50px_rgba(42,33,26,.12)] backdrop-blur-sm md:p-7">
          <p className="eyebrow text-laterite">Four corners of Odisha</p><h3 className="mt-3 font-display text-3xl leading-[1.04] md:text-4xl">A place to begin, wherever you are.</h3>
          <p className="mt-3 text-sm leading-6 text-ink/65">Tap a hand-picked pin. We’ll show you the kind of quiet waiting there.</p>
          <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">{properties.map((item, index) => <button key={item.id} onClick={() => flyTo(item.slug)} className={`flex items-center gap-2 text-xs transition-colors ${selected === item.slug ? "text-laterite" : "text-ink/65 hover:text-laterite"}`}><span className="font-display text-sm">0{index + 1}</span>{item.place}</button>)}</div>
        </div>
      </div>
      <AnimatePresence mode="wait">
        {property && <motion.article key={property.slug} layoutId={`map-card-${property.slug}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: .35 }} className="absolute bottom-4 left-4 right-4 z-10 grid max-w-[360px] grid-cols-[96px_1fr] bg-paper shadow-[0_14px_50px_rgba(42,33,26,.2)] md:bottom-8 md:left-8">
          <motion.div layoutId={`property-image-${property.slug}-0`} data-cursor="View" className="min-h-[132px] bg-cover bg-center" style={{ backgroundImage: `url(${property.hero})` }} />
          <div className="relative p-4"><button onClick={() => setSelected(null)} className="absolute right-2 top-2 p-1 text-ink/45 hover:text-ink" aria-label="Close selected property">×</button><p className="eyebrow text-laterite">{property.district} district</p><h4 className="mt-1 font-display text-2xl">{property.place}</h4><p className="mt-1 text-xs text-ink/60">{property.tagline}</p><button onClick={() => router.push(`/properties/${property.slug}`)} className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-laterite">Step inside <MoveRight size={14} /></button></div>
        </motion.article>}
      </AnimatePresence>
      <div className="absolute bottom-5 right-5 hidden items-center gap-2 bg-paper/90 px-3 py-2 text-[10px] text-ink/55 md:flex"><MapPin size={13} className="text-laterite" /> Host stays, not hotels <ArrowUpRight size={12} /></div>
    </div>
  );
}
