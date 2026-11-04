"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { AttributionControl, Map as MapLibreMap, Marker, setWorkerUrl } from "maplibre-gl";

setWorkerUrl("/maplibre-gl-worker.mjs");

export function LocationMap({ center, label }: { center: [number, number]; label: string }) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<MapLibreMap | null>(null);
  useEffect(() => {
    if (!node.current || map.current) return;
    map.current = new MapLibreMap({ container: node.current, style: "https://tiles.openfreemap.org/styles/liberty", center, zoom: 8.3, interactive: false, attributionControl: false });
    const marker = document.createElement("span"); marker.className = "map-pin__number"; marker.textContent = "✳"; marker.setAttribute("aria-label", label);
    new Marker({ element: marker }).setLngLat(center).addTo(map.current);
    map.current.addControl(new AttributionControl({ compact: true }));
    return () => { map.current?.remove(); map.current = null; };
  }, [center, label]);
  return <div ref={node} className="h-full min-h-[280px] w-full bg-[#dce7df]" aria-label={`Map showing approximate location near ${label}`} role="img" />;
}
