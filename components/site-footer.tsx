import Link from "next/link";

export function SiteFooter() {
  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER?.replace(/\D/g, "");
  return (
    <footer className="bg-mahogany text-paper">
      <div className="ikat-rule opacity-70" />
      <div className="mx-auto grid max-w-[1440px] gap-10 px-6 py-14 md:grid-cols-[1.3fr_.7fr_1fr] md:px-10">
        <div><p className="eyebrow text-turmeric">ଓଡ଼ିଶା · ODISHA</p><p className="mt-4 max-w-sm font-display text-3xl leading-tight">Come a little closer to this place.</p></div>
        <div className="grid content-start gap-3 text-sm text-paper/75"><Link href="/#stays">Our stays</Link><Link href="/account">Your booking</Link><Link href="/admin">Host sign in</Link></div>
        <p className="max-w-sm text-sm leading-6 text-paper/65">A small, owner-run collection of stays across Odisha. Questions? Write to <a className="text-paper underline decoration-turmeric underline-offset-4" href="mailto:retreatodisha@gmail.com">retreatodisha@gmail.com</a>{whatsappNumber && <> or <a className="text-paper underline decoration-turmeric underline-offset-4" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noreferrer">send us a WhatsApp</a></>}.</p>
      </div>
      <div className="mx-auto flex max-w-[1440px] flex-col justify-between gap-2 border-t border-paper/15 px-6 py-5 text-xs text-paper/50 md:flex-row md:px-10"><span>© {new Date().getFullYear()} Odisha Retreat</span><span>Made slowly, in Odisha.</span></div>
    </footer>
  );
}
