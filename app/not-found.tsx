import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return <main className="grid min-h-[100svh] place-items-center px-6 py-16 text-center"><div className="max-w-xl"><p className="eyebrow text-laterite">That path has gone quiet</p><h1 className="mt-4 font-display text-7xl leading-none">Not found.</h1><p className="mt-5 text-sm leading-6 text-ink/65">The page you’re looking for may have moved. Let’s find you another way in.</p><Link href="/" className="button-ink mt-7"><ArrowLeft size={15} /> Back to the stays</Link></div></main>;
}
