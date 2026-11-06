"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { LayoutGroup, MotionConfig } from "framer-motion";

export function SiteProviders({ children }: { children: React.ReactNode }) {
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  const content = <MotionConfig reducedMotion="user"><LayoutGroup id="odisha-retreat">{children}</LayoutGroup></MotionConfig>;
  return publishableKey ? <ClerkProvider publishableKey={publishableKey}>{content}</ClerkProvider> : content;
}
