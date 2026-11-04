import { auth } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { AdminSignIn } from "@/components/admin-sign-in";
import { getAdminIdentity } from "@/lib/clerk-admin";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!process.env.CLERK_SECRET_KEY || !process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) return <main className="grid min-h-[100svh] place-items-center px-6 py-12"><section className="max-w-xl border border-ink/15 bg-[#fbf8f1] p-8"><p className="eyebrow text-laterite">Host desk setup</p><h1 className="mt-3 font-display text-4xl">The owner’s dashboard is nearly ready.</h1><p className="mt-4 text-sm leading-6 text-ink/60">Add your Clerk publishable key, secret key and owner email to the environment to enable the protected host desk.</p></section></main>;
  const { userId } = await auth();
  if (!userId) return <AdminSignIn />;
  const admin = await getAdminIdentity();
  if (!admin) notFound();
  return <AdminDashboard adminEmail={admin.email} />;
}
