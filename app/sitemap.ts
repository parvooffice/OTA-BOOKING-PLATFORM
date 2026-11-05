import type { MetadataRoute } from "next";
import { getProperties } from "@/lib/property-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://ota-booking-platform-nine.vercel.app").replace(/\/+$/, "");
  const properties = await getProperties();

  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "weekly", priority: 1 },
    ...properties.map((property) => ({
      url: `${siteUrl}/properties/${encodeURIComponent(property.slug)}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
      images: property.images
    }))
  ];
}
