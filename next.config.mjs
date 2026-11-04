import { networkInterfaces } from "node:os";

/** @type {import('next').NextConfig} */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL) : null;
const allowedDevOrigins = process.env.NODE_ENV === "development"
  ? [...new Set(Object.values(networkInterfaces()).flatMap((interfaces) => interfaces ?? []).filter((address) => address.family === "IPv4" && !address.internal).map((address) => address.address))]
  : [];
const nextConfig = {
  allowedDevOrigins,
  turbopack: { root: process.cwd() },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: supabaseUrl ? [{ protocol: supabaseUrl.protocol.slice(0, -1), hostname: supabaseUrl.hostname, pathname: "/storage/v1/object/sign/property-images/**" }] : []
  }
};

export default nextConfig;
