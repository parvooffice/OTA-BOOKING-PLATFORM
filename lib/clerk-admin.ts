import { auth, clerkClient } from "@clerk/nextjs/server";

export type AdminIdentity = { userId: string; email: string };

export async function getAdminIdentity(): Promise<AdminIdentity | null> {
  if (!process.env.CLERK_SECRET_KEY || !process.env.ADMIN_EMAILS) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const allowed = new Set(process.env.ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress.toLowerCase();
    return email && allowed.has(email) ? { userId, email } : null;
  } catch { return null; }
}

export async function getAdminIdentityForRequest(request: Request): Promise<AdminIdentity | null> {
  if (!process.env.CLERK_SECRET_KEY || !process.env.ADMIN_EMAILS) return null;
  void request;
  const { userId } = await auth();
  if (!userId) return null;
  const allowed = new Set(process.env.ADMIN_EMAILS.split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses.find((address) => address.id === user.primaryEmailAddressId)?.emailAddress.toLowerCase();
    return email && allowed.has(email) ? { userId, email } : null;
  } catch { return null; }
}
