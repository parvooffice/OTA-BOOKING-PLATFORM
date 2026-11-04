import type { Metadata } from "next";
import { SiteProviders } from "@/components/site-providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://odisharetreat.com"),
  title: { default: "Odisha Retreat — a gentler kind of stay", template: "%s · Odisha Retreat" },
  description: "Four independent stays, held close to the coast, lagoon and forest of Odisha.",
  openGraph: { type: "website", title: "Odisha Retreat", description: "A little closer to Odisha." },
  icons: { icon: "/brand/mark.svg" }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body>
        <SiteProviders>{children}</SiteProviders>
      </body>
    </html>
  );
}
