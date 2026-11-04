"use client";

import { useEffect, useRef, useState } from "react";

export function CustomCursor() {
  const cursor = useRef<HTMLDivElement>(null);
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    let frame = 0; let x = 0; let y = 0;
    const move = (event: PointerEvent) => {
      x = event.clientX; y = event.clientY;
      if (frame) return;
      frame = requestAnimationFrame(() => { if (cursor.current) cursor.current.style.transform = `translate3d(${x}px,${y}px,0)`; frame = 0; });
    };
    const enter = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-cursor]") : null;
      if (target) setLabel(target.dataset.cursor || "View");
    };
    const leave = (event: PointerEvent) => {
      const from = event.target instanceof Element ? event.target.closest("[data-cursor]") : null;
      const to = event.relatedTarget instanceof Element ? event.relatedTarget.closest("[data-cursor]") : null;
      if (from && !to) setLabel("");
    };
    window.addEventListener("pointermove", move, { passive: true });
    document.addEventListener("pointerover", enter, true);
    document.addEventListener("pointerout", leave, true);
    return () => { window.removeEventListener("pointermove", move); document.removeEventListener("pointerover", enter, true); document.removeEventListener("pointerout", leave, true); if (frame) cancelAnimationFrame(frame); };
  }, []);
  return <div ref={cursor} className={`custom-cursor ${label ? "is-visible" : ""}`} aria-hidden="true"><span>{label}</span></div>;
}
