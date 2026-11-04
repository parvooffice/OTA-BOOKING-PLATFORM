import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest } from "next/server";

const withClerk = clerkMiddleware();

export function proxy(request: NextRequest, event: Parameters<typeof withClerk>[1]) {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return NextResponse.next();
  return withClerk(request, event);
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*", "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|txt|xml)).*)"]
};
