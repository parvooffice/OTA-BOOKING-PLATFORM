import type { Ref, SVGProps } from "react";

export function KonarkMark({ className = "", svgRef, ...props }: SVGProps<SVGSVGElement> & { svgRef?: Ref<SVGSVGElement> }) {
  return (
    <svg ref={svgRef} className={className} viewBox="0 0 120 120" fill="none" aria-hidden="true" {...props}>
      <circle cx="60" cy="60" r="48" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="60" cy="60" r="39" stroke="currentColor" strokeWidth=".75" strokeDasharray="1.4 3.3" />
      <circle cx="60" cy="60" r="7" fill="currentColor" />
      {Array.from({ length: 12 }, (_, i) => <g key={i} transform={`rotate(${i * 30} 60 60)`}><path d="M60 12V53" stroke="currentColor" strokeWidth="1.2" /><circle cx="60" cy="21" r="2.25" fill="currentColor" /><path d="M55.8 40 60 35.8 64.2 40 60 44.2z" fill="currentColor" /></g>)}
      <path d="M27 93 19 101m74-8 8 8M60 108v-8M12 60h11m85 0H97" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}
