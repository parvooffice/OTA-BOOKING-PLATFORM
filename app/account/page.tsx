import { Suspense } from "react";
import { AccountClient } from "@/components/account-client";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export default function AccountPage() {
  return <><SiteHeader /><main className="min-h-[70vh] px-5 py-12 md:px-10 md:py-20"><Suspense fallback={<p className="mx-auto max-w-5xl text-sm text-ink/55">Opening your account…</p>}><AccountClient /></Suspense></main><SiteFooter /></>;
}
